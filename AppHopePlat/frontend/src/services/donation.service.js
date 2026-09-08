/**
 * Service frontend des dons.
 */
import { api } from './api.js';

/**
 * @param {{ allocation?: 'PROJECT'|'HOPE', frequency?: string, status?: string,
 *           origin?: string, projectId?: number, donorId?: number, search?: string }} filtres
 */
export async function lister(filtres = {}) {
  const { data } = await api.get('/admin/donations', { params: filtres });
  return data;
}

export async function recuperer(id) {
  const { data } = await api.get(`/admin/donations/${id}`);
  return data;
}

export async function creer(don) {
  const { data } = await api.post('/admin/donations', don);
  return data;
}

export async function changerStatut(id, status) {
  const { data } = await api.patch(`/admin/donations/${id}/status`, { status });
  return data;
}

/**
 * Genere les echeances des dons mensuels du mois en cours.
 *
 * Ce n'est PAS un prelevement : les occurrences sont creees en attente,
 * et l'administrateur les passe a "encaisse" quand l'argent arrive.
 */
export async function genererEcheancesMensuelles() {
  const { data } = await api.post('/admin/donations/generate-monthly');
  return data;
}
