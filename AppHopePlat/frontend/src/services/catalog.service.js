/**
 * Service frontend des donnees de reference (categories, libelles, devises).
 *
 * Le catalogue change rarement : il est mis en cache pour la duree de la
 * session afin d'eviter un appel reseau a chaque changement de page.
 */
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
