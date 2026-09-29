/**
 * Les icones des medaillons du site vitrine, pleines comme sur les
 * maquettes.
 *
 * Elles sont dessinees dans le repere du medaillon : l'origine (0, 0) est
 * son centre, l'unite celle de la maquette (une carte d'activite fait 167
 * unites de large). Les details en blanc (`creux`) sont des vides dans la
 * forme ; un trait blanc (`trait`) reste un trait, pas un remplissage.
 *
 * La classe des creux et des traits est passee par les proprietes, car
 * elle change d'une section a l'autre (`v-activite__creux` sur l'accueil,
 * `v-medaillon__creux` sur les autres pages).
 */

/** Le mortier du diplome : le plateau, la calotte, le gland. */
export function IconeDiplome() {
  return (
    <>
      <path d="M-14.5 -3.8 0 -10.4 14.5 -3.8 0 2.7Z" />
      <path d="M-9.6 -0.2 0 4.2 9.6 -0.2C9.6 6.2 5.6 10.3 0 10.3S-9.6 6.2-9.6 -0.2Z" />
      <path d="M-14.3 -3.3H-12.6V3L-12.1 5.4H-14.8L-14.3 3Z" />
    </>
  );
}

/** La mallette, posee sur une main ouverte. */
export function IconeMallette({ creux = 'v-activite__creux' }) {
  return (
    <>
      <path d="M-0.3 -8.2V-10.6C-0.3 -12.2 0.7 -13.4 2.4 -13.4H4.6C6.3 -13.4 7.3 -12.2 7.3 -10.6V-8.2H5.6V-10.4C5.6 -11.3 5.2 -11.7 4.4 -11.7H2.6C1.8 -11.7 1.4 -11.3 1.4 -10.4V-8.2Z" />
      <rect x="-6" y="-8.2" width="18.5" height="11.6" rx="2.2" />
      <rect className={creux} x="-6" y="-3.9" width="18.5" height="1.1" />
      <rect className={creux} x="2.1" y="-4.9" width="2.8" height="3.1" rx="0.7" />
      <path d="M-13.5 7.4 -11 6.9V12.5L-13.5 12Z" />
      <path d="M-10.2 7.3C-8 7-6.4 7.6-4.8 8.3H1.4C2.6 8.3 2.6 9.9 1.4 9.9H-2.8V10.4H4.6C5 10.4 5.4 10.2 5.8 10L10.2 7C11.2 6.4 12.3 7.6 11.4 8.5L7.5 11.9C7 12.3 6.4 12.5 5.8 12.5H-10.2Z" />
    </>
  );
}

/** Le coeur, traverse par le trace d'un pouls. */
export function IconeCoeurPouls({ trait = 'v-activite__pouls' }) {
  return (
    <>
      <path d="M0 11.5C-5 7.8-12 3.4-12 -3.6-12 -8.4-8.6 -11.5-5 -11.5-2.6 -11.5-0.9 -10.2 0 -8.4 0.9 -10.2 2.6 -11.5 5 -11.5 8.6 -11.5 12 -8.4 12 -3.6 12 3.4 5 7.8 0 11.5Z" />
      <path className={trait} d="M-9.5 0.2H-4.4L-2.6 -3.8 0.4 4.4 2.4 -1 3.6 0.2H8" />
    </>
  );
}

/** La fourchette, l'assiette et la cuillere. */
export function IconeCouvert({ creux = 'v-activite__creux' }) {
  return (
    <>
      <rect x="-16.4" y="-8" width="1.15" height="5.8" rx="0.55" />
      <rect x="-15.07" y="-8" width="1.15" height="5.8" rx="0.55" />
      <rect x="-13.75" y="-8" width="1.15" height="5.8" rx="0.55" />
      <path d="M-16.4 -3.2H-12.6V-1.8C-12.6 -0.7-13.4 0-14.5 0S-16.4 -0.7-16.4 -1.8Z" />
      <rect x="-15.25" y="-1" width="1.5" height="12" rx="0.75" />
      <circle cx="0" cy="1.4" r="8.8" />
      <circle className={creux} cx="0" cy="1.4" r="6.6" />
      <circle cx="0" cy="1.4" r="5.6" />
      <ellipse cx="14.3" cy="-4.4" rx="2.3" ry="3.6" />
      <rect x="13.55" y="-1.6" width="1.5" height="12.6" rx="0.75" />
    </>
  );
}

