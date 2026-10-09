import { api } from './api.js';

export async function lister(filtres = {}) {
  const { data } = await api.get('/admin/donations', { params: filtres });
  return data;
}

export async function recuperer(id) {
  const { data } = await api.get(`/admin/donations/${id}`);
  return data;
}

export async function creer(don) {
  const { data } = await api.post('/admin/donations', don);
  return data;
}

export async function changerStatut(id, status) {
  const { data } = await api.patch(`/admin/donations/${id}/status`, { status });
  return data;
}

export async function genererEcheancesMensuelles() {
  const { data } = await api.post('/admin/donations/generate-monthly');
  return data;
}
