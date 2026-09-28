/**
 * Service d'authentification cote frontend.
 *
 * Encapsule les appels a /api/admin/* et la conservation du jeton.
 *
 * Le JWT vit dans un cookie httpOnly pose par le serveur : le navigateur
 * ne garde que le profil (affichage) et un temoin de session, dans
 * localStorage si "Se souvenir de moi" est coche, sessionStorage sinon.
 */
import {
  api,
  CLE_ADMIN,
  CLE_JETON,
  TEMOIN_SESSION,
  ecrireStockage,
  effacerStockage,
  lireStockage,
} from './api.js';

/** Enregistre le temoin et le profil (le jeton est dans le cookie). */
function memoriserSession(admin, persistant) {
  ecrireStockage(CLE_JETON, TEMOIN_SESSION, persistant);
  ecrireStockage(CLE_ADMIN, JSON.stringify(admin), persistant);
}

/** Efface toute trace de session dans le navigateur. */
export function effacerSession() {
  effacerStockage(CLE_JETON);
  effacerStockage(CLE_ADMIN);
}

/** Le temoin de session, ou null : une session est-elle ouverte ? */
export function lireJeton() {
  return lireStockage(CLE_JETON);
}

/** Retourne le profil administrateur stocke, ou null. */
export function lireAdminLocal() {
  const brut = lireStockage(CLE_ADMIN);
  if (!brut) return null;
  try {
    return JSON.parse(brut);
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/login
 *
 * @param {string} adminLog identifiant de connexion
 * @param {string} password mot de passe en clair (transmis uniquement a l'API,
 *                          jamais stocke ni journalise cote navigateur)
 * @param {boolean} persistant conserver la session apres fermeture du navigateur
 * @returns {Promise<{ id: number, adminLog: string }>}
 */
export async function connecter(adminLog, password, persistant = true) {
  const { data } = await api.post('/admin/login', { adminLog, password, seSouvenir: persistant });
  memoriserSession(data.admin, persistant);
  return data.admin;
}

/**
 * GET /api/admin/me
 * Verifie aupres du backend que le jeton stocke est toujours valable.
 * @returns {Promise<{ id: number, adminLog: string }>}
 */
export async function recupererProfil() {
  const { data } = await api.get('/admin/me');
  if (!data?.authenticated) {
    throw new Error('Session non authentifiee.');
  }
  return data.admin;
}

/**
 * Deconnexion : previent l'API puis oublie le jeton localement.
 * L'echec de l'appel reseau ne doit jamais empecher la deconnexion locale.
 */
export async function deconnecter() {
  try {
    if (lireJeton()) {
      await api.post('/admin/logout');
    }
  } catch {
    // Jeton deja expire ou API injoignable : on continue.
  } finally {
    effacerSession();
  }
}
