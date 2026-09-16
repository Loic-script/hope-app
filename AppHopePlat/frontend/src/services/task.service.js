/**
 * Les taches d'un projet, cote administration.
 *
 * L'equipe les pose et les retire ; ce sont les benevoles qui les
 * prennent, depuis leur propre espace et leur propre service.
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
