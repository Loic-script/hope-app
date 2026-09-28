/**
 * Service des benevoles, cote espace administrateur.
 *
 * Passe par le client admin : ces routes sont protegees par le jeton de
 * l'administrateur, pas par celui du benevole.
 */
import { api } from './api.js';

/**
 * GET /api/admin/volunteers
 * @param {{ statut?: string }} filtres
 * @returns {Promise<{ items: object[], counts: Record<string, number> }>}
 */
export async function lister(filtres = {}) {
  const { data } = await api.get('/admin/volunteers', { params: filtres });
  return data;
}

/** POST /api/admin/volunteers/:id/activate */
export async function activer(id) {
  const { data } = await api.post(`/admin/volunteers/${id}/activate`);
  return data;
}

/** PATCH /api/admin/volunteers/:id/status */
export async function changerStatut(id, statut) {
  const { data } = await api.patch(`/admin/volunteers/${id}/status`, { statut });
  return data;
}
