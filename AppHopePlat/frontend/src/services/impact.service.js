import { api } from './api.js';

export async function lister(filtres = {}) {
  const { data } = await api.get('/admin/impacts', { params: filtres });
  return data;
}

export async function listerParProjet(projectId) {
  const { data } = await api.get(`/admin/projects/${projectId}/impacts`);
  return data;
}

export async function creer(impact) {
  const { data } = await api.post('/admin/impacts', impact);
  return data;
}

export async function mettreAJour(id, modifications) {
  const { data } = await api.patch(`/admin/impacts/${id}`, modifications);
  return data;
}

export async function supprimer(id) {
  const { data } = await api.delete(`/admin/impacts/${id}`);
  return data;
}
