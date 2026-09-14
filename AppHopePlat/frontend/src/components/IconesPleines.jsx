/**
 * Jeu d'icones pleines.
 *
 * Le jeu d'origine (AdminIcons) est au trait : un contour de 1,7 px, sans
 * remplissage. C'est le bon choix dans un tableau ou sur un bouton, ou
 * l'icone accompagne du texte et ne doit pas peser plus que lui.
 *
 * Dans le menu, c'est l'inverse : l'icone porte la couleur de sa famille,
 * et un contour de 1,7 px n'en montre presque rien. En aplat, la couleur
 * occupe toute la forme et se voit sans qu'on ait a lire le libelle.
 *
 * D'ou deux jeux, et non un seul converti : chacun sert un usage. Ceux-ci
 * se dessinent d'une seule forme pleine par icone -- les details (la
 * porte de la maison, l'objectif de l'appareil photo, la coche de la
 * liste) sont creuses dans la masse par fill-rule="evenodd", et laissent
 * donc passer le fond. Rien n'est jamais peint d'une seconde couleur :
 * une icone, une teinte.
 */

/** Fabrique une icone pleine a partir de son contenu SVG. */
function creerIcone(nom, contenu) {
  function Icone({ className = '' }) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="currentColor"
        fillRule="evenodd"
        aria-hidden="true"
      >
        {contenu}
      </svg>
    );
  }
  Icone.displayName = nom;
  return Icone;
}

/* --- Communes aux trois espaces ------------------------------------ */

/** La maison, porte creusee dans la masse. */
export const PleineAccueil = creerIcone(
  'PleineAccueil',
  <path d="M12.74 2.58a1.2 1.2 0 0 0-1.48 0L2.94 9.24a1.6 1.6 0 0 0-.6 1.25v8.71a2 2 0 0 0 2 2h4.5v-6.1a1 1 0 0 1 1-1h4.32a1 1 0 0 1 1 1v6.1h4.5a2 2 0 0 0 2-2v-8.71a1.6 1.6 0 0 0-.6-1.25Z" />
);

/** La porte et la fleche : se deconnecter. */
export const PleineDeconnexion = creerIcone(
  'PleineDeconnexion',
  <>
    <path d="M6.3 2.6h4.4a1 1 0 0 1 0 2H6.5v14.8h4.2a1 1 0 0 1 0 2H6.3a1.8 1.8 0 0 1-1.8-1.8V4.4A1.8 1.8 0 0 1 6.3 2.6Z" />
    <path d="M15.98 7.29a1 1 0 0 1 1.42 0l3.98 4a1 1 0 0 1 0 1.42l-3.98 4a1 1 0 0 1-1.42-1.42l2.28-2.29h-7.36a1 1 0 1 1 0-2h7.36L15.98 8.7a1 1 0 0 1 0-1.41Z" />
  </>
);

/* --- Espace administrateur ----------------------------------------- */

/** Le dossier : un projet. */
export const PleineProjets = creerIcone(
  'PleineProjets',
  <path d="M4.9 4.2h3.96a2 2 0 0 1 1.5.68l1.1 1.24H19.1a2.3 2.3 0 0 1 2.3 2.3v9.28a2.3 2.3 0 0 1-2.3 2.3H4.9a2.3 2.3 0 0 1-2.3-2.3V6.5a2.3 2.3 0 0 1 2.3-2.3Z" />
);

/** Deux silhouettes : les beneficiaires, et les benevoles. */
export const PleineGroupe = creerIcone(
  'PleineGroupe',
  <>
    <circle cx="8.7" cy="7.9" r="3.5" />
    <path d="M2.5 19.6a6.2 6.2 0 0 1 12.4 0 1.2 1.2 0 0 1-1.2 1.2H3.7a1.2 1.2 0 0 1-1.2-1.2Z" />
    <circle cx="17" cy="9.3" r="2.6" />
    <path d="M16.2 14.3a5.1 5.1 0 0 1 5.3 5 1.2 1.2 0 0 1-1.2 1.3h-3.7a2.7 2.7 0 0 0 .3-1.3 8.3 8.3 0 0 0-1.65-4.9Z" />
  </>
);

/**
 * Un adulte et un enfant : les beneficiaires.
 *
 * L'enfant est plus petit et pose plus bas, sans quoi le dessin
 * redeviendrait celui des benevoles -- c'est exactement ce qui les
 * confondait jusqu'ici, les deux entrees partageant la meme icone.
 */
