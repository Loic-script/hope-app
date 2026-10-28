# HOPE — Modèle de données

Base : `hope_donations` (PostgreSQL ≥ 14).
Schéma source : [`prisma/schema.prisma`](../prisma/schema.prisma).
Diagramme : [`database-erd.md`](database-erd.md).

---

## Conventions

| Sujet | Choix |
| --- | --- |
| Identifiants | `UUID` (`@db.Uuid`), générés par l'application |
| Nommage | tables et colonnes en `snake_case`, modèles Prisma en `PascalCase` |
| Montants | `Decimal(18, 2)` — **jamais** de `float` ni de `double` |
| Devises | `Char(3)`, code ISO 4217 ; liste validée dans `src/shared/currency.ts` |
| Pays | `Char(2)`, code ISO 3166-1 alpha-2 |
| Dates | `Timestamptz(6)` pour les instants, `Date` pour les dates calendaires |
| Horodatage | `created_at` et `updated_at` sur toutes les tables métier |
| Suppression | `onDelete: Restrict` sur les liens financiers, `Cascade` sur les dépendances pures |

### Pourquoi `Decimal` et pas `float`

`0.1 + 0.2` vaut `0.30000000000000004` en virgule flottante. Sur des milliers
d'opérations, l'écart devient un écart comptable réel. Toutes les colonnes monétaires
sont donc en `Decimal(18, 2)`, et le code manipule des `Prisma.Decimal` de bout en
bout (voir `src/shared/money.ts`).

`Decimal(18, 2)` autorise des montants jusqu'à 10¹⁶ — largement suffisant, y compris
en ariary malgache où les montants courants se comptent en centaines de milliers.

### Pourquoi les devises ne sont pas un enum

Ajouter une devise ne doit pas imposer une migration de base. La colonne est un
`Char(3)` et la liste autorisée vit dans le code (`SUPPORTED_CURRENCIES`), où elle est
validée à chaque écriture.

**HOPE ne convertit aucune devise en phase 1.** Chaque devise est un compte séparé :
un projet financé en MGA et en EUR possède deux soldes distincts, jamais additionnés.
Introduire une conversion demanderait une table de taux datés et une décision
comptable sur la date de conversion retenue.

---

## 1. `donors` — les donateurs

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `first_name`, `last_name` | varchar(120) | pour une organisation : la personne de contact |
| `organization_name` | varchar(180) nullable | raison sociale des entreprises, fondations, partenaires |
| `email` | varchar(180) **unique** | normalisé en minuscules |
| `phone` | varchar(40) | |
| `donor_type` | enum | `INDIVIDUAL`, `COMPANY`, `FOUNDATION`, `ORGANIZATION`, `PARTNER` |
| `country` | char(2) | ISO 3166-1 alpha-2 |
| `preferred_currency` | char(3) | ISO 4217 |
| `preferred_language`, `timezone`, `address`, `city`, `profession`, `website`, `discovery_source` | nullable | informations complémentaires |

**Index** : `donor_type`, `country`, `created_at`.

### « International » n'est pas un type de donateur

C'est le point de modélisation à ne pas rater. Un donateur possède **un type**
(`donor_type`) **et un pays** (`country`), deux informations indépendantes :

```
donorType = PARTICULIER
country   = FR
        --> le système en DÉDUIT qu'il s'agit d'un donateur international
```

Il n'existe **ni table ni colonne** « donateur international ». Le calcul se fait dans
`src/shared/geography.ts` : est international tout donateur situé hors du pays
d'implantation de HOPE (`MG`). Ce choix évite une donnée redondante qui deviendrait
fausse dès qu'un donateur déménage, et permet de filtrer sans colonne dédiée
(`donorService.listDonors({ international: true })`).

Le pays sert aussi à décider quelles **méthodes de paiement** sont proposées : un
donateur malgache voit les méthodes `LOCAL` et `BOTH`, un donateur étranger les
méthodes `INTERNATIONAL` et `BOTH`.

---

## 2. `donations` — les engagements

