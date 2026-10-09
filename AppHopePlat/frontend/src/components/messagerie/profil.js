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

export function lienEntreprise(personne, espace) {
  if (!personne?.entreprise || espace !== 'admin') return null;
  return `/admin/utilisateurs/compte/${personne.id}?depuis=bailleurs`;
}