export const PleineFamille = creerIcone(
  'PleineFamille',
  <>
    <circle cx="8.6" cy="6.9" r="3.5" />
    <path d="M2.4 19.7a6.2 6.2 0 0 1 12.4 0 1.1 1.1 0 0 1-1.1 1.1H3.5a1.1 1.1 0 0 1-1.1-1.1Z" />
    <circle cx="18" cy="12.6" r="2.3" />
    <path d="M14.1 20a3.9 3.9 0 0 1 7.8 0 .8.8 0 0 1-.8.8h-6.2a.8.8 0 0 1-.8-.8Z" />
  </>
);

/** Une silhouette et un coeur : celui qui donne. */
export const PleineDonateurs = creerIcone(
  'PleineDonateurs',
  <>
    <circle cx="9.4" cy="7.6" r="3.6" />
    <path d="M2.6 19.9a6.8 6.8 0 0 1 12.55-3.6 1 1 0 0 0 .35.33 6.66 6.66 0 0 1 .85 4.07H3.8a1.2 1.2 0 0 1-1.2-1.2Z" />
    <path d="M18.55 5.9a2.6 2.6 0 0 1 4.2 3 14.7 14.7 0 0 1-3.62 3.6.98.98 0 0 1-1.16 0 14.7 14.7 0 0 1-3.62-3.6 2.6 2.6 0 0 1 4.2-3Z" />
  </>
);

/** L'appareil photo : une preuve de terrain. */
export const PleinePreuves = creerIcone(
  'PleinePreuves',
  <path d="M9.16 3.4h5.68a1.5 1.5 0 0 1 1.27.7l.96 1.5h2.13a2.4 2.4 0 0 1 2.4 2.4v8.6a2.4 2.4 0 0 1-2.4 2.4H4.8a2.4 2.4 0 0 1-2.4-2.4V8a2.4 2.4 0 0 1 2.4-2.4h2.13l.96-1.5a1.5 1.5 0 0 1 1.27-.7Zm2.84 5.5a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Z" />
);

/** L'enveloppe, rabat creuse. */
export const PleineMessages = creerIcone(
  'PleineMessages',
  <path d="M4.6 5.4h14.8a2.2 2.2 0 0 1 2.2 2.2v8.8a2.2 2.2 0 0 1-2.2 2.2H4.6a2.2 2.2 0 0 1-2.2-2.2V7.6a2.2 2.2 0 0 1 2.2-2.2Zm.42 3.03a.9.9 0 0 0-1.02 1.48l5.86 4.03a3.05 3.05 0 0 0 3.48 0l5.86-4.03a.9.9 0 0 0-1.02-1.48l-5.86 4.03a1.25 1.25 0 0 1-1.44 0Z" />
);

/** Le coeur : ce qui est donne, et ceux qui financent. */
export const PleineDons = creerIcone(
  'PleineDons',
  <path d="M12 20.9a1.4 1.4 0 0 1-.83-.28C7.3 17.72 3.3 14.03 3.3 9.98a4.95 4.95 0 0 1 8.7-3.22 4.95 4.95 0 0 1 8.7 3.22c0 4.05-4 7.74-7.87 10.64a1.4 1.4 0 0 1-.83.28Z" />
);

/** La carte : le budget, et ce qu'on en depense. */
export const PleineBudget = creerIcone(
  'PleineBudget',
  <path d="M4 5.2h16a2.4 2.4 0 0 1 2.4 2.4v8.8a2.4 2.4 0 0 1-2.4 2.4H4a2.4 2.4 0 0 1-2.4-2.4V7.6A2.4 2.4 0 0 1 4 5.2Zm-.4 3.5h16.8v2H3.6Zm1.6 4.9a.9.9 0 0 0 0 1.8h3.5a.9.9 0 0 0 0-1.8Z" />
);

/** Trois barres : la statistique. */
export const PleineGraphique = creerIcone(
  'PleineGraphique',
  <>
    <rect x="3" y="12.6" width="4.6" height="8.4" rx="1.4" />
    <rect x="9.7" y="7" width="4.6" height="14" rx="1.4" />
    <rect x="16.4" y="3.2" width="4.6" height="17.8" rx="1.4" />
  </>
);

/* --- Espace benevole ------------------------------------------------ */