**Un don est une intention, pas de l'argent.** Voir la section dédiée du README.

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `reference` | varchar(40) **unique** | `HOPE-DON-20260903-A1B2C3` |
| `donor_id` | uuid FK → `donors` | `onDelete: Restrict` |
| `donation_type` | enum | `ONE_TIME`, `RECURRING` |
| `status` | enum | `DRAFT`, `ACTIVE`, `COMPLETED`, `CANCELLED` |
| `currency` | char(3) | toutes les transactions du don partagent cette devise |
| `expected_amount` | decimal(18,2) | **par échéance** pour un don récurrent, total pour un don ponctuel |
| `start_date`, `end_date` | date nullable | période de l'engagement |
| `frequency` | enum nullable | `MONTHLY`, `QUARTERLY`, `YEARLY` |
| `next_payment_date` | date nullable | prochaine échéance attendue |
| `notes` | text nullable | |

**Index** : `donor_id`, `status`, `donation_type`, `next_payment_date`.

### `expected_amount` : attendu, pas reçu

C'est le montant **espéré**. Le montant **réellement reçu** se calcule à partir des
transactions et n'est jamais stocké sur le don : le stocker créerait une donnée
dérivée à resynchroniser à chaque paiement, échec ou remboursement — et donc une
source de divergence.

### Nombre d'échéances

Calculé par `computeExpectedInstallments()` :

- don ponctuel → **1** ;
- don récurrent avec date de fin → nombre d'échéances de la période ;
- don récurrent **sans** date de fin → **`null`** (engagement ouvert).

Dans le dernier cas, `totalCommitted` et `remainingCommitment` valent `null` : on
n'invente pas une date de fin que le donateur n'a jamais donnée.

---

## 3. `payment_methods` — le catalogue des moyens de paiement

Table **de données**, pas de code : ajouter une méthode = ajouter une ligne.

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `code` | varchar(60) **unique** | `MVOLA`, `ORANGE_MONEY`, `CARD`… |
| `name` | varchar(120) | libellé affiché |
| `provider` | varchar(60) | code de l'implémentation technique : `MOCK`, puis `STRIPE`, `MVOLA`… |
| `scope` | enum | `LOCAL`, `INTERNATIONAL`, `BOTH` |
| `is_active` | boolean | désactiver sans supprimer, pour préserver l'historique |
| `supported_currencies` | char(3)[] | tableau vide = aucune restriction |
| `description` | text nullable | |

**Index** : `scope`, `is_active`.

### Contenu du seed

| Code | Portée | Devises | Fournisseur |
| --- | --- | --- | --- |
| `MVOLA` | LOCAL | MGA | MOCK |
| `ORANGE_MONEY` | LOCAL | MGA | MOCK |
| `BANK_TRANSFER` | LOCAL | MGA | MOCK |
| `BANK_DEPOSIT` | LOCAL | MGA | MOCK |
| `CASH` | LOCAL | MGA | MOCK |
| `CARD` | INTERNATIONAL | EUR USD GBP CHF CAD | MOCK |
| `INTERNATIONAL_BANK_TRANSFER` | INTERNATIONAL | EUR USD GBP CHF CAD | MOCK |
| `PAYMENT_PLATFORM` | INTERNATIONAL | EUR USD GBP CHF CAD | MOCK |

`scope` et `supported_currencies` sont des données : si HOPE accepte un jour les
cartes locales, il suffit de passer `CARD` en `BOTH` et d'ajouter `MGA` — sans
toucher au code.

---

## 4. `transactions` — les mouvements d'argent réels

**Module prioritaire.** C'est la seule table qui représente de l'argent qui bouge.

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `donation_id` | uuid FK → `donations` | `onDelete: Restrict` |
| `payment_method_id` | uuid FK → `payment_methods` | `onDelete: Restrict` |
| `amount` | decimal(18,2) | montant de **cette** échéance |
| `currency` | char(3) | toujours celle du don |
| `status` | enum | `PENDING`, `PROCESSING`, `SUCCESS`, `FAILED`, `CANCELLED`, `REFUNDED` |
| `provider_reference` | varchar(180) nullable | référence **opaque** du prestataire |
| `internal_reference` | varchar(40) **unique** | `HOPE-TXN-20260903-A1B2C3` |
| `installment_number` | int nullable | numéro d'échéance d'un don récurrent |
| `transaction_date` | timestamptz nullable | renseignée à la confirmation |
| `failure_reason` | text nullable | |
| `refunded_amount` | decimal(18,2) défaut 0 | permet le remboursement partiel |
| `refunded_at`, `refund_reason` | nullable | traçabilité du remboursement |
| `metadata` | jsonb nullable | données libres **non sensibles** + historique des réponses prestataire |

