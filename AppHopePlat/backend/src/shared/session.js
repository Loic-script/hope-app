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

function jetonDeLEntete(req) {
  const entete = req.headers.authorization;
  if (!entete || typeof entete !== 'string') return null;
  const [schema, valeur] = entete.split(' ');
  if (!valeur || schema.toLowerCase() !== 'bearer') return null;
  const jeton = valeur.trim();
  return jeton === '' ? null : jeton;
}

export function lireJeton(req, espace) {
  return jetonDeLEntete(req) ?? (lireCookies(req)[COOKIES[espace]] || null);
}

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

function reglages() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.enProduction,
    path: '/api',
  };
}

export function poserSession(res, espace, jeton, { persistant = true } = {}) {
  const options = reglages();
  if (persistant) {
    const { exp } = jwt.decode(jeton) ?? {};
    if (exp) options.maxAge = Math.max(0, exp * 1000 - Date.now());
  }
  res.cookie(COOKIES[espace], jeton, options);
}

export function effacerSession(res, espace = null) {
  const espaces = espace ? [espace] : Object.keys(COOKIES);
  for (const e of espaces) res.clearCookie(COOKIES[e], reglages());
}

export function effacerSessionsUtilisateur(res) {
  for (const e of ESPACES_UTILISATEUR) res.clearCookie(COOKIES[e], reglages());
}

export function verifierFraicheur(charge, validesDepuis) {
  if (!validesDepuis) return;
  const emis = Number(charge?.iat ?? 0) * 1000;
  if (emis < new Date(validesDepuis).getTime()) {
    throw new ErreurAuthentification(
      'Votre mot de passe a changé : reconnectez-vous.',
      'SESSION_FERMEE'
    );
  }
}

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
