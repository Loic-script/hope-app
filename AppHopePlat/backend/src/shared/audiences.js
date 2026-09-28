/**
 * Audiences des jetons HOPE.
 *
 * Quatre espaces, quatre audiences. Le secret de signature est commun,
 * mais un jeton emis pour un espace est rejete par les autres : c'est
 * cette valeur, verifiee a la lecture, qui cloisonne.
 *
 * Elles vivent ici plutot que dans chaque service : un espace ajoute
 * ailleurs finirait par utiliser une chaine legerement differente, et
 * le cloisonnement se deferait sans que rien ne le signale.
 */

export const AUDIENCE_ADMIN = 'hope-admin';
export const AUDIENCE_BENEVOLE = 'hope-benevole';
export const AUDIENCE_BAILLEUR = 'hope-bailleur';
export const AUDIENCE_DONATEUR = 'hope-donateur';

/** Emetteur commun a tous les jetons. */
export const EMETTEUR = 'hope-api';

/** Les trois types d'utilisateur qui s'inscrivent eux-memes. */
export const TYPES_UTILISATEUR = ['donateur', 'benevole', 'bailleur'];

/** Libelles affichables, pour le formulaire d'inscription. */
export const LIBELLES_TYPE = {
  donateur: 'Donateur',
  benevole: 'Bénévole',
  bailleur: 'Bailleur',
};

/**
 * Audience du jeton a emettre pour un type d'utilisateur.
 *
 * L'administrateur n'y figure pas : il ne s'inscrit pas, son compte est
 * cree par l'equipe.
 */
export const AUDIENCE_PAR_TYPE = {
  donateur: AUDIENCE_DONATEUR,
  benevole: AUDIENCE_BENEVOLE,
  bailleur: AUDIENCE_BAILLEUR,
};

/** Adresse de l'espace ou mene chaque type, apres connexion. */
export const ESPACE_PAR_TYPE = {
  donateur: '/donateur',
  benevole: '/benevole',
  bailleur: '/bailleur',
};

/**
 * Types dont le compte doit etre valide par HOPE avant d'ouvrir.
 *
 * Un donateur entre aussitot : il vient donner, rien ne justifie de le
 * faire attendre. Un benevole ira sur le terrain au nom de HOPE, un
 * bailleur verra des donnees financieres : ces deux-la passent par une
 * validation.
 */
export const TYPES_A_VALIDER = ['benevole', 'bailleur'];
