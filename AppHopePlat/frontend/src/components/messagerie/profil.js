/**
 * Ou mene le nom d'une personne.
 *
 * HOPE n'a pas de fiche individuelle qu'un autre utilisateur puisse
 * consulter. On mene donc :
 * - a son propre profil, si c'est soi ;
 * - pour l'equipe, au profil de la personne dans l'ecran Utilisateurs,
 *   ou a la liste de l'equipe ;
 * - ailleurs, nulle part : le panneau d'information tient lieu de fiche.
 */

/** L'espace d'ou l'on regarde, d'apres le chemin de sa messagerie. */
export function espaceDe(cheminMessages) {
  if (String(cheminMessages).startsWith('/admin')) return 'admin';
  if (String(cheminMessages).startsWith('/bailleur')) return 'bailleur';
  return 'benevole';
}

const MON_PROFIL = {
  admin: '/admin/settings',
  benevole: '/benevole/profil',
  bailleur: '/bailleur/organisation',
};

/** @returns {string|null} */
export function lienProfil(personne, espace) {
  if (!personne) return null;
  if (personne.estMoi) return MON_PROFIL[espace] ?? null;
  if (espace !== 'admin') return null;
  if (personne.type === 'admin') return '/admin/settings';
  if (personne.role === 'benevole') return `/admin/utilisateurs/compte/${personne.id}?depuis=benevoles`;
  if (personne.role === 'bailleur') return `/admin/utilisateurs/compte/${personne.id}?depuis=bailleurs`;
  if (personne.role === 'donateur') return `/admin/utilisateurs/compte/${personne.id}?depuis=donateurs`;
  return null;
}

/** L'organisation d'un contact de bailleur : cliquable pour l'equipe seulement. */
export function lienEntreprise(personne, espace) {
  if (!personne?.entreprise || espace !== 'admin') return null;
  return `/admin/utilisateurs/compte/${personne.id}?depuis=bailleurs`;
}