/** L'ampoule allumee : l'idee qui fonde l'association. */
export function IconeAmpoule({ creux = 'v-medaillon__creux' }) {
  return (
    <>
      <path d="M0 -13.2C-5.6 -13.2-10.1 -8.9-10.1 -3.4-10.1 0.3-8.2 2.9-6.1 5.1-4.8 6.5-4.1 7.6-3.9 8.9H3.9C4.1 7.6 4.8 6.5 6.1 5.1 8.2 2.9 10.1 0.3 10.1 -3.4 10.1 -8.9 5.6 -13.2 0 -13.2Z" />
      <rect x="-4.2" y="10.4" width="8.4" height="2.1" rx="1.05" />
      <rect x="-3" y="13.6" width="6" height="2" rx="1" />
      <path className={creux} d="M-0.9 6.6V-1.6L-4.4 -5.4 -3.1 -6.6 0 -3.2 3.1 -6.6 4.4 -5.4 0.9 -1.6V6.6Z" />
    </>
  );
}

/**
 * La cible et sa fleche : le cap que l'association se donne.
 *
 * Deux anneaux et un point au centre ; la fleche arrive du haut a droite
 * et se creuse un passage a travers eux -- son contour blanc, pose avant
 * elle, ouvre les anneaux la ou elle entre.
 */
export function IconeCible() {
  return (
    <>
      {/* Les anneaux : un disque perce, d'ou la regle evenodd. */}
      <path
        fillRule="evenodd"
        d="M0 -12.4A12.4 12.4 0 1 1-0.01 -12.4ZM0 -9.2A9.2 9.2 0 1 0 0.01 -9.2Z"
      />
      <path
        fillRule="evenodd"
        d="M0 -7.4A7.4 7.4 0 1 1-0.01 -7.4ZM0 -4.4A4.4 4.4 0 1 0 0.01 -4.4Z"
      />
      <circle r="2" />
      {/* Le passage de la fleche, puis la fleche. */}
      <path className="v-medaillon__creux" strokeWidth="5.4" d="M10.32 -10.32 9.9 -2.55 8.34 -5.52 2.4 0.42 -0.42 -2.4 5.52 -8.34 2.55 -9.9Z" />
      <path d="M10.32 -10.32 9.9 -2.55 8.34 -5.52 2.4 0.42 -0.42 -2.4 5.52 -8.34 2.55 -9.9Z" />
    </>
  );
}

/** La loupe sur une silhouette : reperer et former les personnes. */
export function IconeFormation() {
  return (
    <>
      <path d="M-1.4 -13C5.2 -13 10.6 -7.7 10.6 -1.1 10.6 5.5 5.2 10.8-1.4 10.8-8 10.8-13.4 5.5-13.4 -1.1-13.4 -7.7-8 -13-1.4 -13ZM-1.4 -9.2C-5.9 -9.2-9.6 -5.6-9.6 -1.1-9.6 3.4-5.9 7-1.4 7 3.1 7 6.8 3.4 6.8 -1.1 6.8 -5.6 3.1 -9.2-1.4 -9.2Z" />
      <circle cx="-1.4" cy="-4.2" r="2.7" />
      <path d="M-1.4 -0.6C1.6 -0.6 4 1.3 4 3.7V4.6H-6.8V3.7C-6.8 1.3-4.4 -0.6-1.4 -0.6Z" />
      <rect x="6.4" y="5.8" width="10.4" height="3.6" rx="1.8" transform="rotate(43 11.6 7.6)" />
    </>
  );
}
