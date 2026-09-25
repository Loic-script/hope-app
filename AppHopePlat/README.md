# HOPE – Hope for a Better Life

Plateforme de donation et de suivi des activités de **HOPE**, association qui accompagne les
enfants orphelins, les mères célibataires et les familles vulnérables à Madagascar vers une
autonomie durable.

> **Périmètre livré** : l'espace administrateur, les espaces donateur, bénévole et bailleur, les
> pages de paiement (MVola, Orange Money, carte bancaire via Stripe, virement, dépôt, espèces,
> virement international, plateformes de transfert), la messagerie, le mot de passe oublié, la
> politique de confidentialité et les conditions d'utilisation.
>
> **Mise en ligne** : voir [DEPLOIEMENT.md](DEPLOIEMENT.md) (Railway, un seul service).

---

## 1. Le modèle : où va l'argent




C'est le cœur de la plateforme. Tout le reste en découle.

```
                        ┌──────────────────────────────┐
   DON AFFECTÉ ────────►│ le donateur a choisi le      │──► directement au PROJET
   (le donateur choisit)│ projet : HOPE n'en dispose   │
                        │ pas librement                │
                        └──────────────────────────────┘

                        ┌──────────────────────────────┐
   DON NON AFFECTÉ ────►│ FONDS HOPE                   │──► INVESTISSEMENT justifié
   (le donateur laisse  │ librement répartissable      │    (l'admin choisit le projet)
    HOPE décider)       └──────────────────────────────┘

   PROJET ──► ce qu'il a reçu finance ses DÉPENSES
          ──► chaque DÉPENSE est prouvée par un JUSTIFICATIF
          ──► les BÉNÉFICIAIRES sont nommés
          ──► une fois TERMINÉ, il porte son RÉSULTAT et ses IMPACTS
```

Un projet porte un **budget nécessaire** saisi à sa création. Il est couvert par les dons
affectés qu'il reçoit et par les investissements du fonds HOPE. On ne dépense jamais plus que
ce que le projet a réellement reçu.

L'écran **Budget** rend cette mécanique lisible d'un coup d'œil : une barre dont les largeurs
sont proportionnelles aux montants réels, pas une illustration.

---

## 2. Démarrage

### Prérequis
- Node.js ≥ 18 (testé avec Node 24)
- PostgreSQL 17 sur `localhost:5432`

### Backend
```bash
cd backend
cp .env.example .env      # renseigner DB_PASSWORD et JWT_SECRET
npm install
npm run db:setup          # base + schéma + AdminHope + catégories de projet
npm run dev               # http://localhost:3000
```

`db:setup` installe une base **vide**, prête pour vos vraies données : seuls le compte
administrateur et les catégories de projet y figurent.

Pour explorer l'interface avec un jeu d'exemple :
```bash
npm run db:seed-demo      # 5 projets, 5 donateurs, dons, dépenses, impacts…
npm run db:reset -- --force   # …et pour tout effacer ensuite
```

`JWT_SECRET` solide :
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Frontend
```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Ouvrir **http://localhost:5173/admin/login** — `AdminHope` / `hope2026*`.

---

## 3. L'espace administrateur

Barre latérale sombre, barre du haut claire, contenu sur fond bleu très pâle. Peu d'icônes,
des tableaux lisibles, des badges discrets : un logiciel de gestion, pas une page marketing.

| Écran | Ce qu'on y fait |
|---|---|
| **Accueil** | 4 chiffres clés, lecture du budget, projets en cours, fil d'activité, actions rapides |
| **Projets** | Liste avec identifiant, donateurs, somme investie, couverture · Créer / Modifier / Terminer / Supprimer |
| ↳ fiche projet | 6 onglets : Vue générale, Financement, Dépenses, Justificatifs, Bénéficiaires, Impact |
| **Impact** | Projets terminés avec leur date de fin et leur résultat · indicateurs chiffrés cumulés |
| **Budget** | Les trois sommes (affecté / HOPE / total), le flux des fonds, les projets à financer, l'action **Investir** |
| **Notifications** | Chaque don, investissement, message et projet terminé |
| **Donateurs** | Avec compte / sans compte / international · journal des dons · ouverture de compte |
| **Messages** | Échanges avec les donateurs disposant d'un compte |
| **Statistiques** | Budget, projets et donateurs en chiffres, sur 12 mois |
| **Paramètres** | Compte admin, catégories de projet, moyens de paiement |

### Cycle de vie d'un projet
```
création ──► EN COURS ──► (Terminer + résultat) ──► TERMINÉ ──► ARCHIVÉ
                  ▲                                     │
                  └────────────── Rouvrir ──────────────┘