**Index** : `donation_id`, `payment_method_id`, `status`, `transaction_date`,
et l'index composite `(donation_id, status)` qui sert au calcul des totaux.

### Ce qui n'est jamais stocké

Aucun numéro de carte, aucun CVV, aucune coordonnée bancaire, aucun identifiant
prestataire. `provider_reference` ne contient qu'un jeton opaque, `metadata` que des
informations non sensibles.

### Montant net d'une transaction

```
net = (status == SUCCESS) ? amount - refunded_amount : 0
```

Une transaction `PENDING`, `PROCESSING`, `FAILED`, `CANCELLED` ou `REFUNDED` apporte
**zéro**. Un remboursement partiel laisse le statut `SUCCESS` et réduit le net ; un
remboursement total fait passer en `REFUNDED`. Dans les deux cas **la ligne est
conservée** : une écriture financière confirmée ne se supprime pas.

### Transitions de statut

```
PENDING    -> PROCESSING, SUCCESS, FAILED, CANCELLED
PROCESSING -> SUCCESS, FAILED, CANCELLED
SUCCESS    -> REFUNDED
FAILED     -> (final)
CANCELLED  -> (final)
REFUNDED   -> (final)
```

Deux interdictions méritent d'être explicitées :

- **`FAILED → SUCCESS`** — une tentative échouée ne redevient jamais réussie. Pour
  retenter un paiement, on crée une **nouvelle** transaction : l'historique des
  tentatives reste ainsi lisible.
- **`SUCCESS → CANCELLED`** — de l'argent encaissé ne s'annule pas, il se **rembourse**,
  ce qui laisse une trace (`refunded_amount`, `refunded_at`, `refund_reason`, audit).

---

## 5. `donation_allocations` — l'affectation aux projets

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `donation_id` | uuid FK → `donations` | `onDelete: Restrict` |
| `project_id` | uuid FK → `projects` | `onDelete: Restrict` |
| `amount` | decimal(18,2) | |
| `currency` | char(3) | toujours celle du don |
| `allocation_type` | enum | `DONOR_DESIGNATED`, `HOPE_ALLOCATED` |
| `allocated_at` | timestamptz | date de la décision d'affectation |
| `notes` | text nullable | |

**Index** : `donation_id`, `project_id`, `(project_id, currency)`.

### Affecté ou non affecté

- **`DONOR_DESIGNATED`** — le donateur a demandé un projet précis.
- **`HOPE_ALLOCATED`** — le don était non affecté ; HOPE décide de la répartition.

Un même don peut financer plusieurs projets :

```
Don de 1 000 EUR
   ├── 400 EUR  -> Projet Éducation
   ├── 300 EUR  -> Projet Santé
   └── 300 EUR  -> Projet Alimentation
```

`allocationService.allocateMany()` écrit toutes les parts dans **une seule
transaction PostgreSQL** : soit la répartition complète est enregistrée, soit aucune
part ne l'est.

### La règle qui gouverne cette table

> La somme des affectations d'un don ne peut jamais dépasser le montant **net
> réellement reçu**.

Ni les transactions `PENDING` ni les `FAILED` n'ouvrent de droit à affecter. Le
contrôle est protégé par une transaction `SERIALIZABLE` doublée d'un verrou explicite
sur la ligne du don (`SELECT … FOR UPDATE`), de sorte que deux affectations
simultanées ne peuvent pas dépasser ensemble le disponible.

Corollaire : un **remboursement** peut être refusé s'il ferait passer le reçu sous le
montant déjà affecté. Il faut d'abord annuler les affectations concernées.

---

## 6. `project_categories`

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `name` | varchar(120) **unique** | sert de clé naturelle pour les seeds |
| `description` | text nullable | |

Seed : Scolarité, Soins, Alimentation, Employabilité, Formation professionnelle,
Soutien social, Urgence.

---

