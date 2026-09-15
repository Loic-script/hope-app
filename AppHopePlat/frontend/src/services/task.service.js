/**
 * Les taches d'un projet, cote administration.
 *
 * L'equipe les pose et les retire ; ce sont les benevoles qui les
 * prennent, depuis leur propre espace et leur propre service.
 */
import { api } from './api.js';

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
