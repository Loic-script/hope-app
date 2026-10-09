import { api } from './api.js';

export async function lister(filtres = {}) {
  const { data } = await api.get('/admin/funders', { params: filtres });
  return data;
}

export async function activer(id) {
  const { data } = await api.post(`/admin/funders/${id}/activate`);
  return data;
}

export async function changerStatut(id, statut) {
  const { data } = await api.patch(`/admin/funders/${id}/status`, { statut });
  return data;
}