## 7. `projects`

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `code` | varchar(40) **unique** | `HOPE-PRJ-20260903-A1B2C3` |
| `category_id` | uuid FK → `project_categories` | `onDelete: Restrict` |
| `name` | varchar(180) | |
| `description` | text | |
| `location`, `manager_name` | nullable | |
| `start_date`, `end_date` | date nullable | |
| `status` | enum | `DRAFT`, `ACTIVE`, `COMPLETED`, `SUSPENDED`, `CANCELLED` |
| `photo_url`, `video_url` | varchar(500) nullable | |

**Index** : `category_id`, `status`.

Seuls les projets `DRAFT` et `ACTIVE` peuvent recevoir des fonds ou des dépenses.

### Fonds d'un projet

Ils ne sont **pas** stockés, ils se calculent :

```
fonds disponibles (par devise) = affectations reçues − dépenses engagées (VALIDATED + PAID)
```

`projectService.getProjectFunds()` renvoie une ligne **par devise** : aucune addition
entre MGA et EUR n'est jamais faite.

---

## 8. `project_budgets` et `budget_items`

Un projet peut porter **plusieurs budgets**, typiquement un par période
(« Scolarisation 2027 », puis « Scolarisation 2028 »).

### `project_budgets`

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `project_id` | uuid FK → `projects` | `onDelete: Restrict` |
| `name` | varchar(180) | |
| `total_amount` | decimal(18,2) | l'enveloppe votée |
| `currency` | char(3) | |
| `start_date`, `end_date` | date nullable | |
| `status` | enum | `DRAFT`, `ACTIVE`, `CLOSED`, `CANCELLED` |

### `budget_items`

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `budget_id` | uuid FK → `project_budgets` | `onDelete: Cascade` |
| `name` | varchar(180) | |
| `description` | text nullable | |
| `planned_amount` | decimal(18,2) | |

Exemple :

```
Projet : Scolarisation 2027
Budget total : 5 000 EUR
   ├── Frais scolaires     2 000 EUR
   ├── Matériel scolaire   1 500 EUR
   ├── Transport           1 000 EUR
   └── Autres                500 EUR
```

La somme des lignes ne peut pas dépasser l'enveloppe du budget : on refuse de
planifier plus que ce qui est voté.

---

## 9. `expenses` — les dépenses

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `reference` | varchar(40) **unique** | `HOPE-EXP-20260903-A1B2C3` |
| `project_id` | uuid FK → `projects` | `onDelete: Restrict` |
| `budget_id` | uuid FK nullable | une dépense peut être hors budget |
| `budget_item_id` | uuid FK nullable | exige `budget_id` |
| `amount` | decimal(18,2) | |
| `currency` | char(3) | doit correspondre à la devise du budget |
| `description` | text | |
| `expense_date` | date | |
| `status` | enum | `DRAFT`, `VALIDATED`, `PAID`, `CANCELLED` |
| `validated_at`, `paid_at` | timestamptz nullable | |

**Index** : `project_id`, `budget_id`, `budget_item_id`, `status`,
`(project_id, status)`.

### Quels statuts consomment les fonds

Seuls **`VALIDATED`** et **`PAID`**. Une dépense `DRAFT` est une intention, une dépense
`CANCELLED` ne consomme plus rien. Le contrôle est néanmoins rejoué **dès la création**
pour signaler l'incohérence tout de suite plutôt qu'au moment de la validation.

### Deux plafonds indépendants

1. **Le budget** — une *prévision* : la dépense ne doit faire dépasser ni l'enveloppe
   du budget, ni la ligne budgétaire visée.
2. **La trésorerie** — du *cash réel* : la dépense ne doit pas dépasser les fonds
   effectivement affectés au projet, lesquels ne proviennent que de transactions
   `SUCCESS`.

Un projet peut donc avoir un budget voté de 5 000 EUR et ne pouvoir dépenser que
1 200 EUR s'il n'a reçu que 1 200 EUR. `expenseService.checkAffordability()` renvoie
les trois plafonds sans rien écrire, ce qui permet de prévenir l'utilisateur avant la
saisie.

`PAID` est final : l'argent est sorti, une correction passe par une écriture
compensatoire.

---

