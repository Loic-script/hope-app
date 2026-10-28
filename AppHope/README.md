# HOPE — Hope for a Better Life

Plateforme de **donation et de suivi financier** pour l'organisation à but non lucratif
*Hope for a Better Life*, qui accompagne principalement **les enfants orphelins** et
**les mères célibataires** de Madagascar vers une autonomie durable.

Le projet comporte trois couches, développées dans cet ordre :

1. un **backend** métier — services, repositories, règles financières, PostgreSQL ;
2. une **API HTTP** minimale, qui rend ces services joignables depuis un navigateur ;
3. un **frontend React** de donation et de suivi.

```
React  ──►  API HTTP  ──►  Services métier  ──►  Repositories  ──►  Prisma  ──►  PostgreSQL
```

Aucune règle financière ne vit ailleurs que dans les services. L'API valide la forme
des requêtes et traduit les erreurs en codes HTTP ; le navigateur affiche et n'arbitre
rien.

---

## Démarrage rapide

```bash
npm install                       # backend
cp .env.example .env              # puis renseignez votre mot de passe PostgreSQL
npm run migrate && npm run seed
npm run api                       # API sur http://localhost:3000/api

cd frontend
npm install && cp .env.example .env
npm run dev                       # site sur http://localhost:5173
```

---

## Sommaire