```
Un projet naît toujours **en cours**. Le statut n'est pas saisissable dans le formulaire.

---

## 4. Modèle de données

14 tables. Montants en `NUMERIC(14,2)` — jamais `FLOAT`. Statuts contrôlés par des `CHECK`.

```
project_categories
        │
        ▼
     projects ─────── investments        (fonds HOPE → projet, justifié)
        │      │
        │      ├───── expenses ────────── supporting_documents
        │      │
        │      ├───── project_beneficiaries ──── beneficiaries
        │      │
        │      └───── impacts
        │
donors ─┬─ donor_accounts ─── messages
        └─ donations ──────── projects   (si le don est affecté)

notifications  ← alimentée par les services à chaque événement
```

| Table | Rôle |
|---|---|
| `projects` | `reference`, `required_budget`, `beneficiary_profile/target`, `IN_PROGRESS / COMPLETED / ARCHIVED`, `outcome`, `completed_at` |
| `donors` | `LOCAL` / `INTERNATIONAL` (déduit du pays) |
| `donor_accounts` | Le compte du donateur régulier — `password_hash` bcrypt |
| `donations` | `allocation` = `PROJECT` (affecté) ou `HOPE` · `frequency` = `ONE_TIME` / `MONTHLY` |
| `investments` | L'action « Investir » : projet, montant, **justification obligatoire** |
| `expenses` | Utilisation des fonds · `RECORDED` / `CANCELLED` |
| `supporting_documents` | `INVOICE / RECEIPT / BANK_PROOF / CONTRACT / OTHER` |
| `beneficiaries`, `project_beneficiaries` | Qui a été aidé · relation N-N |
| `impacts` | Indicateur chiffré et daté |
| `messages`, `notifications` | Messagerie et journal des événements |

Vérification :
```bash
psql -U postgres -d hope_db -c "\dt"
psql -U postgres -d hope_db -c "\d projects"
```

---

## 5. Règles métier

Toutes appliquées **côté backend**, dans une transaction avec verrouillage (`SELECT … FOR
UPDATE`) dès qu'un contrôle précède une écriture.

### Le fonds HOPE ne peut pas être sur-investi
```
SUM(investissements) ≤ SUM(dons non affectés encaissés)
```
Dépassement → **422** `FONDS_INSUFFISANT`, avec le montant restant dans `details`.

### On n'investit pas au-delà du besoin
```
investissement ≤ budget nécessaire − déjà financé
```
→ **422** `INVESTISSEMENT_SUPERIEUR_AU_BESOIN`, ou `PROJET_DEJA_FINANCE` si le besoin est nul.

### On ne dépense que l'argent réellement reçu
```
dépenses du projet ≤ dons affectés + investissements du fonds
```
→ **422** `FONDS_PROJET_INSUFFISANTS`, avec le disponible dans `details`.

### Le moyen de paiement dépend de la localisation
| Donateur | Moyens proposés |
|---|---|
| Madagascar | Mvola, Orange Money, Airtel Money, Espèces, Virement local, Chèque |
| Étranger | Carte bancaire, PayPal, Virement international, Western Union |

Un moyen hors liste → **422** `MOYEN_PAIEMENT_INDISPONIBLE`.

### Autres garde-fous
| Règle | Réponse |
|---|---|
| Terminer un projet sans résultat | 400 — le résultat alimente l'écran Impact |
| Don affecté ou dépense sur un projet terminé | 422 `PROJET_FERME` |
| Impact ou bénéficiaire sur un projet terminé | **autorisé** — on mesure après la clôture |
| Écriture sur un projet archivé | 422 `PROJET_ARCHIVE` |
| Archiver un projet non terminé | 422 `PROJET_NON_TERMINE` |
| Supprimer un projet portant des écritures | 422 `PROJET_AVEC_ECRITURES` |
| Second compte pour un donateur | 422 `COMPTE_EXISTANT` |
| Mot de passe de compte < 8 caractères | 400 |
| Répondre deux fois sans confirmation | 422 `MESSAGE_DEJA_REPONDU` |
| Montant ≤ 0, date mal formée, champ manquant | 400 |

### Suppression
La suppression d'un projet n'est possible **que s'il est vierge de tout mouvement**. Dès qu'un
don, un investissement ou une dépense s'y rattache, l'historique comptable prime : le projet se
termine puis s'archive. Une dépense s'annule (`CANCELLED`), elle ne se supprime pas.

---

## 6. API

Base : `http://localhost:3000/api`. **Toutes les routes `/api/admin/*` autres que `login`
exigent `Authorization: Bearer <jwt>`** — sinon **401**.