## 10. `supporting_documents` — les justificatifs

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `expense_id` | uuid FK → `expenses` | `onDelete: Cascade` |
| `document_type` | enum | `INVOICE`, `RECEIPT`, `BANK_PROOF`, `CONTRACT`, `OTHER` |
| `file_name` | varchar(255) | |
| `file_path` | varchar(500) | emplacement du fichier |
| `mime_type` | varchar(120) nullable | |
| `file_size` | int nullable | en octets |
| `reference` | varchar(120) nullable | numéro de facture ou de reçu |
| `issued_at` | date nullable | date d'émission du document |

**Phase 1 : métadonnées uniquement.** Aucun upload HTTP, aucun stockage binaire.
Quand le transfert de fichiers sera ajouté, il suffira de renseigner `file_path` avec
l'emplacement réel (disque, bucket S3…) : le modèle n'a pas à changer.

---

## 11. `beneficiaries` et `project_beneficiaries`

### `beneficiaries`

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `reference` | varchar(40) **unique** | `HOPE-BEN-20260903-A1B2C3` |
| `first_name`, `last_name` | varchar(120) **nullable** | l'anonymat est possible |
| `beneficiary_type` | enum | `ORPHAN`, `SINGLE_MOTHER`, `FAMILY`, `OTHER` |
| `gender` | enum nullable | `MALE`, `FEMALE`, `OTHER`, `UNDISCLOSED` |
| `birth_date` | date nullable | l'âge est calculé, jamais stocké |
| `country` | char(2) | |
| `city` | varchar(120) nullable | |
| `status` | enum | `ACTIVE`, `INACTIVE`, `GRADUATED`, `WITHDRAWN` |
| `notes` | text nullable | |

Le nom et le prénom sont **facultatifs** : la référence anonyme permet de citer un
bénéficiaire dans un rapport public sans exposer son identité.

### `project_beneficiaries` — la table de liaison

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `project_id` | uuid FK → `projects` | `onDelete: Cascade` |
| `beneficiary_id` | uuid FK → `beneficiaries` | `onDelete: Cascade` |
| `joined_at` | timestamptz | entrée dans le projet |
| `left_at` | timestamptz nullable | sortie |
| `status` | enum | `ACTIVE`, `COMPLETED`, `LEFT`, `SUSPENDED` |
| `notes` | text nullable | |

**Contrainte unique `(project_id, beneficiary_id)`** : empêche une double inscription
au même projet.

La relation est bien **N-N** : un projet accompagne plusieurs bénéficiaires, et un
bénéficiaire peut participer à plusieurs projets (scolarité **et** soins, par
exemple). La table de liaison porte l'inscription elle-même — dates et statut — et non
un simple lien.

---

## 12. `impacts`

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `project_id` | uuid FK → `projects` | `onDelete: Cascade` |
| `beneficiary_id` | uuid FK nullable | `onDelete: SetNull` — nul si l'impact est collectif |
| `title` | varchar(180) | |
| `description` | text | |
| `indicator` | varchar(120) nullable | `women_trained`, `children_schooled`… |
| `value` | decimal(18,4) nullable | |
| `unit` | varchar(60) nullable | `persons`, `percent`… |
| `measured_at` | date | |

**Index** : `project_id`, `beneficiary_id`, `indicator`.

### Le trio qui rend l'impact agrégeable

```
Projet : Formation professionnelle
Impact : « 25 mères célibataires formées »
   indicator = women_trained
   value     = 25
   unit      = persons
```

Grâce à ce trio, `impactService.getIndicatorTotals()` cumule les mesures d'un même
indicateur : 25 + 18 = **43 femmes formées**. Un indicateur fourni sans valeur est
refusé — il ne serait pas mesurable.

`value` est un `Decimal(18, 4)` et non un entier, afin de mesurer aussi des taux
(taux de réussite scolaire = 87,5 %).

---

## 13. `audit_logs` — le journal financier

| Colonne | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `entity_type` | varchar(60) | `TRANSACTION`, `DONATION`, `EXPENSE`… |
| `entity_id` | uuid | **pas de clé étrangère** (voir ci-dessous) |
| `action` | varchar(60) | `TRANSACTION_CONFIRMED`, `DONATION_ALLOCATED`… |
| `old_data`, `new_data` | jsonb nullable | états avant / après |
| `actor_id` | uuid nullable | réservé à la future authentification |
| `created_at` | timestamptz | |

**Index** : `(entity_type, entity_id)`, `action`, `created_at`.

### Trois choix expliqués

