# HOPE — Frontend

Interface web de donation et de suivi, en **React + Vite + TypeScript**.
Elle ne parle qu'à l'API HTTP de HOPE : jamais à PostgreSQL, jamais à Prisma.

Pour la vue d'ensemble du projet, voir le [README racine](../README.md).

---

## Démarrer

```bash
# 1. Le backend doit tourner (depuis la racine du dépôt)
npm run api

# 2. Puis, ici
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

| Commande | Rôle |
| --- | --- |
| `npm run dev` | serveur de développement, rechargement à chaud |
| `npm run build` | vérification de types puis build de production |
| `npm run preview` | sert le build de production sur `:4173` |
| `npm run typecheck` | TypeScript seul |
| `npm run lint` | oxlint |

---

## Configuration

Une seule variable :

```dotenv
VITE_API_URL=http://localhost:3000/api
```

> **Tout ce qui commence par `VITE_` est embarqué dans le JavaScript téléchargé
> par le visiteur.** On n'y met donc jamais de secret : ni mot de passe, ni clé
> d'API privée, ni `DATABASE_URL`. Le frontend n'a besoin d'aucun secret — il
> ne fait que consommer une API publique.

---

## Ce que le frontend ne fait pas

C'est la partie la plus importante de ce document.

| Le frontend ne… | Parce que |
| --- | --- |
| …décide jamais qu'un paiement a réussi | Il envoie une intention et **lit** le statut renvoyé par le backend. Le champ `outcome` vient du serveur. |
| …calcule jamais un montant | Additionner ou soustraire de l'argent en JavaScript passe par un flottant. Tous les montants transitent en **chaînes** et ne sont que mis en forme. |
| …filtre jamais les moyens de paiement | C'est le backend qui décide, à partir du pays, quelles méthodes proposer. |
| …n'accède jamais à PostgreSQL | Il ne connaît que des URL HTTP. |
| …ne stocke aucune donnée bancaire | Aucun champ de carte n'existe dans le code. |

La seule valeur numérique reçue du backend est `progressPercent`, déjà calculé
côté serveur, et qui ne sert qu'à dessiner une barre. Une barre n'est pas une
somme d'argent.

---

## Structure

```
src/
├── components/
│   ├── ui/            Button, Field, Card, Badge, ProgressBar, Alert,
│   │                  Skeleton, EmptyState, ErrorState, Loader, Section…
│   ├── layout/        Header (+ menu mobile), Footer
│   ├── projects/      ProjectCard
│   ├── donation/      TransactionStatusBadge
│   ├── impact/        ImpactStat, IndicatorCard, DonationThread
│   └── ActivityCard.tsx
├── pages/             Accueil, Projets, Fiche projet, Don, Résultats, Contenus
├── layouts/           RootLayout (en-tête, contenu, pied de page)
├── router/            Table des routes, chargement à la demande
├── hooks/             useApi.ts — toutes les requêtes React Query
├── services/          api.ts (Axios) + un service par domaine
├── types/             api.ts — miroir exact des réponses du backend
├── constants/         activities.ts, navigation.ts
├── utils/             money.ts, format.ts, cn.ts
└── styles/            index.css — tokens du design system
```

---

## Design system

Les tokens vivent dans [`src/styles/index.css`](src/styles/index.css), dans un
bloc `@theme` Tailwind v4. Trois choses méritent d'être connues avant de
toucher aux couleurs.

### Le bouton primaire porte du texte encre, pas du blanc

La charte impose l'orange `#E09735` pour l'action principale. Mesuré :

| Combinaison | Contraste | Verdict |
| --- | --- | --- |
| blanc sur `#E09735` | **2,43:1** | échoue (AA demande 4,5:1) |
| encre `#353343` sur `#E09735` | **5,07:1** | conforme |

Le bouton primaire est donc orange à texte encre. Il est de surcroît plus
chaleureux.

### L'orange écrit n'est pas l'orange peint

`#E09735` en texte sur blanc donne 2,43:1 : illisible. Toute mention orange
*écrite* utilise `--color-hope-orange-deep` (`#96600F`, 5,28:1). L'orange vif
reste réservé aux aplats et aux bordures.

### Bleu, lavande et jaune ne sont jamais du texte

Ce sont des fonds. Leur contraste sur blanc plafonne à 2,1:1.

Autres valeurs vérifiées : violet `#5D5696` sur blanc **6,49:1**, blanc sur
violet **6,49:1**, jaune `#F5E389` sur violet **5,01:1**, encre sur blanc
**12,31:1**.

### Typographie

| Rôle | Police | Pourquoi |
| --- | --- | --- |
| Titres | **Fraunces** | serif chaleureuse, un peu artisanale — loin de l'élégance froide des serifs éditoriales |
| Texte | **Instrument Sans** | humaniste, très lisible en français accentué |
| Montants et références | **JetBrains Mono** | les références `HOPE-TXN-…` sont conçues pour être dictées au téléphone ; une chasse fixe rend chaque caractère distinct, et les chiffres tabulaires alignent les montants |

---

## L'élément signature : le fil du don

[`components/impact/DonationThread.tsx`](src/components/impact/DonationThread.tsx)

La plupart des sites d'ONG résument l'usage des dons par un camembert et une
promesse. HOPE peut faire mieux : sa base conserve réellement chaque maillon,
du paiement jusqu'à l'impact mesuré. Le fil rend cette chaîne visible.

La numérotation des étapes n'est pas décorative : l'argent passe réellement
par ces étapes, dans cet ordre, et aucune ne peut être sautée — on ne dépense
pas avant d'avoir encaissé, on ne justifie pas avant d'avoir dépensé.

---

## Accessibilité

- lien d'évitement en premier élément focusable ;
- un seul `<h1>` par page, repères `header` / `main` / `footer` ;
- chaque champ a un `<label>` **relié** par `htmlFor` / `id` ;
- les erreurs de saisie portent une icône **et** un texte, jamais seulement du
  rouge, et sont reliées au champ par `aria-describedby` ;
- les statuts de paiement portent une icône **et** un libellé écrit ;
- les cartes-radio encapsulent un vrai `<input type="radio">` visuellement
  masqué : navigation clavier et lecture d'écran restent natives ;
- cibles tactiles d'au moins 44 px ;
- `prefers-reduced-motion` coupe toute animation ;
- pas de débordement horizontal de 320 px à 1440 px (vérifié automatiquement).

---

## Tests de bout en bout

```bash
# depuis la racine du dépôt
npm run e2e
```

Le script démarre l'API et le build de production, pilote un vrai Chromium, et
joue le parcours complet : accueil → projets → fiche projet → don de
100 000 MGA par MVola → confirmation, puis un second parcours avec paiement
refusé. Il vérifie aussi les repères d'accessibilité et l'absence de
débordement à six largeurs d'écran.

Point clé : le script lit la référence affichée à l'écran, **puis interroge
l'API** pour confirmer que cette transaction existe en base avec ce statut. Une
référence fabriquée par le navigateur échouerait à cette étape.

```bash
npm run e2e:shots   # captures d'écran dans frontend/e2e-shots/
```
