/**
 * Service d'authentification de l'espace benevole, cote frontend.
 *
 * Encapsule les appels a /api/benevole/* et la conservation du jeton.
 *
 * Comme pour l'administrateur, le JWT est conserve dans le navigateur
 * pour cette version locale ; une mise en production utiliserait un
 * cookie httpOnly + SameSite.
 */
import { TEMOIN_SESSION } from './api.js';
import {
  apiBenevole,
  CLE_BENEVOLE,
  CLE_JETON_BENEVOLE,
  ecrireStockage,
  effacerStockage,
  lireStockage,
} from './apiBenevole.js';

/** Enregistre le jeton et le profil retournes par le backend. */
function memoriserSession(benevole, persistant) {
  // Le jeton est dans le cookie httpOnly : ici, le seul temoin.
  ecrireStockage(CLE_JETON_BENEVOLE, TEMOIN_SESSION, persistant);
  ecrireStockage(CLE_BENEVOLE, JSON.stringify(benevole), persistant);
}

/** Efface toute trace de session benevole dans le navigateur. */
export function effacerSession() {
  effacerStockage(CLE_JETON_BENEVOLE);
  effacerStockage(CLE_BENEVOLE);
}

/** Retourne le jeton stocke, ou null. */
export function lireJeton() {
  return lireStockage(CLE_JETON_BENEVOLE);
}

/** Retourne le profil stocke, ou null. */
export function lireBenevoleLocal() {
  const brut = lireStockage(CLE_BENEVOLE);
  if (!brut) return null;
  try {
    return JSON.parse(brut);
  } catch {
    return null;
  }
}

/**
 * POST /api/benevole/inscription
 *
 * Ne connecte pas : le compte est cree en attente de validation. C'est
 * pourquoi rien n'est memorise ici.
 *
 * @returns {Promise<{ benevole: object, message: string }>}
 */
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

/**
 * POST /api/benevole/login
 *
 * @param {string} email
 * @param {string} motDePasse transmis uniquement a l'API, jamais stocke
 * @param {boolean} persistant conserver la session apres fermeture
 */
export async function connecter(email, motDePasse, persistant = true) {
  const { data } = await apiBenevole.post('/benevole/login', { email, motDePasse, seSouvenir: persistant });
  memoriserSession(data.benevole, persistant);
  return data.benevole;
}

/**
 * GET /api/benevole/me
 * Verifie aupres du backend que le jeton stocke est toujours valable.
 */
export async function recupererProfil() {
  const { data } = await apiBenevole.get('/benevole/me');
  if (!data?.authenticated) {
    throw new Error('Session non authentifiee.');
  }
  return data.benevole;
}

/** Deconnexion : previent l'API puis oublie le jeton localement. */
export async function deconnecter() {
  try {
    if (lireJeton()) {
      await apiBenevole.post('/benevole/logout');
    }
  } catch {
    // Jeton deja expire ou API injoignable : on continue.
  } finally {
    effacerSession();
  }
}
