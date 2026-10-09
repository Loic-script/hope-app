import axios from 'axios';

import { URL_API, ecrireStockage, effacerStockage, lireStockage } from './api.js';

export const CLE_JETON_BENEVOLE = 'hope.benevole.token';
export const CLE_BENEVOLE = 'hope.benevole.profil';

export const apiBenevole = axios.create({
  baseURL: URL_API,
  headers: { 'Content-Type': 'application/json', 'X-Hope-Espace': 'benevole' },
  timeout: 10000,
  withCredentials: true,
});

apiBenevole.interceptors.response.use(
  (reponse) => reponse,
  (erreur) => {
    const url = erreur?.config?.url ?? '';
    const surUnePagePublique =
      window.location.pathname.startsWith('/benevole/login') ||
      window.location.pathname.startsWith('/benevole/inscription');
    const appelPublic = url.includes('/benevole/login') || url.includes('/benevole/inscription');

    if (erreur?.response?.status === 401 && !appelPublic && !surUnePagePublique) {
      effacerStockage(CLE_JETON_BENEVOLE);
      effacerStockage(CLE_BENEVOLE);
      window.location.assign('/benevole/login');
    }
    return Promise.reject(erreur);
  }
);

export { ecrireStockage, effacerStockage, lireStockage };
