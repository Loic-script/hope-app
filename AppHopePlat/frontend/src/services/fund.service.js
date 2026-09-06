/**
 * Service frontend du budget : etat du fonds HOPE et investissements.
 */
import { api } from './api.js';

/**
 * Etat complet du budget : sommes affectee / HOPE / totale, part deja
 * investie, et la liste des projets pouvant encore recevoir des fonds.
 */
export async function etat() {
  const { data } = await api.get('/admin/fund');
  return data;
}

export async function listerInvestissements(filtres = {}) {
  const { data } = await api.get('/admin/investments', { params: filtres });
  return data;
}

/**
 * Investit une part du fonds HOPE dans un projet.
 * @param {{ projectId: number, amount: string, justification: string, investedAt?: string }} investissement
 */
export async function investir(investissement) {
  const { data } = await api.post('/admin/investments', investissement);
  return data;
}
