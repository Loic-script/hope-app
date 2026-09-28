/**
 * Les sessions : un cookie httpOnly par espace.
 *
 * Le jeton JWT ne vit plus dans le navigateur a portee de JavaScript
 * (localStorage) : un script injecte dans la page ne peut pas le lire.
 * Le serveur le depose dans un cookie
 *
 *   - httpOnly  : invisible pour JavaScript ;
 *   - SameSite=Strict : jamais envoye par une requete venue d'un autre
 *     site (protection contre la falsification de requete, CSRF) ;
 *   - Secure en production : jamais en clair ;
 *   - limite a /api : les pages et les medias ne le recoivent pas.
 *
 * Un cookie par espace (admin, donateur, benevole, bailleur) : ouvrir
 * l'administration et un espace dans le meme navigateur ne melange rien.
 *
 * L'en-tete "Authorization: Bearer" reste accepte, en premier : il sert
 * aux clients d'API et aux tests. Un navigateur n'en envoie plus.
 */
import jwt from 'jsonwebtoken';

import { config } from '../config/env.js';
import { ErreurAuthentification } from './errors.js';

export const COOKIES = {
  admin: 'hope_admin',
  donateur: 'hope_donateur',
  benevole: 'hope_benevole',
  bailleur: 'hope_bailleur',
};

const ESPACES_UTILISATEUR = ['donateur', 'benevole', 'bailleur'];

/** Les cookies de la requete, sans dependance : "a=1; b=2" -> { a, b }. */
export function lireCookies(req) {
  const cookies = {};
  const entete = req.headers.cookie;
  if (!entete || typeof entete !== 'string') return cookies;
  for (const morceau of entete.split(';')) {
    const egal = morceau.indexOf('=');
    if (egal < 1) continue;
    const nom = morceau.slice(0, egal).trim();
    const valeur = morceau.slice(egal + 1).trim();
    try {
      cookies[nom] = decodeURIComponent(valeur);
    } catch {
      cookies[nom] = valeur;
    }
  }
  return cookies;
}

/** Le jeton de l'en-tete Authorization, s'il y en a un. */
function jetonDeLEntete(req) {
  const entete = req.headers.authorization;
  if (!entete || typeof entete !== 'string') return null;
  const [schema, valeur] = entete.split(' ');
  if (!valeur || schema.toLowerCase() !== 'bearer') return null;
  const jeton = valeur.trim();
  return jeton === '' ? null : jeton;
}

/**
 * Le jeton d'un espace : l'en-tete d'abord, puis le cookie de l'espace.
 * @param {'admin'|'donateur'|'benevole'|'bailleur'} espace
 */
export function lireJeton(req, espace) {
  return jetonDeLEntete(req) ?? (lireCookies(req)[COOKIES[espace]] || null);
}

/**
 * Le jeton des routes communes aux trois espaces (/api/espace) : le
 * frontend dit de quel espace il parle (en-tete X-Hope-Espace, sans
 * secret) ; a defaut, le premier cookie d'utilisateur present.
 */
export function lireJetonEspace(req) {
  const entete = jetonDeLEntete(req);
  if (entete) return entete;
  const cookies = lireCookies(req);
  const indique = String(req.headers['x-hope-espace'] ?? '').toLowerCase();
  if (ESPACES_UTILISATEUR.includes(indique) && cookies[COOKIES[indique]]) {
    return cookies[COOKIES[indique]];
  }
  for (const espace of ESPACES_UTILISATEUR) {
    if (cookies[COOKIES[espace]]) return cookies[COOKIES[espace]];
  }
  return null;
}

/** Les reglages communs du cookie. */
function reglages() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.enProduction,
    path: '/api',
  };
}

/**
 * Depose la session d'un espace.
 *
 * "Se souvenir de moi" : un cookie qui dure autant que le jeton. Sinon,
 * un cookie de session, oublie a la fermeture du navigateur.
 */
export function poserSession(res, espace, jeton, { persistant = true } = {}) {
  const options = reglages();
  if (persistant) {
    const { exp } = jwt.decode(jeton) ?? {};
    if (exp) options.maxAge = Math.max(0, exp * 1000 - Date.now());
  }
  res.cookie(COOKIES[espace], jeton, options);
}

/** Efface la session d'un espace (ou de tous, sans argument). */
export function effacerSession(res, espace = null) {
  const espaces = espace ? [espace] : Object.keys(COOKIES);
  for (const e of espaces) res.clearCookie(COOKIES[e], reglages());
}

/** Efface les trois sessions d'utilisateur (une seule est ouverte a la fois). */
export function effacerSessionsUtilisateur(res) {
  for (const e of ESPACES_UTILISATEUR) res.clearCookie(COOKIES[e], reglages());
}

/**
 * Un jeton emis avant la derniere fermeture des sessions du compte
 * (changement de mot de passe) ne vaut plus rien.
 *
 * @param {{ iat?: number }} charge le contenu du jeton
 * @param {Date|string|null} validesDepuis la date de fermeture, ou null
 */
export function verifierFraicheur(charge, validesDepuis) {
  if (!validesDepuis) return;
  // iat est en secondes ; la date de fermeture est arrondie a la seconde
  // (services/session.service.js) : le jeton neuf passe, les anciens non.
  const emis = Number(charge?.iat ?? 0) * 1000;
  if (emis < new Date(validesDepuis).getTime()) {
    throw new ErreurAuthentification(
      'Votre mot de passe a changé : reconnectez-vous.',
      'SESSION_FERMEE'
    );
  }
}

/**
 * Protection de plus contre la falsification de requete : une requete
 * qui modifie quelque chose et qui vient d'une autre origine est refusee.
 * SameSite=Strict suffit dans les navigateurs recents ; ceci couvre les
 * autres. Les requetes sans en-tete Origin (outils, serveur a serveur,
 * webhook Stripe) ne sont pas concernees.
 */
export function verifierOrigine(req, _res, suite) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return suite();
  const origine = req.headers.origin;
  if (!origine) return suite();
  let hote;
  try {
    hote = new URL(origine).host;
  } catch {
    hote = '';
  }
  const autorisees = String(config.corsOrigin ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (hote === req.headers.host || autorisees.includes(origine)) return suite();
  const erreur = new ErreurAuthentification('Origine de la requête refusée.', 'ORIGINE_REFUSEE');
  erreur.statut = 403;
  return suite(erreur);
}
