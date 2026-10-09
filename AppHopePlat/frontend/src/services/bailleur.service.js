import { TEMOIN_SESSION } from './api.js';
import {
  apiBailleur,
  CLE_BAILLEUR,
  CLE_JETON_BAILLEUR,
  ecrireStockage,
  effacerStockage,
  lireStockage,
} from './apiBailleur.js';

function memoriserSession(bailleur, persistant) {
  ecrireStockage(CLE_JETON_BAILLEUR, TEMOIN_SESSION, persistant);
  ecrireStockage(CLE_BAILLEUR, JSON.stringify(bailleur), persistant);
}

export function effacerSession() {
  effacerStockage(CLE_JETON_BAILLEUR);
  effacerStockage(CLE_BAILLEUR);
}

export function lireJeton() {
  return lireStockage(CLE_JETON_BAILLEUR);
}

export function lireBailleurLocal() {
  const brut = lireStockage(CLE_BAILLEUR);
  if (!brut) return null;
  try {
    return JSON.parse(brut);
  } catch {
    return null;
  }
}

export async function typesOrganisation() {
  const { data } = await apiBailleur.get('/bailleur/types-organisation');
  return data.items ?? [];
}

export async function inscrire(corps) {
  const { data } = await apiBailleur.post('/bailleur/inscription', corps);
  return { bailleur: data.bailleur, message: data.message };
}

export async function connecter(email, motDePasse, persistant = true) {
  const { data } = await apiBailleur.post('/bailleur/login', { email, motDePasse, seSouvenir: persistant });
  memoriserSession(data.bailleur, persistant);
  return data.bailleur;
}

export async function recupererProfil() {
  const { data } = await apiBailleur.get('/bailleur/me');
  if (!data?.authenticated) throw new Error('Session non authentifiee.');
  return data.bailleur;
}

export async function deconnecter() {
  try {
    if (lireJeton()) await apiBailleur.post('/bailleur/logout');
  } catch {
  } finally {
    effacerSession();
  }
}

export async function tableauDeBord() {
  const { data } = await apiBailleur.get('/bailleur/tableau-de-bord');
  return data;
}

export async function paiements() {
  const { data } = await apiBailleur.get('/bailleur/paiements');
  return data;
}

export async function versements(filtres = {}) {
  const { data } = await apiBailleur.get('/bailleur/versements', { params: filtres });
  return data.items ?? [];
}

export async function projets() {
  const { data } = await apiBailleur.get('/bailleur/projets');
  return data.items ?? [];
}

export async function projet(id) {
  const { data } = await apiBailleur.get(`/bailleur/projets/${id}`);
  return data;
}

export async function rapportProjet(id) {
  const { data } = await apiBailleur.get(`/bailleur/projets/${id}/rapport`);
  return data;
}

export async function telechargerRapportProjet(id, reference) {
  let reponse;
  try {
    reponse = await apiBailleur.get(`/bailleur/projets/${id}/rapport/pdf`, {
      responseType: 'blob',
      timeout: 30000,
    });
  } catch (echec) {
    const corps = echec?.response?.data;
    if (corps instanceof Blob) {
      try {
        echec.response.data = JSON.parse(await corps.text());
      } catch {
      }
    }
    throw echec;
  }

  const url = URL.createObjectURL(reponse.data);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `rapport-impact-${reference ?? id}.pdf`;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function documents(filtres = {}) {
  const { data } = await apiBailleur.get('/bailleur/documents', { params: filtres });
  return data;
}

export async function apercuDocument(id) {
  const { data } = await apiBailleur.get(`/bailleur/documents/${id}/apercu`);
  return data;
}

export async function telechargerDocument(id) {
  const { data } = await apiBailleur.post(`/bailleur/documents/${id}/telechargement`);
  return data;
}

export async function genererCertificat() {
  const { data } = await apiBailleur.post('/bailleur/certificat');
  return data;
}

export async function optionsDon() {
  const { data } = await apiBailleur.get('/bailleur/dons/options');
  return data;
}

export async function faireUnDon(don) {
  const { data } = await apiBailleur.post('/bailleur/dons', don);
  return data;
}

export async function coordonneesDePaiement() {
  const { data } = await apiBailleur.get('/bailleur/paiement/coordonnees');
  return data;
}

export async function reglagesCarte() {
  const { data } = await apiBailleur.get('/bailleur/paiement/carte');
  return data;
}

export async function ouvrirPaiementCarte(corps) {
  const { data } = await apiBailleur.post('/bailleur/paiement/carte/session', corps);
  return data;
}

export async function etatPaiementCarte(sessionId) {
  const { data } = await apiBailleur.get(`/bailleur/paiement/carte/session/${sessionId}`);
  return data;
}

export async function declarerPaiement(id, referencePaiement) {
  const { data } = await apiBailleur.patch(`/bailleur/dons/${id}/justificatif`, { referencePaiement });
  return data;
}

export async function fil() {
  const { data } = await apiBailleur.get('/bailleur/fil');
  return data.items ?? [];
}

export async function manifesterUnInteret(corps) {
  const { data } = await apiBailleur.post('/bailleur/interet', corps);
  return data;
}

export async function profil() {
  const { data } = await apiBailleur.get('/bailleur/profil');
  return data;
}

export async function mettreAJourOrganisation(corps) {
  const { data } = await apiBailleur.patch('/bailleur/organisation', corps);
  return data;
}

export async function mettreAJourContact(corps) {
  const { data } = await apiBailleur.patch('/bailleur/profil/contact', corps);
  return data;
}

export async function televerserPhoto(fichier) {
  const formulaire = new FormData();
  formulaire.append('file', fichier);

  const { data } = await apiBailleur.post('/bailleur/profil/photo', formulaire, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}
