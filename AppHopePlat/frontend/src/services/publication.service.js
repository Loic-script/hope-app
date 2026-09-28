/**
 * Actualites de l'espace bailleur, cote administration.
 */
import { api } from './api.js';

/** GET /api/admin/publications — avec les interets recus par chaque appel. */
export async function lister() {
  const { data } = await api.get('/admin/publications');
  return data;
}

/**
 * POST /api/admin/publications
 *
 * Publie et previent les bailleurs : la reponse dit combien.
 */
export async function creer(publication) {
  const { data } = await api.post('/admin/publications', publication);
  return data;
}

/** PATCH /api/admin/publications/:id — sans nouvelle notification. */
export async function modifier(id, publication) {
  const { data } = await api.patch(`/admin/publications/${id}`, publication);
  return data;
}

/** DELETE /api/admin/publications/:id */
export async function supprimer(id) {
  const { data } = await api.delete(`/admin/publications/${id}`);
  return data;
}

/**
 * POST /api/admin/publications/photo
 *
 * Televerse la photo et rend son adresse ; c'est l'enregistrement de la
 * publication qui la rattache. Le Content-Type a undefined laisse le
 * navigateur ecrire la frontiere du multipart.
 */
export async function televerserPhoto(fichier) {
  const formulaire = new FormData();
  formulaire.append('file', fichier);
  const { data } = await api.post('/admin/publications/photo', formulaire, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}

/** PATCH /api/admin/publications/interets/:id — contacte, converti, classe. */
export async function changerStatutInteret(id, statut) {
  const { data } = await api.patch(`/admin/publications/interets/${id}`, { statut });
  return data;
}
