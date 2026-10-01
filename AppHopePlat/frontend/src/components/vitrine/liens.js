/**
 * Les liens du menu du site vitrine, partages par l'en-tete et les pages.
 */
export const LIENS_GAUCHE = [
  { to: '/', libelle: 'Accueil', exact: true },
  { to: '/nous-decouvrir', libelle: 'Nous découvrir' },
  { to: '/s-engager', libelle: 'S’engager' },
];

export const LIENS_DROITE = [
  { to: '/nos-projets', libelle: 'Nos projets' },
  { to: '/actualites', libelle: 'Actualités' },
  { to: '/contact', libelle: 'Contact' },
];

/** Faire un don : l'inscription ou la connexion d'un donateur. */
export const LIEN_DON = '/authentification?type=donateur';
