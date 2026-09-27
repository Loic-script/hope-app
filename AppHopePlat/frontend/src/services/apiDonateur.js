/**
 * Client HTTP de l'espace donateur.
 *
 * L'espace n'est pas encore construit : il n'y a qu'une page de
 * bienvenue. Le client existe deja pour qu'elle s'appuie sur le meme
 * mecanisme que les trois autres, et pour que la suite s'y greffe sans
 * le refaire.
 */
import axios from 'axios';

import { URL_API, ecrireStockage, effacerStockage, lireStockage } from './api.js';

export const CLE_JETON_DONATEUR = 'hope.donateur.token';
export const CLE_DONATEUR = 'hope.donateur.profil';

export const apiDonateur = axios.create({
  baseURL: URL_API,
  // X-Hope-Espace dit au serveur quel cookie lire sur les routes
  // communes (/espace) ; le jeton, lui, voyage dans le cookie httpOnly.
  headers: { 'Content-Type': 'application/json', 'X-Hope-Espace': 'donateur' },
  timeout: 10000,
  withCredentials: true,
});

/**
 * Session expiree : on oublie le jeton et on renvoie vers la page
 * d'authentification commune, la seule porte d'entree des utilisateurs.
 */
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
