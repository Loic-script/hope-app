import axios from 'axios';

export const URL_API = import.meta.env.VITE_API_URL || '/api';

export const URL_SERVEUR = URL_API.replace(/\/api\/?$/, '');

export function urlMedia(adresse) {
  if (!adresse) return null;
  if (/^(https?:)?\/\//.test(adresse)) return adresse;
  return `${URL_SERVEUR}${adresse.startsWith('/') ? '' : '/'}${adresse}`;
}

export const CLE_JETON = 'hope.admin.token';

export const TEMOIN_SESSION = 'session';
export const CLE_ADMIN = 'hope.admin.profil';

export function lireStockage(cle) {
  return localStorage.getItem(cle) ?? sessionStorage.getItem(cle);
}

export function ecrireStockage(cle, valeur, persistant) {
  const cible = persistant ? localStorage : sessionStorage;
  const autre = persistant ? sessionStorage : localStorage;
  autre.removeItem(cle);
  cible.setItem(cle, valeur);
}

export function effacerStockage(cle) {
  localStorage.removeItem(cle);
  sessionStorage.removeItem(cle);
}

export const api = axios.create({
  baseURL: URL_API,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
  withCredentials: true,
});

api.interceptors.response.use(
  (reponse) => reponse,
  (erreur) => {
    const urlAppelee = erreur?.config?.url ?? '';
    const chemin = window.location.pathname;
    const surLaPageDeConnexion = chemin.startsWith('/admin/login') || chemin.startsWith('/authentification');

    if (erreur?.response?.status === 401 && !urlAppelee.includes('/admin/login') && !surLaPageDeConnexion) {
      effacerStockage(CLE_JETON);
      effacerStockage(CLE_ADMIN);
      window.location.assign('/authentification?type=aucun');
    }
    return Promise.reject(erreur);
  }
);

export function messageErreur(erreur, messageParDefaut = 'Une erreur est survenue.') {
  if (erreur?.response?.data?.message) return erreur.response.data.message;
  if (erreur?.code === 'ECONNABORTED') return 'Le serveur met trop de temps a repondre.';
  if (erreur?.code === 'ERR_NETWORK') {
    return "Impossible de joindre le serveur HOPE. Verifiez que l'API est demarree.";
  }
  return messageParDefaut;
}
