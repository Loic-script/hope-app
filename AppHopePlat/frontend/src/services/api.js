/**
 * Client HTTP partage de l'application HOPE.
 *
 * Regle d'architecture : le navigateur ne parle qu'a l'API Node.
 * Il n'accede jamais directement a PostgreSQL et ne connait ni le mot de
 * passe de la base ni le secret JWT.
 */
import axios from 'axios';

/*
 * Relative par defaut : le serveur de developpement relaie "/api" vers le
 * backend (vite.config.js), et la page fonctionne ainsi depuis n'importe
 * quel appareil du reseau, telephone compris. En production, VITE_API_URL
 * donne l'adresse reelle si l'API n'est pas servie sur la meme origine.
 */
export const URL_API = import.meta.env.VITE_API_URL || '/api';

/**
 * Origine du serveur, sans le suffixe /api.
 * Les medias des projets sont servis a la racine, sous /media.
 */
export const URL_SERVEUR = URL_API.replace(/\/api\/?$/, '');

/**
 * Adresse affichable d'un media de projet.
 *
 * Un media televerse est stocke sous la forme "/media/projet-xxx.jpg" : il
 * faut le prefixer par l'origine du serveur. Une adresse externe fournie par
 * l'administrateur est deja complete et repart telle quelle.
 */
export function urlMedia(adresse) {
  if (!adresse) return null;
  if (/^(https?:)?\/\//.test(adresse)) return adresse;
  return `${URL_SERVEUR}${adresse.startsWith('/') ? '' : '/'}${adresse}`;
}

/**
 * Cle du temoin de session de l'administrateur.
 *
 * Le jeton JWT lui-meme n'est plus dans le navigateur : le serveur le
 * range dans un cookie httpOnly, que JavaScript ne peut pas lire. Cette
 * cle ne garde que TEMOIN_SESSION -- "une session est ouverte" -- pour
 * que les pages sachent s'il faut afficher l'espace ou la connexion.
 */
export const CLE_JETON = 'hope.admin.token';

/** La valeur du temoin : rien de secret. */
export const TEMOIN_SESSION = 'session';
/** Cle de stockage du profil administrateur (affichage uniquement). */
export const CLE_ADMIN = 'hope.admin.profil';

/**
 * Lit une valeur dans le stockage persistant puis, a defaut, dans le
 * stockage de session ("Se souvenir de moi" decoche).
 */
export function lireStockage(cle) {
  return localStorage.getItem(cle) ?? sessionStorage.getItem(cle);
}

/** Ecrit une valeur dans le stockage choisi et nettoie l'autre. */
export function ecrireStockage(cle, valeur, persistant) {
  const cible = persistant ? localStorage : sessionStorage;
  const autre = persistant ? sessionStorage : localStorage;
  autre.removeItem(cle);
  cible.setItem(cle, valeur);
}

/** Supprime une valeur des deux stockages. */
export function effacerStockage(cle) {
  localStorage.removeItem(cle);
  sessionStorage.removeItem(cle);
}

export const api = axios.create({
  baseURL: URL_API,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
  // Le cookie de session accompagne chaque appel.
  withCredentials: true,
});

/**
 * Session expiree : on efface le jeton et on renvoie vers la page de
 * connexion. Sans cela, l'espace admin resterait affiche avec des tableaux
 * vides alors que l'API refuse toutes les requetes.
 *
 * L'echec du formulaire de connexion lui-meme est laisse a la page /login,
 * qui doit afficher son message d'erreur plutot que se recharger.
 */
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

/**
 * Traduit une erreur Axios en message affichable.
 * On privilegie toujours le message renvoye par l'API.
 */
export function messageErreur(erreur, messageParDefaut = 'Une erreur est survenue.') {
  if (erreur?.response?.data?.message) return erreur.response.data.message;
  if (erreur?.code === 'ECONNABORTED') return 'Le serveur met trop de temps a repondre.';
  if (erreur?.code === 'ERR_NETWORK') {
    return "Impossible de joindre le serveur HOPE. Verifiez que l'API est demarree.";
  }
  return messageParDefaut;
}
