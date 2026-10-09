import axios from 'axios';

import { URL_API } from './api.js';

const apiPublic = axios.create({
  baseURL: URL_API,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

function avecJeton(jeton) {
  return jeton ? { headers: { 'X-Hope-Don': jeton } } : {};
}

export async function options() {
  const { data } = await apiPublic.get('/public/dons/options');
  return data;
}

export async function coordonneesDePaiement() {
  const { data } = await apiPublic.get('/public/dons/coordonnees');
  return data;
}

export async function faireUnDon(don) {
  const { data } = await apiPublic.post('/public/dons', don);
  return data;
}

export async function declarerPaiement(id, referencePaiement, jeton) {
  const { data } = await apiPublic.patch(`/public/dons/${id}/justificatif`, { referencePaiement }, avecJeton(jeton));
  return data;
}

export async function reglagesCarte() {
  const { data } = await apiPublic.get('/public/dons/paiement/carte');
  return data;
}

export async function ouvrirPaiementCarte(corps) {
  const { data } = await apiPublic.post('/public/dons/paiement/carte/session', corps);
  return data;
}

export async function etatPaiementCarte(sessionId, jeton) {
  const { data } = await apiPublic.get(`/public/dons/paiement/carte/session/${sessionId}`, avecJeton(jeton));
  return data;
}
