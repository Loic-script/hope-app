/**
 * Client HTTP de l'espace benevole.
 *
 * Volontairement separe de celui de l'administrateur : deux instances
 * axios, deux cles de stockage, deux pages de connexion. Les partager
 * ferait qu'une session expiree d'un cote renverrait l'autre vers la
 * mauvaise page, et qu'ouvrir les deux espaces dans le meme navigateur
 * ecraserait un jeton avec l'autre.
 */
import axios from 'axios';

import { URL_API, ecrireStockage, effacerStockage, lireStockage } from './api.js';

/** Cle de stockage du jeton du benevole. */
export const CLE_JETON_BENEVOLE = 'hope.benevole.token';
/** Cle de stockage du profil, pour l'affichage uniquement. */
export const CLE_BENEVOLE = 'hope.benevole.profil';

export const apiBenevole = axios.create({
  baseURL: URL_API,
  // X-Hope-Espace dit au serveur quel cookie lire sur les routes
  // communes (/espace) ; le jeton, lui, voyage dans le cookie httpOnly.
  headers: { 'Content-Type': 'application/json', 'X-Hope-Espace': 'benevole' },
  timeout: 10000,
  withCredentials: true,
});

/**
 * Session expiree : on oublie le jeton et on renvoie vers la connexion
 * benevole -- pas vers celle de l'administrateur.
 *
 * Les echecs des formulaires eux-memes sont laisses aux pages, qui
 * doivent afficher leur message plutot que recharger.
 */
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
