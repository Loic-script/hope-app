import { api, URL_API } from './api.js';

export async function lister(filtres = {}) {
  const { data } = await api.get('/admin/projects', { params: filtres });
  return data;
}

export async function recuperer(id) {
  const { data } = await api.get(`/admin/projects/${id}`);
  return data;
}

export async function recupererApercu(id) {
  const { data } = await api.get(`/admin/projects/${id}/overview`);
  return data;
}

export async function recupererRapport(id) {
  const { data } = await api.get(`/admin/projects/${id}/rapport`);
  return data;
}

export async function contenuRapportPublie(id, documentId) {
  const { data } = await api.get(`/admin/projects/${id}/rapport/publies/${documentId}`);
  return data;
}

export async function publierRapport(id) {
  const { data } = await api.post(`/admin/projects/${id}/rapport/publication`);
  return data;
}

export async function telechargerRapportPdf(id, reference) {
  const reponse = await fetch(`${URL_API}/admin/projects/${id}/rapport/pdf`, { credentials: 'same-origin' });
  if (!reponse.ok) throw new Error('Le PDF du rapport n’a pas pu être préparé.');

  const url = URL.createObjectURL(await reponse.blob());
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `rapport-impact-${reference ?? id}.pdf`;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function listerTermines() {
  const { data } = await api.get('/admin/projects/completed');
  return data;
}

export async function creer(projet) {
  const { data } = await api.post('/admin/projects', projet);
  return data;
}

export async function mettreAJour(id, modifications) {
  const { data } = await api.patch(`/admin/projects/${id}`, modifications);
  return data;
}

export async function terminer(id, outcome) {
  const { data } = await api.patch(`/admin/projects/${id}/complete`, { outcome });
  return data;
}

export async function rouvrir(id) {
  const { data } = await api.patch(`/admin/projects/${id}/reopen`);
  return data;
}

export async function archiver(id) {
  const { data } = await api.patch(`/admin/projects/${id}/archive`);
  return data;
}

export async function supprimer(id, { force = false } = {}) {
  const { data } = await api.delete(`/admin/projects/${id}${force ? '?force=1' : ''}`);
  return data;
}

export async function televerserMedia(fichier) {
  const formulaire = new FormData();
  formulaire.append('file', fichier);

  const { data } = await api.post('/admin/projects/media', formulaire, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}