1. [Ce que fait la plateforme](#1-ce-que-fait-la-plateforme)
2. [Pourquoi Donation et Transaction sont séparées](#2-pourquoi-donation-et-transaction-sont-séparées)
3. [Prérequis](#3-prérequis)
4. [Installation](#4-installation)
5. [Configuration PostgreSQL](#5-configuration-postgresql)
6. [Variables d'environnement](#6-variables-denvironnement)
7. [Migrations](#7-migrations)
8. [Seeds](#8-seeds)
9. [Scripts de démonstration](#9-scripts-de-démonstration)
10. [Tests](#10-tests)
11. [Structure des dossiers](#11-structure-des-dossiers)
12. [Architecture](#12-architecture)
13. [Le module de paiement](#13-le-module-de-paiement)
14. [Règles métier principales](#14-règles-métier-principales)
15. [Modèle de données](#15-modèle-de-données)
16. [Utiliser les services](#16-utiliser-les-services)
17. [L'API HTTP](#17-lapi-http)
18. [Le frontend](#18-le-frontend)
19. [Décisions d'implémentation](#19-décisions-dimplémentation)
20. [Prochaines étapes](#20-prochaines-étapes)

---

## 1. Ce que fait la plateforme

| Domaine | Capacités |
| --- | --- |
| **Site public** | Découvrir HOPE, ses activités, ses projets ; comprendre l'usage des dons ; donner en quelques étapes ; recevoir une référence de transaction. |
| **Donateurs** | Particuliers, entreprises, fondations, organisations, partenaires. Le caractère *international* est **déduit du pays**, jamais stocké. |
| **Dons** | Ponctuels et récurrents (mensuel, trimestriel, annuel), avec cycle de vie et calcul de l'engagement restant. |
| **Paiements** | Méthodes locales (MVola, Orange Money, virement, dépôt, espèces) et internationales (carte, virement international, plateforme). Abstraction de fournisseur extensible. |
| **Transactions** | Création, mise en attente, confirmation, échec, annulation, remboursement total ou partiel, avec transitions de statut contrôlées. |
| **Affectations** | Dons affectés (choix du donateur) ou non affectés (répartis par HOPE), y compris la répartition d'un même don sur plusieurs projets. |
| **Projets** | Catégories, cycle de vie, situation financière par devise. |
| **Budgets** | Plusieurs budgets par projet, découpés en lignes budgétaires. |
| **Dépenses** | Cycle brouillon → validée → payée, avec double plafond budget / trésorerie. |
| **Justificatifs** | Enregistrement des métadonnées des factures, reçus et preuves bancaires. |
| **Bénéficiaires** | Orphelins, mères célibataires, familles ; relation N-N avec les projets. |
| **Impact** | Indicateurs mesurables et agrégeables par projet. |
| **Audit** | Journal immuable des opérations financières sensibles. |

---

## 2. Pourquoi Donation et Transaction sont séparées

C'est **le point central du modèle**, et la source d'erreur la plus fréquente dans
les plateformes de dons.

> Un **DON** est une **intention**, un **engagement** du donateur.
> Une **TRANSACTION** est un **mouvement d'argent réel**.

Elles ne vivent pas au même rythme, ne portent pas les mêmes informations, et ne
peuvent donc pas être la même table.

### L'exemple qui rend la séparation évidente

Une donatrice s'engage à donner **50 000 MGA par mois pendant 12 mois**.

```
DONATION  (1 seule ligne)
  reference        HOPE-DON-20260903-KWP7C3
  donationType     RECURRING
  frequency        MONTHLY
  expectedAmount   50 000 MGA   <-- par échéance
  startDate        2026-01-15
  endDate          2026-12-15
      |
      ├── TRANSACTION #1  janvier   50 000 MGA   SUCCESS     <- encaissé
      ├── TRANSACTION #2  février   50 000 MGA   SUCCESS     <- encaissé
      ├── TRANSACTION #3  mars      50 000 MGA   FAILED      <- solde insuffisant
      ├── TRANSACTION #4  avril     50 000 MGA   SUCCESS     <- encaissé
      ├── TRANSACTION #5  mai       50 000 MGA   PROCESSING  <- pas encore encaissé
      └── TRANSACTION #6  juin      50 000 MGA   SUCCESS     <- encaissé
```

**1 don, 6 transactions.** Et surtout :

| Question | Réponse | Où la lire |
| --- | --- | --- |
| Combien la donatrice s'est-elle engagée à donner ? | 600 000 MGA | `summary.totalCommitted` |
| Combien HOPE a-t-elle **réellement reçu** ? | **200 000 MGA** | `summary.totalReceived` |
| Combien est annoncé mais pas encaissé ? | 50 000 MGA | `summary.totalPending` |
| Combien a échoué ? | 50 000 MGA | `summary.totalFailed` |
| Combien peut être affecté à des projets ? | **200 000 MGA** | `summary.availableForAllocation` |

Si l'on fusionnait les deux notions, on ne saurait plus répondre à ces questions :
l'échec de mars effacerait l'engagement, ou pire, l'engagement serait compté comme de
l'argent reçu — et HOPE affecterait à des projets un argent qu'elle n'a pas.

**Conséquence pratique :** seules les transactions `SUCCESS` alimentent les fonds.
Une échéance `FAILED` ne s'annule pas et ne se « répare » pas non plus : elle reste
dans l'historique, et une **nouvelle** transaction est créée pour la retenter.

Pour le voir tourner : `npm run demo:monthly`.

---

## 3. Prérequis

| Outil | Version | Vérifier |
| --- | --- | --- |
| Node.js | ≥ 20 (testé sur 24) | `node -v` |
| npm | ≥ 10 | `npm -v` |
| PostgreSQL | ≥ 14 (testé sur 17) | `psql --version` |

---

## 4. Installation

```bash
npm install
```

---

## 5. Configuration PostgreSQL

Le projet fonctionne **entièrement en local**. Deux bases sont utilisées :

| Base | Rôle |
| --- | --- |
| `hope_donations` | développement |
| `hope_donations_test` | tests d'intégration (vidée à chaque test) |

### Créer la base

La commande suivante crée la base indiquée dans `DATABASE_URL` si elle n'existe pas :

```bash
npm run db:create
```

`npm run migrate` la crée également au besoin. La base de test, elle, est créée
automatiquement au premier lancement de `npm test`.

---

## 6. Variables d'environnement

Copiez le modèle et renseignez vos valeurs :

```bash
cp .env.example .env
```

```dotenv
DATABASE_URL="postgresql://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/hope_donations"
TEST_DATABASE_URL="postgresql://postgres:VOTRE_MOT_DE_PASSE@localhost:5432/hope_donations_test"
NODE_ENV="development"
LOG_LEVEL="info"
DEFAULT_CURRENCY="MGA"
DEFAULT_PAYMENT_PROVIDER="MOCK"
```

> **Sécurité** — `.env` est dans `.gitignore` et ne doit **jamais** être commité.
> Aucun identifiant n'est écrit en dur dans le code : tout passe par
> [`src/config/env.ts`](src/config/env.ts).

En mode test (`NODE_ENV=test`), la configuration bascule automatiquement sur
`TEST_DATABASE_URL` : la base de développement n'est jamais touchée par les tests.

---

## 7. Migrations

```bash
npm run migrate              # crée et applique une migration (développement)
npm run migrate:deploy       # applique les migrations existantes
npm run migrate:reset        # ATTENTION : réinitialise complètement la base
npm run prisma:validate      # valide le schéma
npm run prisma:generate      # régénère le client Prisma
npm run studio               # explorateur graphique de la base
```

---

## 8. Seeds

```bash
npm run seed
```

Le seed est **idempotent** : on peut le relancer sans créer de doublon. Il alimente :

- **8 méthodes de paiement** — `MVOLA`, `ORANGE_MONEY`, `BANK_TRANSFER`, `BANK_DEPOSIT`,
  `CASH` (locales) ; `CARD`, `INTERNATIONAL_BANK_TRANSFER`, `PAYMENT_PLATFORM`
  (internationales) ;
- **7 catégories de projet** — Scolarité, Soins, Alimentation, Employabilité,
  Formation professionnelle, Soutien social, Urgence ;
- **5 projets HOPE fictifs**, dont un accompagné d'un budget d'exemple avec ses lignes.

Il ne crée **ni donateur, ni don, ni transaction** : ces données appartiennent aux
scripts de démonstration.

---

## 9. Scripts de démonstration

Trois scénarios exécutables montrent le backend en action, **sans aucune API**.

### `npm run demo:donation` — don ponctuel de 100 000 MGA via MVola

1. création d'une donatrice malgache ;
2. sélection d'un projet ;
3. création du don (100 000 MGA) ;
4. choix de MVola ;
5. création de la transaction (`PENDING`) ;
6. simulation du paiement avec `MockPaymentProvider` ;
7. confirmation (`SUCCESS`) ;
8. affectation de 70 000 MGA au projet ;
9. 30 000 MGA restent non affectés ;
10. tentative d'affectation de 50 000 MGA → **refusée**, avec le détail du solde.

### `npm run demo:monthly` — don mensuel : 1 DON, N TRANSACTIONS

Six échéances de 50 000 MGA, dont une **échouée** et une **restée en attente**, pour
démontrer que le montant reçu (200 000 MGA) n'est ni l'engagement (300 000 MGA) ni la
somme des échéances créées.

### `npm run demo:project` — cycle de vie complet d'un projet

Donatrice internationale (France, EUR, carte), répartition d'un don de 1 000 EUR sur
**trois projets**, budget et lignes budgétaires, dépense validée puis payée,
justificatif, inscription de bénéficiaires, mesures d'impact, et quatre garde-fous
déclenchés volontairement.

---

## 10. Tests

```bash
npm test              # toute la suite
npm run test:watch    # mode interactif
```

**232 tests** cote backend, repartis en :

- **tests unitaires** (`src/tests/unit/`) — logique pure, sans base de données :
  arithmétique décimale, machines à états, calcul des échéances, simulateur de paiement ;
- **tests d'intégration** (`src/tests/integration/`) — sur une **vraie base PostgreSQL** :
  `DonationService`, `PaymentService`, `AllocationService`, `ExpenseService`,
  `BudgetService`, `BeneficiaryService`, `ImpactService`, `ProjectService`, et la
  **couche HTTP** (`api.test.ts`), démarrée en mémoire sur un port libre — pas de
  serveur à lancer à côté, pas de port fixe qui entrerait en conflit.

La base de test est créée et migrée automatiquement, puis vidée avant chaque test.

### Validation complète

```bash
# Backend
npm run verify        # typecheck + prisma validate + migrations + seed + tests
npm run verify:full   # idem, puis les trois scripts de démonstration

# Frontend
cd frontend && npm run typecheck && npm run lint && npm run build

# Bout en bout : API + site + navigateur réel
npm run e2e           # 39 vérifications sur le parcours de don complet
```

---

## 11. Structure des dossiers

```
prisma/
├── schema.prisma              # modèle de données complet
├── migrations/                # migrations SQL versionnées
└── seed.ts                    # données de référence (idempotent)

src/
├── config/
│   └── env.ts                 # chargement et validation du .env
├── database/
│   ├── prisma.ts              # client Prisma unique
│   └── unit-of-work.ts        # transactions PostgreSQL SERIALIZABLE + rejeu
├── shared/
│   ├── money.ts               # arithmétique décimale (jamais de float)
│   ├── currency.ts            # devises supportées, aucune conversion
│   ├── geography.ts           # pays, déduction du caractère international
│   ├── errors.ts              # hiérarchie d'erreurs métier
│   ├── state-machine.ts       # machine à états générique
│   ├── reference.ts           # références lisibles HOPE-XXX-...
│   ├── validation.ts          # validation des entrées
│   ├── types.ts               # DbClient, pagination
│   ├── logger.ts              # journalisation
│   └── run-script.ts          # utilitaires des scripts exécutables
├── modules/
│   ├── donors/                # donateurs
│   ├── donations/             # dons (engagements) + règles d'échéances
│   ├── payments/              # MODULE PRIORITAIRE
│   │   ├── providers/
│   │   │   ├── payment-provider.interface.ts
│   │   │   ├── mock-payment.provider.ts
│   │   │   └── provider.registry.ts
│   │   ├── transaction.repository.ts
│   │   ├── payment-method.repository.ts
│   │   ├── transaction-status.ts
│   │   └── payment.service.ts
│   ├── allocations/           # affectation des dons aux projets
│   ├── projects/              # projets et catégories
│   ├── budgets/               # budgets et lignes budgétaires
│   ├── expenses/              # dépenses
│   ├── documents/             # justificatifs (métadonnées)
│   ├── beneficiaries/         # bénéficiaires et inscriptions
│   ├── impacts/               # indicateurs d'impact
│   └── audit/                 # journal financier
├── scripts/
│   ├── create-database.ts
│   ├── demo-donation.ts
│   ├── demo-monthly.ts
│   ├── demo-project.ts
│   └── unpublish-demo-projects.ts
├── api/                       # COUCHE HTTP (aucune règle métier)
│   ├── server.ts              # application Express, CORS, journalisation
│   ├── index.ts               # démarrage du serveur
│   ├── routes/                # projets, catalogue, dons, transactions, checkout
│   ├── presenters/            # assemblage des vues publiques
│   ├── dto/mappers.ts         # entités → JSON (montants en chaînes)
│   └── middleware/            # validation Zod, erreurs, limite de débit
├── tests/
│   ├── unit/
│   ├── integration/           # dont api.test.ts
│   ├── helpers/
│   └── global-setup.ts
├── container.ts               # composition root
└── index.ts                   # point d'entrée (exports publics)

frontend/                      # SITE REACT — voir frontend/README.md
├── src/
│   ├── components/            # design system + composants métier
│   ├── pages/                 # accueil, projets, don, transparence…
│   ├── services/              # client Axios + services par domaine
│   ├── hooks/useApi.ts        # requêtes React Query
│   ├── types/api.ts           # miroir des réponses du backend
│   └── styles/index.css       # tokens du design system
└── e2e/                       # parcours de don piloté par Playwright

scripts/
├── e2e.sh                     # démarre API + site, joue le parcours complet
└── screenshots.sh             # captures d'écran des pages

docs/
├── database.md                # description détaillée des tables
└── database-erd.md            # diagramme entité-association (Mermaid)
```

---

## 12. Architecture

Trois couches, une responsabilité chacune.

```
   Script / test / (plus tard : contrôleur HTTP)
                    |
                    v
   ┌────────────────────────────────────┐
   │  SERVICE            logique métier │   règles, validations, transactions
   │  DonationService, PaymentService…  │   PostgreSQL, journal d'audit
   └────────────────────────────────────┘
                    |
                    v
   ┌────────────────────────────────────┐
   │  REPOSITORY        accès aux données│   requêtes Prisma uniquement,
   │  TransactionRepository, …          │   aucune règle métier
   └────────────────────────────────────┘
                    |
                    v
              PostgreSQL
```

### Repository pattern

Les services **n'utilisent jamais Prisma directement**. Chaque repository expose des
méthodes explicites (`findByDonationId`, `sumNetReceived`, `getDonationTotals`…) et ne
contient aucune décision métier. Cela permet de tester la logique en remplaçant un
repository, et de faire évoluer les requêtes sans toucher aux règles.

### Injection de dépendances

Chaque service reçoit ses dépendances par constructeur, avec une valeur par défaut :

```ts
export class PaymentService {
  constructor(
    private readonly transactionRepository = new TransactionRepository(),
    private readonly paymentMethodRepository = new PaymentMethodRepository(),
    private readonly allocationRepository = new AllocationRepository(),
    private readonly auditService = new AuditService(),
    private readonly providers = paymentProviderRegistry,
  ) {}
}
```

Le graphe complet est assemblé une seule fois dans
[`src/container.ts`](src/container.ts) :

```ts
const { services } = createContainer();
```

### Transactions PostgreSQL

Toute opération financière comportant plusieurs écritures liées passe par
[`runInTransaction`](src/database/unit-of-work.ts), en isolation **SERIALIZABLE** —
le seul niveau qui empêche réellement deux affectations concurrentes de dépasser
ensemble les fonds disponibles. Les conflits de sérialisation (`40001`) sont rejoués
automatiquement, et les lignes sensibles sont verrouillées (`SELECT … FOR UPDATE`).

---

## 13. Le module de paiement

### Abstraction de fournisseur (Strategy / Adapter)

`PaymentService` ne connaît **que** l'interface
[`PaymentProvider`](src/modules/payments/providers/payment-provider.interface.ts) :

```ts
interface PaymentProvider {
  readonly code: string;
  supports(paymentMethodCode: string, currency: string): boolean;
  initializePayment(context: PaymentContext): Promise<PaymentProviderResult>;
  confirmPayment(context: PaymentContext): Promise<PaymentProviderResult>;
  cancelPayment(context: PaymentContext): Promise<PaymentProviderResult>;
  refundPayment(context: RefundContext): Promise<PaymentProviderResult>;
  getPaymentStatus(context: PaymentContext): Promise<PaymentProviderResult>;
}
```

La colonne `payment_methods.provider` porte le **code** du fournisseur, et le registre
fait la correspondance code → implémentation. **Phase 1 : uniquement
`MockPaymentProvider`, aucun appel réseau.**

### Brancher un vrai prestataire plus tard

```ts
// 1. écrire l'adaptateur
class StripePaymentProvider implements PaymentProvider { /* … */ }

// 2. l'enregistrer
paymentProviderRegistry.register(new StripePaymentProvider(config));

// 3. pointer la méthode de paiement vers lui, en base
//    UPDATE payment_methods SET provider = 'STRIPE' WHERE code = 'CARD';
```

**Aucune ligne de `PaymentService` ne change.**

### Piloter le simulateur

`MockPaymentProvider` lit `transactions.metadata.mock`, ce qui permet de rejouer
n'importe quel scénario sans truquer le service :

```ts
// Échec dès l'initialisation (numéro invalide, carte expirée…)
{ mock: { outcome: 'FAILURE', failureReason: 'Numéro MVola inconnu.' } }

// Initialisation réussie, mais encaissement refusé (provision insuffisante)
{ mock: { confirm: { outcome: 'FAILURE', failureReason: 'Solde insuffisant.' } } }

// Paiement qui reste en attente
{ mock: { confirm: { outcome: 'PENDING' } } }
```

### Cycle de vie d'une transaction

```
  PENDING ──────► PROCESSING ──────► SUCCESS ──────► REFUNDED
     │                │                                (final)
     │                ├──────────► FAILED     (final)
     │                └──────────► CANCELLED  (final)
     └──────────────► SUCCESS / FAILED / CANCELLED
```

Interdictions explicites, vérifiées par
[`transaction-status.ts`](src/modules/payments/transaction-status.ts) :

- `FAILED → SUCCESS` : une tentative échouée ne redevient jamais réussie — il faut
  créer une **nouvelle** transaction ;
- `SUCCESS → CANCELLED` : de l'argent encaissé se **rembourse**, il ne s'annule pas ;
- `CANCELLED`, `FAILED`, `REFUNDED` sont **finaux**.

### Appels prestataire hors transaction SQL

Chaque opération se déroule en trois temps : **lecture et validation**, puis **appel au
prestataire hors transaction PostgreSQL**, puis **écriture** dans une transaction
courte après revalidation du statut.

Ce découpage n'est pas cosmétique. Quand le prestataire refuse un paiement, il faut à
la fois **enregistrer l'échec** et **lever une erreur** — deux actions incompatibles
dans une même transaction, puisque le `throw` déclencherait un rollback qui effacerait
l'échec et laisserait la transaction faussement `PENDING`.

---

## 14. Règles métier principales

| # | Règle | Où elle est appliquée |
| --- | --- | --- |
| 1 | Les montants sont des `Decimal`, **jamais** des flottants | `shared/money.ts`, colonnes `Decimal(18, 2)` |
| 2 | Une transaction `FAILED` ne compte pas dans le montant reçu | `transaction-status.ts` |
| 3 | Une transaction `PENDING` ne compte pas dans le montant reçu | `transaction-status.ts` |
| 4 | Seules les transactions `SUCCESS` alimentent les fonds | `TransactionRepository.getDonationTotals` |
| 5 | Les affectations ne dépassent jamais le montant reçu | `AllocationService.allocateMany` |
| 6 | Une dépense ne dépasse ni le budget, ni la trésorerie du projet | `ExpenseService.checkAffordability` |
| 7 | Les transitions de statut incohérentes sont refusées | `shared/state-machine.ts` |
| 8 | Une transaction confirmée n'est jamais supprimée | `refundTransaction` conserve la ligne |
| 9 | Tout remboursement est traçable | `refundedAmount`, `refundedAt`, `refundReason`, `audit_logs` |
| 10 | Les écritures liées sont atomiques | `runInTransaction` (SERIALIZABLE) |

### Deux plafonds différents pour une dépense

Un projet peut avoir un **budget voté de 5 000 EUR** et ne pouvoir dépenser que
**1 200 EUR** s'il n'a reçu que 1 200 EUR. Les deux contrôles sont indépendants :

- le **budget** est une *prévision* : combien on prévoit de dépenser ;
- les **fonds du projet** sont du *cash* : combien a réellement été encaissé puis affecté.

### Sécurité des paiements

Le backend ne stocke **jamais** de numéro de carte, de CVV, de coordonnées bancaires ni
d'identifiant prestataire. Seules des **références opaques** (`providerReference`)
renvoyées par les prestataires sont conservées.

---

## 15. Modèle de données

15 tables. Description détaillée dans [`docs/database.md`](docs/database.md),
diagramme complet dans [`docs/database-erd.md`](docs/database-erd.md).

```mermaid
erDiagram
    DONOR ||--o{ DONATION : "s'engage"
    DONATION ||--o{ TRANSACTION : "génère"
    PAYMENT_METHOD ||--o{ TRANSACTION : "utilisée par"
    DONATION ||--o{ DONATION_ALLOCATION : "répartie en"
    PROJECT ||--o{ DONATION_ALLOCATION : "reçoit"
    PROJECT_CATEGORY ||--o{ PROJECT : "classe"
    PROJECT ||--o{ PROJECT_BUDGET : "planifie"
    PROJECT_BUDGET ||--o{ BUDGET_ITEM : "détaille"
    PROJECT ||--o{ EXPENSE : "dépense"
    PROJECT_BUDGET ||--o{ EXPENSE : "impute"
    BUDGET_ITEM ||--o{ EXPENSE : "impute"
    EXPENSE ||--o{ SUPPORTING_DOCUMENT : "justifiée par"
    PROJECT ||--o{ PROJECT_BENEFICIARY : "accompagne"
    BENEFICIARY ||--o{ PROJECT_BENEFICIARY : "participe à"
    PROJECT ||--o{ IMPACT : "mesure"
    BENEFICIARY ||--o{ IMPACT : "concerné par"
```

---

## 16. Utiliser les services

Les services sont independants de tout transport.

```ts
import { createContainer, disconnectPrisma } from './src/index.js';

const { services } = createContainer();

// 1. Un donateur
const donor = await services.donorService.createDonor({
  firstName: 'Tiana',
  lastName: 'Rakotomalala',
  email: 'tiana@example.mg',
  phone: '+261 34 12 345 67',
  donorType: 'INDIVIDUAL',
  country: 'MG',              // le caractère international en est déduit
  preferredCurrency: 'MGA',
});

// 2. Un don : une INTENTION, pas encore de l'argent
const donation = await services.donationService.createDonation({
  donorId: donor.id,
  donationType: 'ONE_TIME',
  currency: 'MGA',
  expectedAmount: '100000',
  status: 'ACTIVE',
});

// 3. Une transaction : le mouvement d'argent
const transaction = await services.paymentService.createTransaction({
  donationId: donation.id,
  paymentMethodCode: 'MVOLA',
});

// 4. La confirmation : c'est ici que l'argent devient disponible
await services.paymentService.confirmTransaction(transaction.id);

// 5. L'affectation à un projet
await services.allocationService.allocate({
  donationId: donation.id,
  projectId: project.id,
  amount: '70000',
  allocationType: 'DONOR_DESIGNATED',
});

// 6. La photographie financière du don
const summary = await services.donationService.getFinancialSummary(donation.id);
// summary.totalReceived           -> 100 000
// summary.totalAllocated          ->  70 000
// summary.availableForAllocation  ->  30 000

await disconnectPrisma();
```

### Gestion des erreurs

Toutes les erreurs métier héritent de `AppError` et portent un `code` stable :

```ts
import { AppError, InsufficientFundsError } from './src/index.js';

try {
  await services.allocationService.allocate({ /* … */ });
} catch (error) {
  if (error instanceof InsufficientFundsError) {
    console.error(error.code);     // "INSUFFICIENT_FUNDS"
    console.error(error.message);  // message explicite, avec les montants
    console.error(error.details);  // { donationId, requested, available, currency }
  }
}
```

| Code | Signification |
| --- | --- |
| `VALIDATION_ERROR` | donnée d'entrée invalide |
| `NOT_FOUND` | entité introuvable |
| `CONFLICT` | doublon (email, catégorie, inscription…) |
| `BUSINESS_RULE_VIOLATION` | règle métier violée |
| `INVALID_STATUS_TRANSITION` | transition de statut interdite |
| `INSUFFICIENT_FUNDS` | fonds insuffisants |
| `PAYMENT_PROVIDER_ERROR` | problème côté prestataire |

---

## 17. L'API HTTP

```bash
npm run api          # rechargement automatique, http://localhost:3000/api
npm run api:start    # exécution simple
```

Cette couche n'a qu'une raison d'être : rendre les services métier joignables depuis
un navigateur. **Elle ne décide rien.**

```
Requête  →  validation de forme (Zod)  →  SERVICE existant  →  repository  →  Prisma
```

### Points d'entrée

| Méthode | Route | Rôle |
| --- | --- | --- |
| `GET` | `/api/health` | sonde de disponibilité |
| `GET` | `/api/projects` | projets publiés — filtres `search`, `categoryId`, `status` |
| `GET` | `/api/projects/:id` | fiche complète (identifiant **ou** code `HOPE-PRJ-…`) |
| `GET` | `/api/projects/:id/impacts` | impacts et indicateurs du projet |
| `GET` | `/api/projects/:id/budgets` | budgets et lignes budgétaires |
| `GET` | `/api/project-categories` | catégories |
| `GET` | `/api/payment-methods?country=MG` | moyens de paiement **décidés par le backend** |
| `GET` | `/api/stats` | chiffres clés du site |
| `GET` | `/api/impacts` | indicateurs cumulés, tous projets |
| `POST` | `/api/donors` | crée un donateur, ou renvoie l'existant si l'email est connu |
| `POST` | `/api/donations` | crée un engagement |
| `GET` | `/api/donations/:id` | l'engagement, ses échéances, sa répartition |
| `GET` | `/api/donations/:id/transactions` | échéances d'un don |
| `POST` | `/api/donations/:id/transactions` | nouvelle échéance sur un don mensuel |
| `POST` | `/api/donations/:id/allocations` | affecte un montant à un projet |
| `GET` | `/api/transactions/:id` | par identifiant **ou** référence `HOPE-TXN-…` |
| `POST` | `/api/transactions/:id/process` | demande l'encaissement au prestataire |
| `POST` | `/api/checkout` | **parcours de don complet, en une requête** |

### Pourquoi `/api/checkout` existe

Le formulaire du site recueille tout, puis envoie l'ensemble. Le serveur enchaîne
alors : donateur → don → transaction → prestataire → affectation.

Faire enchaîner cinq requêtes au navigateur exposerait le donateur à un parcours
interrompu en plein milieu — connexion coupée, onglet fermé — sans savoir si son
argent est parti. L'enchaînement appartient donc au serveur. Toute la logique vit
dans [`CheckoutService`](src/modules/checkout/checkout.service.ts) : le contrôleur ne
fait que valider et traduire.

Les points d'entrée unitaires restent disponibles pour les cas particuliers.

### Deux conventions à connaître

**Les montants sont des chaînes.** `JSON.parse` d'un nombre passe par un flottant
64 bits : `"100000.10"` pourrait revenir en `100000.09999999999`. La règle « jamais de
flottant pour l'argent » ne s'arrête pas à la base, elle va jusqu'au navigateur.

**Un paiement refusé n'est pas une erreur HTTP.** `/api/checkout` répond `201` avec
`outcome: "FAILED"` et le motif : les entités ont bien été créées, seul le paiement a
été refusé. C'est une information métier, pas un incident technique.

### Traduction des erreurs

Les services lèvent des `AppError` portant un `code` stable. C'est
[`middleware/error-handler.ts`](src/api/middleware/error-handler.ts), et lui seul, qui
en fait un statut HTTP :

| Code métier | HTTP |
| --- | --- |
| `VALIDATION_ERROR` | 400 |
| `NOT_FOUND` | 404 |
| `CONFLICT`, `INVALID_STATUS_TRANSITION` | 409 |
| `BUSINESS_RULE_VIOLATION`, `INSUFFICIENT_FUNDS` | 422 |
| `PAYMENT_PROVIDER_ERROR` | 502 — la panne vient d'un tiers, pas de HOPE |

Ajouter demain une API GraphQL ne demanderait qu'un autre traducteur, sans toucher à
un seul service.

### Sécurité

- **CORS** restreint aux origines connues, jamais `*`. Origines supplémentaires via
  `CORS_ALLOWED_ORIGINS` (séparées par des virgules).
- **Limite de débit** sur les écritures : 20 requêtes/minute, 10 pour `/api/checkout`.
  Neutralisée pendant les tests, et testée séparément.
- **Corps limité à 64 ko** : un don pèse quelques centaines d'octets.
- **Rien de superflu n'est exposé** : chaque mappeur liste explicitement ses champs.
  Ni `providerReference`, ni `metadata`, ni téléphone de donateur, ni nom de
  bénéficiaire ne sortent de l'API.

### Protection des bénéficiaires

Les bénéficiaires sont des personnes vulnérables, souvent mineures. L'API ne publie
**ni nom, ni prénom, ni date de naissance** : seulement une référence anonyme, un type
d'accompagnement, une ville et une **tranche** d'âge.

---

## 18. Le frontend

```bash
cd frontend
npm install && cp .env.example .env
npm run dev      # http://localhost:5173
```

React 19, Vite, TypeScript, React Router, Tailwind v4, TanStack Query, React Hook Form,
Zod, Axios, Lucide. Documentation détaillée : [`frontend/README.md`](frontend/README.md).

### Pages

`/` · `/activities` · `/projects` · `/projects/:id` · `/donate` ·
`/projects/:id/donate` · `/impact` · `/transparency` · `/about` · `/contact` ·
`/partner` · `/donation/success/:transactionId` · `/donation/failed` · 404

### Ce que le navigateur ne fait jamais

| Il ne… | Parce que |
| --- | --- |
| …décide jamais qu'un paiement a réussi | Il lit le champ `outcome` calculé par le serveur. |
| …calcule jamais un montant | Les montants transitent en chaînes et sont seulement mis en forme. |
| …filtre jamais les moyens de paiement | Le backend décide, à partir du pays. |
| …n'accède jamais à PostgreSQL | Il ne connaît que des URL HTTP. |
| …ne stocke aucune donnée bancaire | Aucun champ de carte n'existe dans le code. |

### Une décision de design dictée par l'accessibilité

La charte impose l'orange `#E09735` pour l'action principale. Mesure de contraste :

| Combinaison | Contraste | Verdict |
| --- | --- | --- |
| blanc sur `#E09735` | **2,43:1** | échoue (AA demande 4,5:1) |
| encre `#353343` sur `#E09735` | **5,07:1** | conforme |

Le bouton primaire est donc **orange à texte encre**, jamais blanc. De même, l'orange
*écrit* utilise une déclinaison foncée (`#96600F`, 5,28:1) ; l'orange vif reste réservé
aux aplats.

### Tests de bout en bout

```bash
npm run e2e          # 39 vérifications, navigateur réel, pile complète
npm run e2e:shots    # captures d'écran
```

Le script joue le parcours réel — accueil, projets, fiche projet, don de 100 000 MGA
par MVola, confirmation — puis un second parcours avec paiement refusé. Il vérifie
enfin les repères d'accessibilité et l'absence de débordement horizontal de 320 px à
1440 px.

Le point décisif : le script lit la référence affichée à l'écran, **puis interroge
l'API** pour confirmer que cette transaction existe en base avec ce statut. Une
référence fabriquée par le navigateur échouerait ici.

---

## 19. Décisions d'implémentation

Choix faits en l'absence de consigne explicite, documentés pour pouvoir être discutés.

| Décision | Raison |
| --- | --- |
| **Devise en `Char(3)` plutôt qu'un enum** | Ajouter une devise ne doit pas imposer une migration. La liste autorisée est validée dans `shared/currency.ts`. |
| **Aucune conversion de devise** | Chaque devise est un compte séparé. Un projet financé en MGA et en EUR a **deux** soldes distincts, jamais additionnés. Introduire des taux de change demanderait une table de taux datés — hors périmètre de cette phase. |
| **`audit_logs.action` en `String`, pas en enum** | Ajouter un événement d'audit ne doit pas imposer une migration ; la sûreté de type est assurée par le type TypeScript `AuditAction`. |
| **Remboursements partiels** | `refunded_amount` permet un remboursement partiel : la transaction reste `SUCCESS` avec un montant net réduit. Un remboursement total la fait passer en `REFUNDED`. La ligne est conservée dans les deux cas. |
| **Un remboursement peut être refusé** | Rembourser un montant déjà affecté à des projets violerait la règle n°5. Il faut d'abord annuler les affectations concernées. |
| **Une dépense `DRAFT` ne consomme pas les fonds** | Seuls `VALIDATED` et `PAID` les consomment. Le contrôle est néanmoins rejoué **dès la création**, pour signaler l'incohérence tout de suite. |
| **Champs ajoutés au-delà du minimum demandé** | `donations.reference`, `projects.code`, `expenses.reference`, `beneficiaries.reference` (références lisibles) ; `donors.organization_name` (raison sociale des entreprises et fondations) ; `transactions.installment_number`, `refunded_amount`, `refunded_at`, `refund_reason` ; `payment_methods.supported_currencies` ; `expenses.validated_at`, `paid_at`. |
| **Unicité `(project_id, beneficiary_id)`** | Empêche une double inscription au même projet. Une réinscription ultérieure demanderait de lever cette contrainte. |
| **Isolation `SERIALIZABLE` par défaut** | Seul niveau qui empêche réellement le « lire le solde puis écrire » concurrent. Les conflits sont rejoués automatiquement. |
| **`prisma.config.ts` plutôt que `package.json#prisma`** | Ce dernier est déprécié et sera supprimé dans Prisma 7. |
| **Un point d'entrée `/api/checkout` en plus des routes unitaires** | Un parcours de don qui enchaînerait cinq requêtes depuis le navigateur peut s'interrompre au milieu, laissant le donateur sans savoir si son argent est parti. L'orchestration appartient au serveur, dans un service dédié — pas dans le contrôleur. |
| **Les montants circulent en chaînes sur l'API** | `JSON.parse` d'un nombre passe par un flottant 64 bits. La règle « jamais de flottant pour l'argent » ne s'arrête pas à la base : elle va jusqu'au navigateur. |
| **Un paiement refusé répond 201, pas 5xx** | Les entités ont bien été créées ; seul le paiement a échoué. C'est une information métier, pas un incident technique — et une 5xx ferait croire à une panne de HOPE. |
| **Objectif de financement = somme des budgets ouverts du projet** | Le modèle n'a pas de colonne « montant à collecter », et en ajouter une inventerait un chiffre marketing. Un budget est précisément ce que l'équipe prévoit de dépenser. Un projet sans budget n'affiche pas d'objectif, seulement le montant collecté. |
| **Bouton primaire orange à texte encre, jamais blanc** | Le blanc sur `#E09735` donne 2,43:1, loin du seuil WCAG AA de 4,5:1. L'encre `#353343` atteint 5,07:1. L'accessibilité tranche — et le résultat est plus chaleureux. |
| **Les scripts de démonstration laissent leurs projets en `DRAFT`** | L'API publique ne montre que les projets `ACTIVE` et `COMPLETED`, alors qu'un projet `DRAFT` reste finançable. Les démonstrations se déroulent donc normalement sans encombrer la vitrine de projets de test. |
| **`npm run db:unpublish-demo` dépublie au lieu de supprimer** | Ces projets ont reçu de vraies affectations issues de vraies transactions. Les supprimer effacerait des écritures financières (règle n°8). Le passage en `CANCELLED` est journalisé et réversible. |
| **Le contenu affiché porte les accents, les commentaires non** | Les commentaires du dépôt les évitent pour écarter tout souci d'encodage entre Windows, PostgreSQL et Git. Cette règle ne vaut pas pour le contenu : un site affichant « meres celibataires » à des donateurs francophones perdrait en crédibilité. Le seed reconnaît les anciennes orthographes (`previousNames`) et renomme au lieu de dupliquer. |

### Note sur `npm audit`

`npm audit` signale 3 alertes de gravité *high* provenant de la chaîne
`prisma → @prisma/config → deepmerge-ts`. Elles concernent **la CLI Prisma en
développement uniquement** (jamais le code exécuté en production) et aucune version
stable de Prisma ne les corrige à ce jour. À revoir lors du passage à Prisma 7.

---

## 20. Prochaines étapes

Hors périmètre de cette phase, mais l'architecture y est préparée :

- **Authentification et espace donateur** — `audit_logs.actor_id` est déjà prévu,
  nullable. Un donateur pourrait alors retrouver l'historique de ses dons et résilier
  lui-même un engagement mensuel.
- **Espace d'administration** — les services de budget, dépense, justificatif,
  bénéficiaire et impact existent déjà, mais ne sont pilotables qu'en ligne de
  commande. Il ne manque que des écrans.
- **Prestataires de paiement réels** — Stripe, PayPal, MVola API, Orange Money API :
  une classe par prestataire, enregistrée dans le registre. Aucune ligne de
  `PaymentService` ni du frontend n'aurait à changer.
- **Upload de justificatifs** — le modèle stocke déjà les métadonnées ; il ne manque
  que le transfert de fichiers et le stockage.
- **Planificateur d'échéances** — `DonationService.listDueDonations()` renvoie déjà les
  dons récurrents dont l'échéance est due.
- **Conversion de devises** — nécessiterait une table de taux datés et une décision
  comptable sur la date de conversion retenue.
