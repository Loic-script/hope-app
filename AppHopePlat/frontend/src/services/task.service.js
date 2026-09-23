/**
 * Les taches, cote administration.
 *
 * L'equipe les pose, les confie a un ou plusieurs benevoles, et decide
 * des demandes que les benevoles envoient depuis leur espace.
 */
import { api, URL_API } from './api.js';
import { lireJeton } from './auth.service.js';

/** GET /api/admin/projects/:id/tasks */
export async function listerParProjet(projetId) {
  const { data } = await api.get(`/admin/projects/${projetId}/tasks`);
  return data;
}

/** POST /api/admin/projects/:id/tasks */
export async function creer(projetId, tache) {
  const { data } = await api.post(`/admin/projects/${projetId}/tasks`, tache);
  return data;
}

/** GET /api/admin/taches — toutes les taches, et les compteurs des onglets. */
export async function listerTout(filtres = {}) {
  const { data } = await api.get('/admin/taches', { params: filtres });
  return data;
}

/** GET /api/admin/taches/:id — la tache, son equipe et ses demandes. */
export async function recuperer(id) {
  const { data } = await api.get(`/admin/taches/${id}`);
  return data;
}

/** GET /api/admin/taches/benevoles — ceux qu'on peut affecter. */
export async function benevoles() {
  const { data } = await api.get('/admin/taches/benevoles');
  return data.items ?? [];
}

/** PATCH /api/admin/taches/:id — modifie une tache deja creee. */
export async function modifier(id, tache) {
  const { data } = await api.patch(`/admin/taches/${id}`, tache);
  return data;
}

/** POST /api/admin/taches/:id/equipe — affecte un ou plusieurs benevoles. */
export async function affecter(id, benevoleIds) {
  const { data } = await api.post(`/admin/taches/${id}/equipe`, { benevoleIds });
  return data;
}

/** DELETE /api/admin/taches/:id/equipe/:benevoleId */
export async function retirer(id, benevoleId) {
  const { data } = await api.delete(`/admin/taches/${id}/equipe/${benevoleId}`);
  return data;
}

/** POST /api/admin/taches/:id/demandes/:benevoleId/accepter */
export async function accepter(id, benevoleId) {
  const { data } = await api.post(`/admin/taches/${id}/demandes/${benevoleId}/accepter`);
  return data;
}

/** POST /api/admin/taches/:id/demandes/:benevoleId/refuser */
export async function refuser(id, benevoleId) {
  const { data } = await api.post(`/admin/taches/${id}/demandes/${benevoleId}/refuser`);
  return data;
}

/** DELETE /api/admin/tasks/:id */
export async function supprimer(id) {
  const { data } = await api.delete(`/admin/tasks/${id}`);
  return data;
}

/**
 * Un fichier joint par le benevole a sa livraison, sous forme d'URL
 * locale -- le fichier est servi derriere le jeton de l'equipe.
 *
 * @returns {Promise<string|null>}
 */
export async function urlDuFichier(tache, fichier) {
  if (!tache?.id || !fichier?.id) return null;

  const reponse = await fetch(`${URL_API}/admin/tasks/${tache.id}/files/${fichier.id}`, {
    headers: { Authorization: `Bearer ${lireJeton()}` },
  });
  if (!reponse.ok) return null;
  return URL.createObjectURL(await reponse.blob());
}
