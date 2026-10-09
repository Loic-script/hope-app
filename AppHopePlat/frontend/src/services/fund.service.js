import { api } from './api.js';

export async function etat() {
  const { data } = await api.get('/admin/fund');
  return data;
}

export async function listerInvestissements(filtres = {}) {
  const { data } = await api.get('/admin/investments', { params: filtres });
  return data;
}

export async function investir(investissement) {
  const { data } = await api.post('/admin/investments', investissement);
  return data;
}
