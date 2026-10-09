import { api } from './api.js';

export async function lister() {
  const { data } = await api.get('/admin/team');
  return data;
}

export async function creer(champs) {
  const { data } = await api.post('/admin/team', champs);
  return data;
}

export async function mettreAJour(id, champs) {
  const { data } = await api.patch(`/admin/team/${id}`, champs);
  return data;
}

export async function reinitialiserMotDePasse(id, password) {
  const { data } = await api.patch(`/admin/team/${id}/password`, { password });
  return data;
}

export async function changerSonMotDePasse(currentPassword, newPassword) {
  const { data } = await api.post('/admin/me/password', { currentPassword, newPassword });
  return data;
}

export async function journal(limit = 30) {
  const { data } = await api.get('/admin/activity', { params: { limit } });
  return data;
}

export async function televerserPhoto(fichier) {
  const formulaire = new FormData();
  formulaire.append('file', fichier);

  const { data } = await api.post('/admin/me/photo', formulaire, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}

export async function changerSaPhoto(photoUrl) {
  const { data } = await api.patch('/admin/me/photo', { photoUrl });
  return data.photoUrl ?? null;
}
