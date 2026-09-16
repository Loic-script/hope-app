/**
 * Jeu d'icones des espaces connectes.
 *
 * Ne sert plus au seul administrateur : le benevole et le bailleur
 * partagent desormais la meme coque, donc le meme trace.
 *
 * Toutes les icones partagent le meme trace : contour de 1,7 px, coins
 * arrondis, viewBox 24x24, couleur heritee via currentColor. L'interface
 * en utilise peu, conformement au parti pris "logiciel de gestion" :
 * essentiellement la navigation et quelques actions.
 */

/** Fabrique une icone a partir de son contenu SVG. */
function creerIcone(nom, contenu, { rempli = false } = {}) {
  function Icone({ className = '' }) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill={rempli ? 'currentColor' : 'none'}
        stroke={rempli ? 'none' : 'currentColor'}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {contenu}
      </svg>
    );
  }
  Icone.displayName = nom;
  return Icone;
}

// --- Navigation ------------------------------------------------------

export const IconeAccueil = creerIcone(
  'IconeAccueil',
  <>
    <path d="M3 10.4 12 3.5l9 6.9V20a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 20Z" />
    <path d="M9.3 21.4v-7h5.4v7" />
  </>
);

export const IconeDonateurs = creerIcone(
  'IconeDonateurs',
  <>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M2.8 20.5a6.2 6.2 0 0 1 12.4 0" />
    <path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.6" />
    <path d="M18 14.6a6.2 6.2 0 0 1 3.2 5.4" />
  </>
);

export const IconeDons = creerIcone(
  'IconeDons',
  <path d="M12 20.3s-7.8-4.6-7.8-10a4.4 4.4 0 0 1 7.8-2.8 4.4 4.4 0 0 1 7.8 2.8c0 5.4-7.8 10-7.8 10Z" />
);

export const IconeTransactions = creerIcone(
  'IconeTransactions',
  <>
    <path d="M3.5 8h14M14 4.5 17.5 8 14 11.5" />
    <path d="M20.5 16h-14M10 12.5 6.5 16 10 19.5" />
  </>
);

export const IconeProjets = creerIcone(
  'IconeProjets',
  <>
    <path d="M3 7.4A1.4 1.4 0 0 1 4.4 6h4.3l2 2.6h8.9A1.4 1.4 0 0 1 21 10v8.6a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 18.6Z" />
  </>
);

export const IconeBudgets = creerIcone(
  'IconeBudgets',
  <>
    <rect x="3.2" y="5.4" width="17.6" height="13.2" rx="2" />
    <path d="M3.2 9.6h17.6" />
    <path d="M15.5 14.4h2.4" />
  </>
);

export const IconeDepenses = creerIcone(
  'IconeDepenses',
  <>
    <path d="M6 3.2h12a1 1 0 0 1 1 1v16.4l-2.6-1.7-2.6 1.7-2.6-1.7-2.6 1.7L5 20.6V4.2a1 1 0 0 1 1-1Z" />
    <path d="M8.8 8.4h6.4M8.8 12.4h6.4" />
  </>
);

export const IconeJustificatifs = creerIcone(
  'IconeJustificatifs',
  <>
    <path d="M13.6 3.2H6.8a1.6 1.6 0 0 0-1.6 1.6v14.4a1.6 1.6 0 0 0 1.6 1.6h10.4a1.6 1.6 0 0 0 1.6-1.6V8.4Z" />
    <path d="M13.6 3.2v5.2h5.2" />
    <path d="M8.6 13h6.8M8.6 16.6h4.4" />
  </>
);

export const IconeMessages = creerIcone(
  'IconeMessages',
  <>
    <rect x="3.2" y="5.2" width="17.6" height="13.6" rx="2" />
    <path d="M3.2 7.1l7.75 5.3a1.9 1.9 0 0 0 2.1 0L20.8 7.1" />
  </>
);

export const IconePreuves = creerIcone(
  'IconePreuves',
  <>
    <path d="M3.2 8.6a1.8 1.8 0 0 1 1.8-1.8h2.6l1.4-2.2h6l1.4 2.2H19a1.8 1.8 0 0 1 1.8 1.8v8.6a1.8 1.8 0 0 1-1.8 1.8H5a1.8 1.8 0 0 1-1.8-1.8Z" />
    <circle cx="12" cy="12.6" r="3.4" />
  </>
);

