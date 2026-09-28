/**
 * Les liens du menu du site vitrine, partages par l'en-tete et les pages.
 */
export const LIENS_GAUCHE = [
  { to: '/', libelle: 'Accueil', exact: true },
  { to: '/nous-decouvrir', libelle: 'Nous découvrir' },
  { to: '/nos-realisations', libelle: 'Nos réalisations' },
];

export const LIENS_DROITE = [
  { to: '/actualites', libelle: 'Actualités' },
  { to: '/contact', libelle: 'Contact' },
  { to: '/s-engager', libelle: 'S’engager' },
];

/** Faire un don : l'inscription ou la connexion d'un donateur. */
export const LIEN_DON = '/authentification?type=donateur';
