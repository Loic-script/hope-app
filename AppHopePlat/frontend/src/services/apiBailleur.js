/**
 * Client HTTP de l'espace bailleur.
 *
 * Troisieme instance axios de l'application, pour la meme raison que
 * celle des benevoles : trois espaces, trois cles de stockage, trois
 * pages de connexion. Les partager ferait qu'une session expiree d'un
 * cote renverrait l'autre vers la mauvaise page, et qu'ouvrir deux
 * espaces dans le meme navigateur ecraserait un jeton avec l'autre.
 */
import axios from 'axios';

import { URL_API, ecrireStockage, effacerStockage, lireStockage } from './api.js';

export const CLE_JETON_BAILLEUR = 'hope.bailleur.token';
export const CLE_BAILLEUR = 'hope.bailleur.profil';

export const apiBailleur = axios.create({
  baseURL: URL_API,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

apiBailleur.interceptors.request.use((requete) => {
  const jeton = lireStockage(CLE_JETON_BAILLEUR);
  if (jeton) {
    requete.headers.Authorization = `Bearer ${jeton}`;
  }
  return requete;
});

/**
 * Session expiree : on oublie le jeton et on renvoie vers la connexion
 * bailleur -- pas vers celle d'un autre espace.
 */
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
