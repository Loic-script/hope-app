import { api } from './api.js';

export async function lister(onglet, filtres = {}) {
  const { data } = await api.get(`/admin/utilisateurs/${onglet}`, { params: filtres });
  return data;
}

export async function profilCompte(id) {
  const { data } = await api.get(`/admin/utilisateurs/comptes/${id}`);
  return data;
}

export async function profilFiche(id) {
  const { data } = await api.get(`/admin/utilisateurs/fiches/${id}`);
  return data;
}

export async function modifierCompte(id, modifications) {
  const { data } = await api.patch(`/admin/utilisateurs/comptes/${id}`, modifications);
  return data;
}

export async function supprimerCompte(id) {
  const { data } = await api.delete(`/admin/utilisateurs/comptes/${id}`);
  return data;
}

export async function supprimerFiche(id, { forcer = false, avecDons = false } = {}) {
  const params = {};
  if (forcer) params.forcer = 1;
  if (avecDons) params.avecDons = 1;
  const { data } = await api.delete(`/admin/utilisateurs/fiches/${id}`, {
    params: Object.keys(params).length > 0 ? params : undefined,
  });
  return data;
}