export const IconeBeneficiaires = creerIcone(
  'IconeBeneficiaires',
  <>
    <circle cx="8.4" cy="8.2" r="3.2" />
    <circle cx="16.6" cy="9.6" r="2.5" />
    <path d="M2.6 19.8a5.8 5.8 0 0 1 11.6 0" />
    <path d="M15.4 14.6a4.6 4.6 0 0 1 6 4.4" />
  </>
);

export const IconeImpacts = creerIcone(
  'IconeImpacts',
  <>
    <path d="M3.5 19.5h17" />
    <path d="M6.6 19.5v-5.2M11 19.5V8.4M15.4 19.5v-7.6M19.8 19.5V5.2" />
  </>
);

export const IconeParametres = creerIcone(
  'IconeParametres',
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.2 14.4a1.5 1.5 0 0 0 .3 1.65l.05.06a1.8 1.8 0 1 1-2.55 2.55l-.06-.06a1.5 1.5 0 0 0-1.65-.3 1.5 1.5 0 0 0-.9 1.37v.17a1.8 1.8 0 1 1-3.6 0v-.09a1.5 1.5 0 0 0-.98-1.37 1.5 1.5 0 0 0-1.65.3l-.06.06a1.8 1.8 0 1 1-2.55-2.55l.06-.06a1.5 1.5 0 0 0 .3-1.65 1.5 1.5 0 0 0-1.37-.9h-.17a1.8 1.8 0 0 1 0-3.6h.09a1.5 1.5 0 0 0 1.37-.98 1.5 1.5 0 0 0-.3-1.65l-.06-.06A1.8 1.8 0 1 1 8.05 3.4l.06.06a1.5 1.5 0 0 0 1.65.3h.07a1.5 1.5 0 0 0 .9-1.37v-.17a1.8 1.8 0 0 1 3.6 0v.09a1.5 1.5 0 0 0 .9 1.37 1.5 1.5 0 0 0 1.65-.3l.06-.06a1.8 1.8 0 1 1 2.55 2.55l-.06.06a1.5 1.5 0 0 0-.3 1.65v.07a1.5 1.5 0 0 0 1.37.9h.17a1.8 1.8 0 0 1 0 3.6h-.09a1.5 1.5 0 0 0-1.37.9Z" />
  </>
);

export const IconeDeconnexion = creerIcone(
  'IconeDeconnexion',
  <>
    <path d="M9.5 20.5H5.4A1.4 1.4 0 0 1 4 19.1V4.9a1.4 1.4 0 0 1 1.4-1.4h4.1" />
    <path d="M15.6 16.4 20 12l-4.4-4.4" />
    <path d="M20 12H9.4" />
  </>
);

// --- Actions et decor -------------------------------------------------

export const IconeRecherche = creerIcone(
  'IconeRecherche',
  <>
    <circle cx="10.8" cy="10.8" r="6.6" />
    <path d="m20 20-4.6-4.6" />
  </>
);

export const IconeCloche = creerIcone(
  'IconeCloche',
  <>
    <path d="M18 8.6a6 6 0 1 0-12 0c0 6-2 7.4-2 7.4h16s-2-1.4-2-7.4Z" />
    <path d="M13.7 19.6a2 2 0 0 1-3.4 0" />
  </>
);

export const IconePlus = creerIcone('IconePlus', <path d="M12 5.5v13M5.5 12h13" />);

export const IconeCroix = creerIcone('IconeCroix', <path d="m6 6 12 12M18 6 6 18" />);

export const IconeChevronDroit = creerIcone('IconeChevronDroit', <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />);
export const IconeChevronGauche = creerIcone('IconeChevronGauche', <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />);

export const IconeChevronBas = creerIcone('IconeChevronBas', <path d="m6 9.5 6 6 6-6" />);

export const IconeRetour = creerIcone(
  'IconeRetour',
  <>
    <path d="M20 12H4.5" />
    <path d="m10 5.5-5.5 6.5 5.5 6.5" />
  </>
);

export const IconeAlerte = creerIcone(
  'IconeAlerte',
  <>
    <path d="M12 3.8 21 19.5H3Z" />
    <path d="M12 9.6v4.2" />
    <circle cx="12" cy="16.7" r="0.9" fill="currentColor" stroke="none" />
  </>
);

export const IconeValide = creerIcone('IconeValide', <path d="m4.8 12.4 4.8 4.8L19.4 7" />);

export const IconeArchive = creerIcone(
  'IconeArchive',
  <>
    <rect x="3.2" y="4.4" width="17.6" height="4.2" rx="1.2" />
    <path d="M5 8.6v10a1.4 1.4 0 0 0 1.4 1.4h11.2a1.4 1.4 0 0 0 1.4-1.4v-10" />
    <path d="M9.8 12.6h4.4" />
  </>
);

