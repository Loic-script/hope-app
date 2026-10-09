import axios from 'axios';

import { URL_API, ecrireStockage, effacerStockage, lireStockage } from './api.js';

export const CLE_JETON_DONATEUR = 'hope.donateur.token';
export const CLE_DONATEUR = 'hope.donateur.profil';

export const apiDonateur = axios.create({
  baseURL: URL_API,
  headers: { 'Content-Type': 'application/json', 'X-Hope-Espace': 'donateur' },
  timeout: 10000,
  withCredentials: true,
});

apiDonateur.interceptors.response.use(
  (reponse) => reponse,
  (erreur) => {
    const surLaPageDAcces = window.location.pathname.startsWith('/authentification');

    if (erreur?.response?.status === 401 && !surLaPageDAcces) {
      effacerStockage(CLE_JETON_DONATEUR);
      effacerStockage(CLE_DONATEUR);
      window.location.assign('/authentification');
    }
    return Promise.reject(erreur);
  }
);

export { ecrireStockage, effacerStockage, lireStockage };
