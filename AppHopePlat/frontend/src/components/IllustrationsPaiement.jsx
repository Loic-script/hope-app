/**
 * Illustrations des moyens de paiement sans logo de marque.
 *
 * Le trait violet de la charte, comme dans le modele de l'etape 4 ; une
 * touche de couleur la ou elle porte un sens -- le vert d'un billet, le
 * bleu d'une application. Les moyens qui ont une marque (MVola, Orange
 * Money, les cartes) gardent leur logo : on les reconnait par lui.
 *
 * Toutes decoratives : le nom du moyen est ecrit sous l'image.
 */

const TRAIT = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

/** Une banque, dessinee a partir de x : fronton, colonnes, socle. */
function Banque({ x }) {
  return (
    <g {...TRAIT}>
      <path d={`M${x} 30 L${x + 19} 19 L${x + 38} 30 Z`} />
      <path d={`M${x + 4} 34v16M${x + 13.5} 34v16M${x + 24.5} 34v16M${x + 34} 34v16`} />
      <path d={`M${x + 1} 54h36M${x - 1} 60h40`} />
    </g>
  );
}

/** Deux banques et l'echange entre elles : le virement bancaire. */
export function IllustrationVirement({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 120 72" aria-hidden="true">
      <Banque x={6} />
      <Banque x={76} />
      <g {...TRAIT}>
        <path d="M50 34h20l-5-5" />
        <path d="M70 46H50l5 5" />
      </g>
    </svg>
  );
}

/** La fente d'un distributeur et un billet qu'on y glisse : le depot. */
export function IllustrationDepot({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 120 72" aria-hidden="true">
      <g {...TRAIT}>
        <rect x="26" y="6" width="68" height="24" rx="5" />
        <path d="M38 18h44" strokeWidth="5" />
        <path d="M36 30v34a4 4 0 0 0 4 4h40a4 4 0 0 0 4-4V30" />
      </g>
      <rect x="45" y="34" width="30" height="26" rx="3" fill="#dcf2e6" stroke="#3a9b6a" strokeWidth="2.4" />
      <circle cx="60" cy="47" r="5.5" fill="none" stroke="#3a9b6a" strokeWidth="2.4" />
    </svg>
  );
}

/** Un globe entre deux fleches : le virement international. */
export function IllustrationInternational({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 120 72" aria-hidden="true">
      <g {...TRAIT}>
        <circle cx="60" cy="36" r="24" />
        <ellipse cx="60" cy="36" rx="10" ry="24" />
        <path d="M36 36h48M39.5 24h41M39.5 48h41" />
        <path d="M24 46a38 38 0 0 1 6-26" />
        <path d="m24.5 22.5 5.5-3 2 6" />
        <path d="M96 26a38 38 0 0 1-6 26" />
        <path d="m95.5 49.5-5.5 3-2-6" />
      </g>
    </svg>
  );
}

/** Un portefeuille et des applications : les plateformes de paiement. */
export function IllustrationPlateformes({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 120 72" aria-hidden="true">
      <rect x="70" y="6" width="20" height="20" rx="5" fill="#86b9de" />
      <circle cx="80" cy="16" r="4" fill="#ffffff" />
      <rect x="92" y="22" width="18" height="18" rx="5" fill="#a59fdc" />
      <circle cx="101" cy="31" r="3.5" fill="#ffffff" />
      <rect x="84" y="4" width="11" height="11" rx="3" fill="#c9c4ef" />
      <g {...TRAIT}>
        <path d="M22 30h44a6 6 0 0 1 6 6v26a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6Z" />
        <path d="M72 44H58a6 6 0 0 0 0 12h14" />
      </g>
      <circle cx="61" cy="50" r="2.6" fill="currentColor" />
    </svg>
  );
}
