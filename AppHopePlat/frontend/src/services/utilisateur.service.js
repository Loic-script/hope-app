/**
 * Authentification unifiee des utilisateurs, cote frontend.
 *
 * Un seul formulaire, trois types. Le jeton recu est range sous la cle
 * de l'espace correspondant : chaque espace garde son client HTTP et sa
 * propre session, seule la porte d'entree est commune.
 */
import axios from 'axios';

import { URL_API, ecrireStockage, effacerStockage, lireStockage } from './api.js';
import { CLE_BAILLEUR, CLE_JETON_BAILLEUR } from './apiBailleur.js';
import { CLE_BENEVOLE, CLE_JETON_BENEVOLE } from './apiBenevole.js';
import { CLE_DONATEUR, CLE_JETON_DONATEUR } from './apiDonateur.js';

/**
 * Client dedie aux routes publiques d'authentification.
 *
 * Volontairement sans intercepteur : ces routes n'ont pas de jeton a
 * porter, et un 401 sur le formulaire de connexion doit rester dans la
 * page pour y afficher son message, pas declencher une redirection.
 */
const apiAuth = axios.create({
  baseURL: URL_API,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

/** Les cles de stockage, par type d'utilisateur. */
const CLES = {
  donateur: { jeton: CLE_JETON_DONATEUR, profil: CLE_DONATEUR },
  benevole: { jeton: CLE_JETON_BENEVOLE, profil: CLE_BENEVOLE },
  bailleur: { jeton: CLE_JETON_BAILLEUR, profil: CLE_BAILLEUR },
};

/**
 * Adresse du formulaire de completion, par type.
 *
 * Le benevole seul en a un : sans ses competences ni ses
 * disponibilites, l'equipe ne sait pas quoi lui confier. Le bailleur
 * entre directement et precise son organisation dans ses parametres.
 */
export const COMPLETION_PAR_TYPE = {
  benevole: '/benevole/completer-profil',
  // Le parcours d'accueil en cinq etapes, tant qu'il n'est pas termine.
  donateur: '/donateur/completer-profil',
};

/**
 * POST /api/auth/mot-de-passe-oublie : un lien par courriel. La reponse
 * est la meme que le compte existe ou non.
 */
export async function demanderReinitialisation(email) {
  const { data } = await apiAuth.post('/auth/mot-de-passe-oublie', { email });
  return data.message;
}

/** POST /api/auth/reinitialiser-mot-de-passe : le jeton du lien, et le nouveau mot de passe. */
export async function reinitialiserMotDePasse(jeton, motDePasse) {
  const { data } = await apiAuth.post('/auth/reinitialiser-mot-de-passe', { jeton, motDePasse });
  return data.message;
}

/** GET /api/auth/types — les trois types, pour la liste du formulaire. */
export async function typesUtilisateur() {
  const { data } = await apiAuth.get('/auth/types');
  return data.items ?? [];
}

/**
 * POST /api/auth/inscription
 *
 * Ne connecte pas : un donateur pourra se connecter aussitot, un
 * benevole ou un bailleur devra attendre la validation de HOPE.
 */
export async function inscrire(corps) {
  const { data } = await apiAuth.post('/auth/inscription', corps);
  return {
    message: data.message,
    aValider: data.aValider,
    utilisateur: data.utilisateur,
    // Un benevole recoit de quoi remplir sa fiche tout de suite : un
    // jeton limite a ce formulaire, et l'adresse ou aller.
    jetonCompletion: data.jetonCompletion ?? null,
    aCompleter: data.aCompleter ?? null,
  };
}

/**
 * POST /api/auth/login
 *
 * Range le jeton sous la cle de l'espace du type, puis renvoie de quoi
 * router : l'espace, et s'il reste un formulaire a remplir.
 */
export async function connecter(email, motDePasse, typeUtilisateur, persistant = true) {
  // Le type designe l'espace : un compte peut porter plusieurs roles, et
  // le serveur refuse un type que le compte n'a pas.
  const { data } = await apiAuth.post('/auth/login', { email, motDePasse, typeUtilisateur });

  const cles = CLES[data.type];
  if (!cles) {
    throw new Error(`Type d'utilisateur inattendu : ${data.type}`);
  }

  // Les sessions des autres espaces sont effacees : se connecter comme
  // bailleur ne doit pas laisser traîner une session de benevole.
  for (const [type, { jeton, profil }] of Object.entries(CLES)) {
    if (type !== data.type) {
      effacerStockage(jeton);
      effacerStockage(profil);
    }
  }

  ecrireStockage(cles.jeton, data.token, persistant);
  ecrireStockage(cles.profil, JSON.stringify(data.utilisateur), persistant);

  return {
    utilisateur: data.utilisateur,
    type: data.type,
    espace: data.espace,
    profilComplete: data.profilComplete,
    completionRequise: data.completionRequise,
    // L'adresse ou aller : le formulaire de completion, ou l'espace.
    destination: data.completionRequise
      ? COMPLETION_PAR_TYPE[data.type] ?? data.espace
      : data.espace,
  };
}

/** Efface toute session utilisateur, quel que soit l'espace. */
export function effacerToutesLesSessions() {
  for (const { jeton, profil } of Object.values(CLES)) {
    effacerStockage(jeton);
    effacerStockage(profil);
  }
}

/**
 * Le type dont une session est ouverte dans ce navigateur, s'il y en a.
 * Sert a sauter la page d'authentification quand on y revient.
 */
export function sessionOuverte() {
  for (const [type, { jeton }] of Object.entries(CLES)) {
    if (lireStockage(jeton)) return type;
  }
  return null;
}

/* --------------------------- Espace donateur --------------------------- */

/** GET /api/donateur/me */
export async function recupererDonateur() {
  const { apiDonateur } = await import('./apiDonateur.js');
  const { data } = await apiDonateur.get('/donateur/me');
  if (!data?.authenticated) throw new Error('Session non authentifiee.');
  return data.donateur;
}

/** Deconnexion du donateur. */
export async function deconnecterDonateur() {
  const { apiDonateur } = await import('./apiDonateur.js');
  try {
    if (lireStockage(CLE_JETON_DONATEUR)) {
      await apiDonateur.post('/donateur/logout');
    }
  } catch {
    // Jeton deja expire ou API injoignable : on continue.
  } finally {
    effacerStockage(CLE_JETON_DONATEUR);
    effacerStockage(CLE_DONATEUR);
  }
}
