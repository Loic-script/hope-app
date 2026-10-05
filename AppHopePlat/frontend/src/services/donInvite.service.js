/**
 * Le don sans compte, depuis "Faire un don" du site vitrine.
 *
 * Aucune session : les appels passent par un client nu, et le jeton que
 * le serveur remet avec le don voyage dans l'en-tete X-Hope-Don. Il
 * n'autorise que deux choses, sur ce don seulement : signaler son
 * paiement, et lire l'etat d'un paiement par carte.
 */
import axios from 'axios';

import { URL_API } from './api.js';

const apiPublic = axios.create({
  baseURL: URL_API,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

/** L'en-tete qui porte le jeton du don. */
function avecJeton(jeton) {
  return jeton ? { headers: { 'X-Hope-Don': jeton } } : {};
}

/**
 * GET /api/public/dons/options : les modes de paiement, les devises et
 * les projets que l'on peut soutenir.
 */
export async function options() {
  const { data } = await apiPublic.get('/public/dons/options');
  return data;
}

/** GET /api/public/dons/coordonnees : ou envoyer un don hors ligne. */
export async function coordonneesDePaiement() {
  const { data } = await apiPublic.get('/public/dons/coordonnees');
  return data;
}

/**
 * POST /api/public/dons : la promesse d'un don sans compte.
 *
 * @param {{ donateur: object, affectation, projetId?, montant, devise, mode,
 *           message?, referencePaiement?, numeroPayeur? }} don
 * @returns {Promise<{ don: object, message: string, jeton: string }>}
 */
export async function faireUnDon(don) {
  const { data } = await apiPublic.post('/public/dons', don);
  return data;
}

/** PATCH /api/public/dons/:id/justificatif : le paiement signale, avec sa reference. */
export async function declarerPaiement(id, referencePaiement, jeton) {
  const { data } = await apiPublic.patch(`/public/dons/${id}/justificatif`, { referencePaiement }, avecJeton(jeton));
  return data;
}

/** GET /api/public/dons/paiement/carte : la carte est-elle acceptee ici ? */
export async function reglagesCarte() {
  const { data } = await apiPublic.get('/public/dons/paiement/carte');
  return data;
}

/** POST /api/public/dons/paiement/carte/session : le don, puis la session Stripe. */
export async function ouvrirPaiementCarte(corps) {
  const { data } = await apiPublic.post('/public/dons/paiement/carte/session', corps);
  return data;
}

/** GET /api/public/dons/paiement/carte/session/:id : ou en est ce paiement. */
export async function etatPaiementCarte(sessionId, jeton) {
  const { data } = await apiPublic.get(`/public/dons/paiement/carte/session/${sessionId}`, avecJeton(jeton));
  return data;
}