```
Authentification   POST /admin/login · GET /admin/me · POST /admin/logout · GET /health

Accueil            GET  /admin/dashboard · GET /admin/badges
Références         GET  /admin/catalog · GET|POST /admin/categories
Statistiques       GET  /admin/statistics

Projets            GET|POST   /admin/projects
                   GET        /admin/projects/completed
                   GET        /admin/projects/:id · /admin/projects/:id/overview
                   PATCH      /admin/projects/:id
                   PATCH      /admin/projects/:id/complete   (résultat obligatoire)
                   PATCH      /admin/projects/:id/reopen · /archive
                   DELETE     /admin/projects/:id

Budget             GET  /admin/fund
                   GET  /admin/investments
                   POST /admin/investments        (projet, montant, justification)

Donateurs          GET|POST   /admin/donors
                   GET|PATCH  /admin/donors/:id
                   POST       /admin/donors/:id/account
                   GET        /admin/donor-accounts
                   PATCH      /admin/donor-accounts/:id/status

Dons               GET|POST   /admin/donations
                   GET        /admin/donations/:id
                   PATCH      /admin/donations/:id/status

Notifications      GET   /admin/notifications
                   PATCH /admin/notifications/read-all · /admin/notifications/:id/read

Messages           GET|POST   /admin/messages
                   GET        /admin/messages/:id
                   PATCH      /admin/messages/:id/read · /admin/messages/:id/reply

Dépenses           GET|POST   /admin/expenses
                   GET|PATCH  /admin/expenses/:id
                   PATCH      /admin/expenses/:id/cancel

Justificatifs      POST   /admin/expenses/:expenseId/documents   (multipart, champ "file")
                   GET    /admin/expenses/:expenseId/documents
                   GET    /admin/documents · /admin/documents/:id
                   GET    /admin/documents/:id/download
                   DELETE /admin/documents/:id

Bénéficiaires      GET|POST   /admin/beneficiaries
                   GET|PATCH  /admin/beneficiaries/:id
                   GET|POST   /admin/projects/:projectId/beneficiaries
                   PATCH      /admin/project-beneficiaries/:id

Impacts            GET|POST   /admin/impacts
                   GET        /admin/projects/:projectId/impacts
                   GET|PATCH|DELETE /admin/impacts/:id
```

Erreurs normalisées : `{ success: false, code, message, details? }`.
`password_hash` n'apparaît dans **aucune** réponse.

---

## 7. Arborescence

