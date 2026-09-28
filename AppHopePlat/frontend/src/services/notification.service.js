/**
 * Service frontend des notifications.
 */
import { api } from './api.js';

/** @param {{ type?: string, unread?: boolean }} filtres */
export async function lister(filtres = {}) {
  const { data } = await api.get('/admin/notifications', { params: filtres });
  return data;
}

export async function marquerLue(id) {
  const { data } = await api.patch(`/admin/notifications/${id}/read`);
  return data;
}

export async function toutMarquerLu() {
  const { data } = await api.patch('/admin/notifications/read-all');
  return data;
}
