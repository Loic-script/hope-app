import { api } from './api.js';

export async function lister(filtres = {}) {
  const { data } = await api.get('/admin/expenses', { params: filtres });
  return data;
}

export async function recuperer(id) {
  const { data } = await api.get(`/admin/expenses/${id}`);
  return data;
}

export async function creer(depense) {
  const { data } = await api.post('/admin/expenses', depense);
  return data;
}

export async function mettreAJour(id, modifications) {
  const { data } = await api.patch(`/admin/expenses/${id}`, modifications);
  return data;
}

export async function annuler(id) {
  const { data } = await api.patch(`/admin/expenses/${id}/cancel`);
  return data;
}