```
AppHopePlat/
├── backend/src/
│   ├── config/          env.js · database.js (pool + transactions)
│   ├── database/        schema.sql — le schéma complet, idempotent
│   ├── repositories/    14 repositories : seule couche qui écrit du SQL
│   ├── services/        14 services : toute la règle métier
│   ├── controllers/     admin.controllers.js · adminAuth.controller.js · handler.js
│   ├── routes/          index.js · adminAuth.routes.js · admin.routes.js
│   ├── middleware/      auth · upload (multer) · rateLimit · erreurs
│   ├── shared/          errors · money · validation · mapping
│   ├── scripts/         initDatabase · migrate · seedAdmin · seedDemoData · tests
│   └── uploads/justificatifs/   fichiers téléversés (non versionnés)
│
└── frontend/src/
    ├── layouts/         AdminLayout.jsx (barre latérale + barre du haut)
    ├── pages/admin/     11 écrans
    ├── components/admin/ AdminIcons · ui · forms · modales · FluxDesFonds
    ├── services/        1 service par module, Axios centralisé
    ├── hooks/           useChargement · useSoumission
    ├── utils/           format.js (montants, dates, durées)
    ├── styles/          theme · hope-logo · admin-login · admin · admin-modules
    └── routes/          index.jsx · RequireAuth.jsx
```

Architecture respectée de bout en bout :
```
Page React → Service frontend → Axios → Route → Controller → Service → Repository → PostgreSQL
```

---

## 8. Sécurité

| Règle | Mise en œuvre |
|---|---|
| Aucun mot de passe en clair | `bcrypt.hash(…, 12)` — admin et comptes donateurs |
| Pas de fuite sur l'existence d'un compte | message unique « Identifiants incorrects » |
| Pas de fuite par le temps de réponse | hash factice comparé quand le login est inconnu |
| Tout `/api/admin/*` protégé | `authenticateAdmin` monté en tête du routeur admin |
| Compte rechargé à chaque appel | un JWT valide dont le compte a disparu est refusé |
| Injection SQL | requêtes paramétrées `$1, $2` exclusivement |
| Force brute | 10 tentatives / minute / IP sur `/login` |
| CORS | seule l'origine `http://localhost:5173` est acceptée |
| Téléversement | PDF/JPG/PNG, 10 Mo max, **nom de fichier généré**, chemin reconstruit avec `path.basename` |
| Données des bénéficiaires | routes admin uniquement, jamais publiées |
| Secrets | `DB_PASSWORD`, `JWT_SECRET` et `STRIPE_SECRET_KEY` dans `backend/.env`, couvert par `.gitignore` |
| Numéros de carte | saisis dans le cadre de Stripe, jamais reçus ni stockés par HOPE (PCI-DSS, SAQ-A) |
| Paiement annoncé | message Stripe signé (`STRIPE_WEBHOOK_SECRET`), montant recoupé avec le don avant confirmation |
| Concurrence financière | contrôle + écriture dans une transaction, lignes verrouillées |

---

## 9. Scripts

### Backend
| Commande | Rôle |
|---|---|
| `npm run dev` / `npm start` | démarre l'API |
| `npm run db:init` | crée `hope_db` et la table `admins` |
| `npm run db:migrate` | applique `src/database/schema.sql` (idempotent) |
| `npm run db:seed` | crée `AdminHope` (`-- --force` réinitialise son mot de passe) |
| `npm run db:categories` | installe les catégories de projet (idempotent) |
| `npm run db:setup` | enchaîne les quatre — **base vide, prête à l'emploi** |
| `npm run db:seed-demo` | jeu de démonstration, optionnel (`-- --force` le réinstalle) |
| `npm run db:reset` | liste les données métier ; `-- --force` les efface |
| `npm run test:api` | 17 assertions — authentification |
| `npm run test:admin` | 94 assertions — espace administrateur |

### Frontend
`npm run dev` · `npm run build` · `npm run preview`

---

## 10. Tests

### Automatiques — `npm test` et `npm run lint`