/** La liste cochee : ce qu'il reste a faire. */
export const PleineTaches = creerIcone(
  'PleineTaches',
  <path d="M9.6 2.4h4.8a1.6 1.6 0 0 1 1.6 1.6v.4h.8a2.3 2.3 0 0 1 2.3 2.3v12.6a2.3 2.3 0 0 1-2.3 2.3H7.2a2.3 2.3 0 0 1-2.3-2.3V6.7a2.3 2.3 0 0 1 2.3-2.3H8V4a1.6 1.6 0 0 1 1.6-1.6Zm.4 2v.8h4v-.8Zm5.47 6.06a1 1 0 0 0-1.41 0l-3.19 3.18-1.13-1.13a1 1 0 0 0-1.41 1.42l1.83 1.83a1 1 0 0 0 1.42 0l3.89-3.89a1 1 0 0 0 0-1.41Z" />
);

/** L'horloge : les heures consignees au journal. */
export const PleineJournal = creerIcone(
  'PleineJournal',
  <path d="M12 2.7a9.3 9.3 0 1 0 0 18.6 9.3 9.3 0 0 0 0-18.6Zm1 4.6a1 1 0 1 0-2 0v5.05c0 .36.19.7.5.87l3.2 1.85a1 1 0 1 0 1-1.73L13 11.77Z" />
);

/** Une seule silhouette : mon compte. */
export const PleinePersonne = creerIcone(
  'PleinePersonne',
  <>
    <circle cx="12" cy="7.7" r="3.9" />
    <path d="M4.6 20.4a7.4 7.4 0 0 1 14.8 0 1.2 1.2 0 0 1-1.2 1.2H5.8a1.2 1.2 0 0 1-1.2-1.2Z" />
  </>
);

/* --- Espace bailleur ------------------------------------------------ */

/** Le porte-voix : les nouvelles adressees aux partenaires. */
export const PleineActualites = creerIcone(
  'PleineActualites',
  <>
    <path d="M16.4 4.15a1.1 1.1 0 0 1 1.7.93v13.84a1.1 1.1 0 0 1-1.7.93L9.9 15.5H8.1v2.9a2 2 0 1 1-4 0v-3.1a2.7 2.7 0 0 1-1.7-2.5v-1.6a2.7 2.7 0 0 1 2.7-2.7h4.8Z" />
    <path d="M20.05 9.05a1 1 0 0 1 1.41 0 4.2 4.2 0 0 1 0 5.9 1 1 0 0 1-1.41-1.42 2.2 2.2 0 0 0 0-3.07 1 1 0 0 1 0-1.41Z" />
  </>
);

/** Le batiment : l'organisation, par opposition a la personne. */
export const PleineOrganisation = creerIcone(
  'PleineOrganisation',
  <path d="M4.6 2.6h8.2a1.8 1.8 0 0 1 1.8 1.8v4.8h4.4a1.8 1.8 0 0 1 1.8 1.8v9a1.4 1.4 0 0 1-1.4 1.4H4.2a1.4 1.4 0 0 1-1.4-1.4V4.4a1.8 1.8 0 0 1 1.8-1.8Zm1.5 2.9v2.2h2.3V5.5Zm4.5 0v2.2h2.3V5.5Zm-4.5 4.4v2.2h2.3V9.9Zm4.5 0v2.2h2.3V9.9Zm-4.5 4.4v2.2h2.3v-2.2Zm4.5 0v2.2h2.3v-2.2Zm6 0v2.2h2.3v-2.2Z" />
);

/* --- Reperes de date et de lieu, hors menu -------------------------- */

/** Le calendrier : la date d'une mission. */
export const PleineCalendrier = creerIcone(
  'PleineCalendrier',
  <path d="M8.4 2.4a1 1 0 0 1 1 1v1.1h5.2V3.4a1 1 0 1 1 2 0v1.1h1.2a2.4 2.4 0 0 1 2.4 2.4v11.8a2.4 2.4 0 0 1-2.4 2.4H6.2a2.4 2.4 0 0 1-2.4-2.4V6.9a2.4 2.4 0 0 1 2.4-2.4h1.2V3.4a1 1 0 0 1 1-1ZM5.8 9.5v9.2a.4.4 0 0 0 .4.4h11.6a.4.4 0 0 0 .4-.4V9.5Z" />
);

/** Le reperage sur une carte : le lieu d'une mission. */
export const PleineLieu = creerIcone(
  'PleineLieu',
  <path d="M12 2.3a7.6 7.6 0 0 0-7.6 7.6c0 5.5 6.72 11.1 7 11.34a.93.93 0 0 0 1.2 0c.28-.24 7-5.84 7-11.34A7.6 7.6 0 0 0 12 2.3Zm0 5a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Z" />
);
