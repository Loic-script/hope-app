/**
 * Service des comptes bailleurs, cote espace administrateur.
 *
 * Passe par le client admin : ces routes sont protegees par le jeton de
 * l'administrateur, pas par celui du bailleur.
 */
import { api } from './api.js';

/**
 * GET /api/admin/funders
 * @param {{ statut?: string }} filtres
 * @returns {Promise<{ items: object[], counts: Record<string, number> }>}
 */
export async function lister(filtres = {}) {
  const { data } = await api.get('/admin/funders', { params: filtres });
  return data;
}

/** POST /api/admin/funders/:id/activate */
export async function activer(id) {
  const { data } = await api.post(`/admin/funders/${id}/activate`);
  return data;
}

/** PATCH /api/admin/funders/:id/status */
export async function changerStatut(id, statut) {
  const { data } = await api.patch(`/admin/funders/${id}/status`, { statut });
  return data;
}