Depuis `AppHopePlat` : `npm run lint` (ESLint, backend et frontend) et `npm test`
(`node --test`, sans dépendance de plus). Ils couvrent les montants en centimes, les
validations, le consentement à l'inscription, le mot de passe oublié, les en-têtes de sécurité,
et vérifient que **toutes** les routes `/api/admin/*` refusent une requête sans session (la liste
est lue dans le routeur : une route ajoutée demain est vérifiée d'office). Côté frontend : le
montant en lettres, les formats, l'adresse de chaque page de paiement.

L'intégration continue (`.github/workflows/ci.yml`, à la racine du dépôt) les joue à chaque
envoi sur `dev` et `main`, applique le schéma sur une base PostgreSQL neuve et construit le
frontend.

### API — `npm run test:admin` : **94 assertions**

Fermeture des 12 routes sans jeton · création de projet avec budget nécessaire · donateurs
local / international / avec compte · dons affectés et non affectés · refus d'un moyen de
paiement hors zone · état du fonds · refus d'un investissement au-delà du fonds puis au-delà du
besoin · dépense plafonnée par les fonds reçus · justificatif téléversé, téléchargé, format
interdit refusé · bénéficiaire et doublon · notifications au format demandé · messagerie et
double réponse · clôture avec résultat obligatoire · impact après clôture · suppression refusée
puis autorisée · archivage · vue complète · statistiques.

Le script **supprime ses propres données** en fin de parcours : la base revient exactement à
son état de démonstration (vérifié sur deux exécutions consécutives).

### Navigateur — Playwright : **48 assertions**

Le même parcours joué dans Chromium depuis l'interface, plus : le flux des fonds et sa
sous-barre, les 6 onglets de la fiche projet, l'affichage des messages de refus dans les
modales, chaque écran de la barre latérale, l'histogramme mensuel, l'absence de défilement
horizontal en 430 px, la déconnexion.

---

## 11. Décisions d'implémentation

1. **`pg` conservé, pas d'ORM** — la couche existante était en SQL paramétré ; les 14
   repositories la prolongent.

2. **Le budget est un champ du projet** (`required_budget`), plus une table séparée. Les tables
   `project_budgets`, `budget_items` et `donation_allocations` de la version précédente ont été
   retirées : le modèle demandé n'en a pas besoin.

3. **Deux chemins pour l'argent, pas un** — un don affecté rejoint son projet par
   `donations.project_id` ; un don libre passe par le fonds puis par un `investment`. Cette
   séparation est ce qui rend le budget lisible.

4. **La justification est obligatoire sur un investissement** — c'est la trace de la décision
   d'emploi d'un don libre.

5. **Arithmétique en centimes entiers** (`shared/money.js`) — aucun calcul monétaire en
   flottant ; conversion en chaîne décimale juste avant l'écriture en `NUMERIC(14,2)`.

6. **Une dépense n'est possible qu'après réception des fonds** — le contrôle porte sur ce que
   le projet a reçu, pas sur son budget prévisionnel.

7. **Impacts et bénéficiaires restent modifiables après la clôture** — un résultat se mesure
   après coup. Seul l'archivage fige le dossier.

8. **Les notifications sont déposées par les services**, au moment de l'événement, pas
   reconstruites par lecture — le libellé d'un don suit exactement le format demandé.

9. **`GET /projects/:id/overview`** — la fiche projet charge ses six onglets en un appel.

10. **Graphiques dessinés en CSS**, sans bibliothèque : moins de poids, et un rendu qui reste
    dans la charte HOPE.

11. **Visuels détourés des maquettes** de `imgplateforme/` vers `frontend/src/assets/` ; toute
    la typographie est reconstruite en HTML/CSS.

12. **Langue** — commentaires et messages techniques en français sans accents dans le code
    source ; textes affichés et données métier en français accentué (base et API en UTF-8).

---

## 12. Reste à faire

- **Stockage des fichiers téléversés** : un volume Railway sur `backend/uploads` (voir
  [DEPLOIEMENT.md](DEPLOIEMENT.md)), ou plus tard un stockage objet (S3, Cloudflare R2) ;
- prélèvement automatique des dons mensuels chez un prestataire (les échéances sont
  aujourd'hui générées puis suivies à la main) ;
- journal d'audit des actions administrateur ;
- jeton de session en cookie `httpOnly` + `SameSite` plutôt qu'en stockage du navigateur ;
- comptes administrateurs multiples et rôles ;
- relecture juridique des textes légaux par le bureau de l'association.
