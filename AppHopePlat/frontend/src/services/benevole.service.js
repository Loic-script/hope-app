import { TEMOIN_SESSION } from './api.js';
import {
  apiBenevole,
  CLE_BENEVOLE,
  CLE_JETON_BENEVOLE,
  ecrireStockage,
  effacerStockage,
  lireStockage,
} from './apiBenevole.js';

function memoriserSession(benevole, persistant) {
  ecrireStockage(CLE_JETON_BENEVOLE, TEMOIN_SESSION, persistant);
  ecrireStockage(CLE_BENEVOLE, JSON.stringify(benevole), persistant);
}

export function effacerSession() {
  effacerStockage(CLE_JETON_BENEVOLE);
  effacerStockage(CLE_BENEVOLE);
}

export function lireJeton() {
  return lireStockage(CLE_JETON_BENEVOLE);
}

export function lireBenevoleLocal() {
  const brut = lireStockage(CLE_BENEVOLE);
  if (!brut) return null;
  try {
    return JSON.parse(brut);
  } catch {
    return null;
  }
}

export async function inscrire({ nom, prenom, email, motDePasse, confirmation }) {
  const { data } = await apiBenevole.post('/benevole/inscription', {
    nom,
    prenom,
    email,
    motDePasse,
    confirmation,
  });
  return { benevole: data.benevole, message: data.message };
}

export async function connecter(email, motDePasse, persistant = true) {
  const { data } = await apiBenevole.post('/benevole/login', { email, motDePasse, seSouvenir: persistant });
  memoriserSession(data.benevole, persistant);
  return data.benevole;
}

export async function recupererProfil() {
  const { data } = await apiBenevole.get('/benevole/me');
  if (!data?.authenticated) {
    throw new Error('Session non authentifiee.');
  }
  return data.benevole;
}

export async function deconnecter() {
  try {
    if (lireJeton()) {
      await apiBenevole.post('/benevole/logout');
    }
  } catch {
  } finally {
    effacerSession();
  }
}
