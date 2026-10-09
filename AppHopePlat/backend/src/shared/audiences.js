export const AUDIENCE_ADMIN = 'hope-admin';
export const AUDIENCE_BENEVOLE = 'hope-benevole';
export const AUDIENCE_BAILLEUR = 'hope-bailleur';
export const AUDIENCE_DONATEUR = 'hope-donateur';

export const EMETTEUR = 'hope-api';

export const TYPES_UTILISATEUR = ['donateur', 'benevole', 'bailleur'];

export const LIBELLES_TYPE = {
  donateur: 'Donateur',
  benevole: 'Bénévole',
  bailleur: 'Bailleur',
};

export const AUDIENCE_PAR_TYPE = {
  donateur: AUDIENCE_DONATEUR,
  benevole: AUDIENCE_BENEVOLE,
  bailleur: AUDIENCE_BAILLEUR,
};

export const ESPACE_PAR_TYPE = {
  donateur: '/donateur',
  benevole: '/benevole',
  bailleur: '/bailleur',
};

export const TYPES_A_VALIDER = ['benevole', 'bailleur'];
