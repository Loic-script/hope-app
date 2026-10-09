import { api } from './api.js';

export async function recuperer() {
  const { data } = await api.get('/admin/statistics');
  return data;
}
