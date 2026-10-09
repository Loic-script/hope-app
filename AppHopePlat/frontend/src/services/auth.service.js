import {
  api,
  CLE_ADMIN,
  CLE_JETON,
  TEMOIN_SESSION,
  ecrireStockage,
  effacerStockage,
  lireStockage,
} from './api.js';

function memoriserSession(admin, persistant) {
  ecrireStockage(CLE_JETON, TEMOIN_SESSION, persistant);
  ecrireStockage(CLE_ADMIN, JSON.stringify(admin), persistant);
}

export function effacerSession() {
  effacerStockage(CLE_JETON);
  effacerStockage(CLE_ADMIN);
}

export function lireJeton() {
  return lireStockage(CLE_JETON);
}

export function lireAdminLocal() {
  const brut = lireStockage(CLE_ADMIN);
  if (!brut) return null;
  try {
    return JSON.parse(brut);
  } catch {
    return null;
  }
}

export async function connecter(adminLog, password, persistant = true) {
  const { data } = await api.post('/admin/login', { adminLog, password, seSouvenir: persistant });
  memoriserSession(data.admin, persistant);
  return data.admin;
}

export async function recupererProfil() {
  const { data } = await api.get('/admin/me');
  if (!data?.authenticated) {
    throw new Error('Session non authentifiee.');
  }
  return data.admin;
}

export async function deconnecter() {
  try {
    if (lireJeton()) {
      await api.post('/admin/logout');
    }
  } catch {
  } finally {
    effacerSession();
  }
}
