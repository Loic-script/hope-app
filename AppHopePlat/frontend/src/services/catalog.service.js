import { api } from './api.js';

let cache = null;

export async function recuperer({ rafraichir = false } = {}) {
  if (cache && !rafraichir) return cache;
  const { data } = await api.get('/admin/catalog');
  cache = data;
  return cache;
}

export async function creerCategorie(categorie) {
  const { data } = await api.post('/admin/categories', categorie);
  cache = null;
  return data;
}

export function viderCache() {
  cache = null;
}
