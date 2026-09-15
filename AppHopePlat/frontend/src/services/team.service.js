/**
 * Service frontend des comptes de l'equipe et du journal d'activite.
 *
 * Les routes /admin/team sont reservees au role ADMIN : un coordinateur
 * ou un compte en lecture seule recoit 403. L'appelant doit donc masquer
 * l'ecran plutot que de laisser l'erreur remonter.
 */
import { api } from './api.js';

export async function lister() {
  const { data } = await api.get('/admin/team');
  return data;
}

/** @param {{ adminLog: string, fullName: string, role: string, password: string }} champs */
export async function creer(champs) {
  const { data } = await api.post('/admin/team', champs);
  return data;
}

/** @param {{ fullName?: string, role?: string, status?: string }} champs */
export async function mettreAJour(id, champs) {
  const { data } = await api.patch(`/admin/team/${id}`, champs);
  return data;
}

/** Un administrateur remet a zero le mot de passe d'un autre compte. */
export async function reinitialiserMotDePasse(id, password) {
  const { data } = await api.patch(`/admin/team/${id}/password`, { password });
  return data;
}

/** Chacun change le sien, en fournissant l'ancien. */
export async function changerSonMotDePasse(currentPassword, newPassword) {
  const { data } = await api.post('/admin/me/password', { currentPassword, newPassword });
  return data;
}

export async function journal(limit = 30) {
  const { data } = await api.get('/admin/activity', { params: { limit } });
  return data;
}

/**
 * POST /api/admin/me/photo
 *
 * Televerse la photo et rend son adresse ; le PATCH ci-dessous la
 * rattache au compte. Deux etapes, comme pour les medias de projet.
 */
export async function televerserPhoto(fichier) {
  const formulaire = new FormData();
  formulaire.append('file', fichier);

  // Le client pose "application/json" par defaut : cet en-tete arrive
  // alors sans la frontiere du multipart, et multer ne trouve aucun
  // fichier a lire.
  const { data } = await api.post('/admin/me/photo', formulaire, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}

/** PATCH /api/admin/me/photo — rattache la photo au compte connecte. */
export async function changerSaPhoto(photoUrl) {
  const { data } = await api.patch('/admin/me/photo', { photoUrl });
  return data.photoUrl ?? null;
}
