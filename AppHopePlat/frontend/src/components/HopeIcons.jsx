/**
 * Petites icones SVG utilisees par l'espace administrateur HOPE.
 * Elles heritent de la couleur du texte via currentColor.
 */

/** Icone utilisateur, placee dans le champ Login. */
export function IconeUtilisateur({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Icone cadenas, placee dans le champ Mot de passe. */
export function IconeCadenas({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="15.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** Oeil ouvert : le mot de passe est masque, un clic l'affiche. */
export function IconeOeil({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Oeil barre : le mot de passe est visible, un clic le masque. */
export function IconeOeilBarre({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16.4 16.4 0 0 1-3 3.8M6.5 7.7A16.5 16.5 0 0 0 2.5 12S6 18.5 12 18.5c1.4 0 2.7-.3 3.8-.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m4 4 16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9.9 9.9a3.2 3.2 0 0 0 4.3 4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Bouclier du bandeau "Acces reserve a l'equipe HOPE". */
export function IconeBouclier({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5 20 6v6c0 4.6-3.3 8.4-8 9.5-4.7-1.1-8-4.9-8-9.5V6l8-3.5Z"
        fill="currentColor"
      />
      <path
        d="M12 8.6a1.6 1.6 0 0 0-.8 3v1.7a.8.8 0 0 0 1.6 0v-1.7a1.6 1.6 0 0 0-.8-3Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/** Fleche du bouton "Se connecter". */
export function IconeFleche({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Triangle d'alerte du message d'erreur. */
export function IconeAlerte({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.8 21 19.5H3L12 3.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 9.5v4.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="1.05" fill="currentColor" />
    </svg>
  );
}

/** Petit soleil manuscrit du panneau de gauche. */
export function IconeSoleil({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="8.5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <line x1="24" y1="4" x2="24" y2="11" />
        <line x1="24" y1="37" x2="24" y2="44" />
        <line x1="4" y1="24" x2="11" y2="24" />
        <line x1="37" y1="24" x2="44" y2="24" />
        <line x1="9.9" y1="9.9" x2="14.8" y2="14.8" />
        <line x1="33.2" y1="33.2" x2="38.1" y2="38.1" />
        <line x1="9.9" y1="38.1" x2="14.8" y2="33.2" />
        <line x1="33.2" y1="14.8" x2="38.1" y2="9.9" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------
   Parcours d'accueil du donateur
   Meme trait que les icones ci-dessus : 1,8 d'epaisseur, bouts ronds.
   ------------------------------------------------------------------ */

/** Un repere de carte : l'adresse. */
export function IconeRepere({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Un immeuble : la ville. */
export function IconeImmeuble({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M15 9h3a2 2 0 0 1 2 2v10M3 21h18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 7h3M8 11h3M8 15h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Un globe : le pays. */
export function IconeGlobe({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Un combine : le telephone. */
export function IconeTelephone({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 16.9v2.6a2 2 0 0 1-2.2 2A18.8 18.8 0 0 1 2.5 5.2 2 2 0 0 1 4.5 3h2.6a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.2 10.5a16 16 0 0 0 5.3 5.3l1.1-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Un cercle barre d'un tiret : "aucun". */
export function IconeNeutre({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 12h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Une enveloppe : le courriel. */
export function IconeEnveloppe({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m4 7.5 8 5.5 8-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Une mallette : la profession. */
export function IconeMallette({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12.5h18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Un porte-voix : comment on a connu HOPE. */
export function IconeMegaphone({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 10v4a1 1 0 0 0 1 1h3l8 5V4L7 9H4a1 1 0 0 0-1 1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M19 9a4 4 0 0 1 0 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 15l1.5 5h2.5L10 16" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

/** Un chevron vers le bas : l'ouverture d'une liste. */
export function IconeChevronBas({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Un coeur : la fondation. */
export function IconeCoeur({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20.5s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8 2.7c0 5.9-8 10.6-8 10.6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Trois personnes : l'organisation. */
export function IconeGroupe({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="5.5" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18.5" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M7 19.5v-1a5 5 0 0 1 10 0v1M2.5 18.5v-.6a3.3 3.3 0 0 1 4-3.2M21.5 18.5v-.6a3.3 3.3 0 0 0-4-3.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Une poignee de main : le partenaire. */
export function IconePoigneeMain({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m11 17 2 2a1.4 1.4 0 0 0 2-2M13 15l2.5 2.5a1.4 1.4 0 0 0 2-2l-3.9-3.9a2 2 0 0 0-2.8 0l-.9.9a1.4 1.4 0 0 1-2-2l2.8-2.8a3.8 3.8 0 0 1 4.6-.6l.5.3a2 2 0 0 0 1.5.2L21 6.5M21 6l1 7h-2M3 6.5l3.3.9a2 2 0 0 0 1.4-.1M3 6l-1 7 6.5 6.5a1.4 1.4 0 0 0 2-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Deux maillons : le site web. */
export function IconeLien({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 13.5a4 4 0 0 0 6 .4l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7M14 10.5a4 4 0 0 0-6-.4l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Des pieces empilees : la devise. */
export function IconePieces({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="9" cy="6.5" rx="6" ry="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3 6.5v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4M3 10.5v4c0 1.4 2.7 2.5 6 2.5 1 0 2-.1 2.8-.3M15 13.5a6 2.5 0 1 0 6 0a6 2.5 0 1 0-6 0M15 13.5v4c0 1.4 2.7 2.5 6 2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Un signe de traduction : la langue. */
export function IconeLangue({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 5h9M7.5 3v2M10.5 5c-.8 3.8-3.3 6.8-6.5 8.5M5.5 8.5c1.2 1.9 3 3.4 5 4.3M12.5 21l4-9 4 9M14 17.5h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Une horloge : le fuseau horaire. */
export function IconeHorloge({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Une fleche vers la gauche : revenir a l'etape precedente. */
export function IconeFlecheGauche({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19 12H5M11 18l-6-6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Une coche : le choix retenu. */
export function IconeCoche({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Deux mains qui portent un coeur : le don affecte. */
export function IconeMainsCoeur({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M24 25s-8-4.8-8-10.6A4.4 4.4 0 0 1 24 11.7a4.4 4.4 0 0 1 8 2.7C32 20.2 24 25 24 25Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="m20.5 15.8 2.4 2.4 4.6-4.8"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 20v12.5a6 6 0 0 0 1.8 4.3L13 42M42 20v12.5a6 6 0 0 1-1.8 4.3L35 42"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 20a3 3 0 0 1 6 0v8l4.6 4.3a3.2 3.2 0 0 1-4.4 4.6M42 20a3 3 0 0 0-6 0v8l-4.6 4.3a3.2 3.2 0 0 0 4.4 4.6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Une loupe : rechercher. */
export function IconeRecherche({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
      <path d="m20 20-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Un triangle de lecture : une video. */
export function IconeLecture({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 8.5v7l5.5-3.5L10 8.5Z" fill="currentColor" />
    </svg>
  );
}

/** Un recu coche : le don ponctuel, regle une fois. */
export function IconeRecuCoche({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M30 24.5V8a3 3 0 0 0-3-3H10a3 3 0 0 0-3 3v33l3.5-2.5L14 41l3.5-2.5L21 41l2-1.4"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13 14h11M13 20h11M13 26h6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="33" cy="35" r="9" stroke="currentColor" strokeWidth="2.4" />
      <path
        d="m29 35 3 3 5-6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Un calendrier et deux fleches qui tournent : le don mensuel. */
export function IconeCalendrierRenouvele({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M24 38H9a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3h26a3 3 0 0 1 3 3v9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 18h32M14 6v7M30 6v7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12 25h6M12 31h4M22 25h4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M43 33a8 8 0 0 1-14 4.5M29 37.5V33h4.5M29 29a8 8 0 0 1 14-2.5M43 26.5V31h-4.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Un i dans un cercle : une information. */
export function IconeInfo({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7.8" r="1.1" fill="currentColor" />
    </svg>
  );
}
