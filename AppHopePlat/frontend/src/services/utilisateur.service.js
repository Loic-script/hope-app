import axios from 'axios';

import { TEMOIN_SESSION, URL_API, ecrireStockage, effacerStockage, lireStockage } from './api.js';
import { CLE_BAILLEUR, CLE_JETON_BAILLEUR } from './apiBailleur.js';
import { CLE_BENEVOLE, CLE_JETON_BENEVOLE } from './apiBenevole.js';
import { CLE_DONATEUR, CLE_JETON_DONATEUR } from './apiDonateur.js';

const apiAuth = axios.create({
  baseURL: URL_API,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

const CLES = {
  donateur: { jeton: CLE_JETON_DONATEUR, profil: CLE_DONATEUR },
  benevole: { jeton: CLE_JETON_BENEVOLE, profil: CLE_BENEVOLE },
  bailleur: { jeton: CLE_JETON_BAILLEUR, profil: CLE_BAILLEUR },
};

export const COMPLETION_PAR_TYPE = {
  benevole: '/benevole/completer-profil',
  donateur: '/donateur/completer-profil',
};

export async function demanderReinitialisation(email) {
  const { data } = await apiAuth.post('/auth/mot-de-passe-oublie', { email });
  return data.message;
}

export async function reinitialiserMotDePasse(jeton, motDePasse) {
  const { data } = await apiAuth.post('/auth/reinitialiser-mot-de-passe', { jeton, motDePasse });
  return data.message;
}

export async function typesUtilisateur() {
  const { data } = await apiAuth.get('/auth/types');
  return data.items ?? [];
}

export async function inscrire(corps) {
  const { data } = await apiAuth.post('/auth/inscription', corps);
  return {
    message: data.message,
    aValider: data.aValider,
    utilisateur: data.utilisateur,
    jetonCompletion: data.jetonCompletion ?? null,
    aCompleter: data.aCompleter ?? null,
  };
}

export async function connecter(email, motDePasse, typeUtilisateur, persistant = true) {
  const { data } = await apiAuth.post('/auth/login', { email, motDePasse, typeUtilisateur, seSouvenir: persistant });

  const cles = CLES[data.type];
  if (!cles) {
    throw new Error(`Type d'utilisateur inattendu : ${data.type}`);
  }

  for (const [type, { jeton, profil }] of Object.entries(CLES)) {
    if (type !== data.type) {
      effacerStockage(jeton);
      effacerStockage(profil);
    }
  }

  ecrireStockage(cles.jeton, TEMOIN_SESSION, persistant);
  ecrireStockage(cles.profil, JSON.stringify(data.utilisateur), persistant);

  return {
    utilisateur: data.utilisateur,
    type: data.type,
    espace: data.espace,
    profilComplete: data.profilComplete,
    completionRequise: data.completionRequise,
    destination: data.completionRequise
      ? COMPLETION_PAR_TYPE[data.type] ?? data.espace
      : data.espace,
  };
}

export function effacerToutesLesSessions() {
  for (const { jeton, profil } of Object.values(CLES)) {
    effacerStockage(jeton);
    effacerStockage(profil);
  }
}

export function sessionOuverte() {
  for (const [type, { jeton }] of Object.entries(CLES)) {
    if (lireStockage(jeton)) return type;
  }
  return null;
}

export async function recupererDonateur() {
  const { apiDonateur } = await import('./apiDonateur.js');
  const { data } = await apiDonateur.get('/donateur/me');
  if (!data?.authenticated) throw new Error('Session non authentifiee.');
  return data.donateur;
}

export async function deconnecterDonateur() {
  const { apiDonateur } = await import('./apiDonateur.js');
  try {
    if (lireStockage(CLE_JETON_DONATEUR)) {
      await apiDonateur.post('/auth/logout');
    }
  } catch {
  } finally {
    effacerStockage(CLE_JETON_DONATEUR);
    effacerStockage(CLE_DONATEUR);
  }
}

export async function verifierCourriel(jeton) {
  const { data } = await apiAuth.post('/auth/verifier-courriel', { jeton });
  return data.message;
}
