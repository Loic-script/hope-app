import { api } from './api.js';

export async function lister(filtres = {}) {
  const { data } = await api.get('/admin/beneficiaries', { params: filtres });
  return data;
}

export async function recuperer(id) {
  const { data } = await api.get(`/admin/beneficiaries/${id}`);
  return data;
}

export async function creer(beneficiaire) {
  const { data } = await api.post('/admin/beneficiaries', beneficiaire);
  return data;
}

export async function mettreAJour(id, modifications) {
  const { data } = await api.patch(`/admin/beneficiaries/${id}`, modifications);
  return data;
}

export async function televerserPhoto(fichier) {
  const formulaire = new FormData();
  formulaire.append('photo', fichier);
  const { data } = await api.post('/admin/beneficiaries/photo', formulaire, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}

export async function listerParProjet(projectId) {
  const { data } = await api.get(`/admin/projects/${projectId}/beneficiaries`);
  return data;
}

export async function rattacherAuProjet(projectId, rattachement) {
  const { data } = await api.post(`/admin/projects/${projectId}/beneficiaries`, rattachement);
  return data;
}

export async function mettreAJourRattachement(id, modifications) {
  const { data } = await api.patch(`/admin/project-beneficiaries/${id}`, modifications);
  return data;
}