export const IconeCrayon = creerIcone(
  'IconeCrayon',
  <>
    <path d="M16.4 3.9a2.1 2.1 0 0 1 3 3L8.2 18.1l-4 1 1-4Z" />
    <path d="m14.6 5.7 3.7 3.7" />
  </>
);

export const IconeTelechargement = creerIcone(
  'IconeTelechargement',
  <>
    <path d="M12 3.8v11" />
    <path d="m7.6 10.4 4.4 4.4 4.4-4.4" />
    <path d="M4.4 19.6h15.2" />
  </>
);

export const IconeCorbeille = creerIcone(
  'IconeCorbeille',
  <>
    <path d="M4.4 6.6h15.2" />
    <path d="M9.4 6.6V4.9a1.2 1.2 0 0 1 1.2-1.2h2.8a1.2 1.2 0 0 1 1.2 1.2v1.7" />
    <path d="M6.4 6.6v12.5a1.4 1.4 0 0 0 1.4 1.4h8.4a1.4 1.4 0 0 0 1.4-1.4V6.6" />
  </>
);

export const IconeGraphique = creerIcone(
  'IconeGraphique',
  <>
    <path d="M3.6 20.4h16.8" />
    <rect x="5.4" y="11" width="3.4" height="7" rx="1" />
    <rect x="10.6" y="6.6" width="3.4" height="11.4" rx="1" />
    <rect x="15.8" y="13.4" width="3.4" height="4.6" rx="1" />
  </>
);

// --- Propres aux espaces benevole et bailleur -------------------------

/** Une seule silhouette : le compte de celui qui regarde, et non un groupe. */
export const IconePersonne = creerIcone(
  'IconePersonne',
  <>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20.6a7.2 7.2 0 0 1 14.4 0" />
  </>
);

/** Une liste cochee : ce qu'il reste a faire. */
export const IconeTaches = creerIcone(
  'IconeTaches',
  <>
    <path d="M9 4.4H7a1.6 1.6 0 0 0-1.6 1.6v13.2A1.6 1.6 0 0 0 7 20.8h10a1.6 1.6 0 0 0 1.6-1.6V6A1.6 1.6 0 0 0 17 4.4h-2" />
    <rect x="9" y="2.8" width="6" height="3.2" rx="1.1" />
    <path d="m8.8 12.4 1.9 1.9 3.9-3.9" />
  </>
);

/** Une horloge : les heures que le benevole consigne. */
export const IconeJournal = creerIcone(
  'IconeJournal',
  <>
    <circle cx="12" cy="12" r="8.6" />
    <path d="M12 7.2V12l3.2 1.9" />
  </>
);

/** Un batiment : l'organisation, par opposition a la personne. */
export const IconeOrganisation = creerIcone(
  'IconeOrganisation',
  <>
    <path d="M4.2 20.6V5.4a1.4 1.4 0 0 1 1.4-1.4h7a1.4 1.4 0 0 1 1.4 1.4v15.2" />
    <path d="M14 10.4h4.4a1.4 1.4 0 0 1 1.4 1.4v8.8" />
    <path d="M3 20.6h18" />
    <path d="M7.2 7.8h3.6M7.2 11.6h3.6M7.2 15.4h3.6" />
  </>
);

/** Un porte-voix : les nouvelles que HOPE adresse a ses partenaires. */
export const IconeActualites = creerIcone(
  'IconeActualites',
  <>
    <path d="M4 9.6h3.2L15.6 5v14l-8.4-4.6H4a1.4 1.4 0 0 1-1.4-1.4v-2a1.4 1.4 0 0 1 1.4-1.4Z" />
    <path d="M19 9.4a3.6 3.6 0 0 1 0 5.2" />
    <path d="M7.2 14.4v3.4a1.6 1.6 0 0 0 3.2 0v-1.6" />
  </>
);

/** Un calendrier : la date d'une mission. */
export const IconeCalendrier = creerIcone(
  'IconeCalendrier',
  <>
    <rect x="3.4" y="5.2" width="17.2" height="15.4" rx="2" />
    <path d="M3.4 9.8h17.2M8.4 3.4v3.6M15.6 3.4v3.6" />
  </>
);

/** Un reperage sur une carte : le lieu d'une mission. */
export const IconeLieu = creerIcone(
  'IconeLieu',
  <>
    <path d="M12 21.2s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
    <circle cx="12" cy="10.2" r="2.6" />
  </>
);