**Aucune clé étrangère.** Le journal référence n'importe quelle entité par le couple
`(entity_type, entity_id)`. Une trace doit survivre à ce qu'elle trace : une contrainte
référentielle empêcherait de conserver l'historique d'une entité supprimée.

**`action` est une chaîne, pas un enum.** Ajouter un événement d'audit ne doit pas
imposer une migration. La sûreté de type est assurée côté TypeScript par le type
`AuditAction` (`src/modules/audit/audit.types.ts`).

**Écrit dans la même transaction que l'opération auditée.** Si l'opération échoue, la
trace n'existe pas ; si elle réussit, la trace existe forcément. Il n'y a pas d'état
intermédiaire où une opération financière serait passée sans laisser de trace.

Les montants sont sérialisés en **chaînes** (`"70000.00"`) et non en nombres JSON :
un `Decimal` converti en flottant perdrait de la précision dans le journal même
censé faire foi.

### Actions tracées

`DONOR_CREATED`, `DONOR_UPDATED`, `DONATION_CREATED`, `DONATION_ACTIVATED`,
`DONATION_COMPLETED`, `DONATION_CANCELLED`, `TRANSACTION_CREATED`,
`TRANSACTION_PROCESSING`, `TRANSACTION_CONFIRMED`, `TRANSACTION_FAILED`,
`TRANSACTION_CANCELLED`, `TRANSACTION_REFUNDED`, `DONATION_ALLOCATED`,
`DONATION_ALLOCATION_REVERSED`, `PROJECT_CREATED`, `PROJECT_STATUS_CHANGED`,
`BUDGET_CREATED`, `BUDGET_STATUS_CHANGED`, `BUDGET_ITEM_CREATED`, `EXPENSE_CREATED`,
`EXPENSE_VALIDATED`, `EXPENSE_PAID`, `EXPENSE_CANCELLED`, `DOCUMENT_ATTACHED`,
`BENEFICIARY_CREATED`, `BENEFICIARY_ENROLLED`, `BENEFICIARY_LEFT_PROJECT`,
`IMPACT_RECORDED`.

---

## Récapitulatif des relations

| Relation | Cardinalité | Suppression |
| --- | --- | --- |
| `donors` → `donations` | 1 — N | `Restrict` |
| `donations` → `transactions` | 1 — N | `Restrict` |
| `payment_methods` → `transactions` | 1 — N | `Restrict` |
| `donations` → `donation_allocations` | 1 — N | `Restrict` |
| `projects` → `donation_allocations` | 1 — N | `Restrict` |
| `project_categories` → `projects` | 1 — N | `Restrict` |
| `projects` → `project_budgets` | 1 — N | `Restrict` |
| `project_budgets` → `budget_items` | 1 — N | `Cascade` |
| `projects` → `expenses` | 1 — N | `Restrict` |
| `project_budgets` → `expenses` | 1 — N (optionnel) | `Restrict` |
| `budget_items` → `expenses` | 1 — N (optionnel) | `Restrict` |
| `expenses` → `supporting_documents` | 1 — N | `Cascade` |
| `projects` ↔ `beneficiaries` | **N — N** via `project_beneficiaries` | `Cascade` |
| `projects` → `impacts` | 1 — N | `Cascade` |
| `beneficiaries` → `impacts` | 1 — N (optionnel) | `SetNull` |

`Restrict` protège tout ce qui touche à l'argent : on ne supprime pas un donateur qui
a donné, ni un don qui a été payé, ni un projet qui a reçu des fonds. `Cascade` ne
s'applique qu'aux dépendances pures, dont l'existence n'a aucun sens sans leur parent
(les lignes d'un budget, les justificatifs d'une dépense).

---

## Ce qui n'est jamais stocké

| Donnée | Pourquoi | Où la trouver |
| --- | --- | --- |
| Montant reçu d'un don | donnée dérivée qui divergerait | calculé depuis `transactions` |
| Fonds d'un projet | idem | affectations − dépenses engagées |
| Budget restant | idem | enveloppe − dépenses engagées |
| Caractère international d'un donateur | déduit du pays | `isInternational(country)` |
| Âge d'un bénéficiaire | change tout seul | calculé depuis `birth_date` |
| Numéro de carte, CVV, coordonnées bancaires | sécurité | jamais collecté |
