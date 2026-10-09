import { api, URL_API } from './api.js';

export async function listerParProjet(projetId) {
  const { data } = await api.get(`/admin/projects/${projetId}/tasks`);
  return data;
}

export async function creer(projetId, tache) {
  const { data } = await api.post(`/admin/projects/${projetId}/tasks`, tache);
  return data;
}

export async function listerTout(filtres = {}) {
  const { data } = await api.get('/admin/taches', { params: filtres });
  return data;
}

export async function recuperer(id) {
  const { data } = await api.get(`/admin/taches/${id}`);
  return data;
}

export async function benevoles() {
  const { data } = await api.get('/admin/taches/benevoles');
  return data.items ?? [];
}

export async function modifier(id, tache) {
  const { data } = await api.patch(`/admin/taches/${id}`, tache);
  return data;
}

export async function affecter(id, benevoleIds) {
  const { data } = await api.post(`/admin/taches/${id}/equipe`, { benevoleIds });
  return data;
}

export async function retirer(id, benevoleId) {
  const { data } = await api.delete(`/admin/taches/${id}/equipe/${benevoleId}`);
  return data;
}

export async function accepter(id, benevoleId) {
  const { data } = await api.post(`/admin/taches/${id}/demandes/${benevoleId}/accepter`);
  return data;
}

export async function refuser(id, benevoleId) {
  const { data } = await api.post(`/admin/taches/${id}/demandes/${benevoleId}/refuser`);
  return data;
}

export async function supprimer(id) {
  const { data } = await api.delete(`/admin/tasks/${id}`);
  return data;
}

export async function urlDuFichier(tache, fichier) {
  if (!tache?.id || !fichier?.id) return null;

  const reponse = await fetch(`${URL_API}/admin/tasks/${tache.id}/files/${fichier.id}`, { credentials: 'same-origin' });
  if (!reponse.ok) return null;
  return URL.createObjectURL(await reponse.blob());
}
