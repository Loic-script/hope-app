import axios from 'axios';

import { URL_API, ecrireStockage, effacerStockage, lireStockage } from './api.js';

export const CLE_JETON_BAILLEUR = 'hope.bailleur.token';
export const CLE_BAILLEUR = 'hope.bailleur.profil';

export const apiBailleur = axios.create({
  baseURL: URL_API,
  headers: { 'Content-Type': 'application/json', 'X-Hope-Espace': 'bailleur' },
  timeout: 10000,
  withCredentials: true,
});

apiBailleur.interceptors.response.use(
  (reponse) => reponse,
  (erreur) => {
    const url = erreur?.config?.url ?? '';
    const surUnePagePublique =
      window.location.pathname.startsWith('/bailleur/login') ||
      window.location.pathname.startsWith('/bailleur/inscription');
    const appelPublic =
      url.includes('/bailleur/login') ||
      url.includes('/bailleur/inscription') ||
      url.includes('/bailleur/types-organisation');

    if (erreur?.response?.status === 401 && !appelPublic && !surUnePagePublique) {
      effacerStockage(CLE_JETON_BAILLEUR);
      effacerStockage(CLE_BAILLEUR);
      window.location.assign('/bailleur/login');
    }
    return Promise.reject(erreur);
  }
);

export { ecrireStockage, effacerStockage, lireStockage };
