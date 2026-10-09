import { api } from './api.js';

export async function lister(filtres = {}) {
  const { data } = await api.get('/admin/donors', { params: filtres });
  return data;
}

export async function recuperer(id) {
  const { data } = await api.get(`/admin/donors/${id}`);
  return data;
}

export async function creer(donateur) {
  const { data } = await api.post('/admin/donors', donateur);
  return data;
}

export async function mettreAJour(id, modifications) {
  const { data } = await api.patch(`/admin/donors/${id}`, modifications);
  return data;
}

export async function ouvrirCompte(id, identifiants) {
  const { data } = await api.post(`/admin/donors/${id}/account`, identifiants);
  return data;
}

export async function changerStatutCompte(accountId, status) {
  const { data } = await api.patch(`/admin/donor-accounts/${accountId}/status`, { status });
  return data;
}

export async function listerComptes() {
  const { data } = await api.get('/admin/donor-accounts');
  return data;
}
