/**
 * Service frontend de la page d'accueil administrateur.
 */
import { api } from './api.js';

export async function recupererAccueil() {
  const { data } = await api.get('/admin/dashboard');
  return data;
}
