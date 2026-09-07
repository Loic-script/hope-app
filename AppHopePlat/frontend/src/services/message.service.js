/**
 * Service frontend de la messagerie des donateurs.
 */
import { api } from './api.js';

export async function lister(filtres = {}) {
  const { data } = await api.get('/admin/messages', { params: filtres });
  return data;
}

export async function recuperer(id) {
  const { data } = await api.get(`/admin/messages/${id}`);
  return data;
}

export async function creer(message) {
  const { data } = await api.post('/admin/messages', message);
  return data;
}

export async function marquerLu(id) {
  const { data } = await api.patch(`/admin/messages/${id}/read`);
  return data;
}

/**
 * @param {number} id message a traiter
 * @param {string} reply texte de la reponse
 * @param {{ force?: boolean }} options force = remplacer une reponse existante
 */
export async function repondre(id, reply, { force = false } = {}) {
  const { data } = await api.patch(`/admin/messages/${id}/reply`, { reply, force });
  return data;
}
