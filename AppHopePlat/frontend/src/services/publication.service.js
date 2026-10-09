import { api } from './api.js';

export async function lister() {
  const { data } = await api.get('/admin/publications');
  return data;
}

export async function creer(publication) {
  const { data } = await api.post('/admin/publications', publication);
  return data;
}

export async function modifier(id, publication) {
  const { data } = await api.patch(`/admin/publications/${id}`, publication);
  return data;
}

export async function supprimer(id) {
  const { data } = await api.delete(`/admin/publications/${id}`);
  return data;
}

export async function televerserPhoto(fichier) {
  const formulaire = new FormData();
  formulaire.append('file', fichier);
  const { data } = await api.post('/admin/publications/photo', formulaire, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}

export async function changerStatutInteret(id, statut) {
  const { data } = await api.patch(`/admin/publications/interets/${id}`, { statut });
  return data;
}
