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

/**
 * La personne dans la loupe, posee sur son socle : reperer et former.
 * Relevee sur l'icone fournie par HOPE (33 x 36 px), redessinee a la
 * meme taille, l'origine au centre de la loupe ; le groupe recentre
 * l'ensemble (manche et socle compris) sur le medaillon.
 */
export function IconeFormation({ creux = 'v-activite__creux' }) {
  return (
    <g transform="translate(-1.9 -4.8)">
      {/* La loupe : l'anneau (le disque interieur tourne a l'envers, d'ou le vide), puis le manche. */}
      <path d="M0 -13.2A13.2 13.2 0 1 1 0 13.2A13.2 13.2 0 1 1 0 -13.2ZM0 -9.6A9.6 9.6 0 1 0 0 9.6A9.6 9.6 0 1 0 0 -9.6Z" />
      <rect x="-2.9" y="-24.5" width="5.8" height="14.5" rx="2.9" transform="rotate(135)" />
      {/* La personne : la tete et son reflet, les epaules qui rejoignent l'anneau. */}
      <circle cx="0.6" cy="-0.7" r="6.4" />
      <ellipse className={creux} cx="0.3" cy="0" rx="2.9" ry="1.3" transform="rotate(12 0.3 0)" />
      <path d="M-6.87 9.34A9 9 0 0 1 7.87 9.34L6.5 10.2H-5.5Z" />
      {/* Le socle : la tablette, creusee sous la loupe, et son pied. */}
      <path d="M-6.2 15.6Q0.5 17.8 7.2 15.6Q8 15.5 8 16.3V18.9Q8 19.7 7.2 19.7H-6.2Q-7 19.7 -7 18.9V16.3Q-7 15.5 -6.2 15.6Z" />
      <rect x="-4.5" y="19.3" width="10" height="3.5" rx="0.8" />
    </g>
  );
}
