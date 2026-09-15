/**
 * Services de l'espace bailleur, cote frontend.
 *
 * Authentification et espace connecte dans un seul fichier : l'espace
 * est en lecture seule sur les montants, il n'y a donc que des
 * lectures, plus deux ecritures -- la fiche de contact et la
 * manifestation d'interet.
 */
import { URL_API } from './api.js';
import {
  apiBailleur,
  CLE_BAILLEUR,
  CLE_JETON_BAILLEUR,
  ecrireStockage,
  effacerStockage,
  lireStockage,
} from './apiBailleur.js';

/* --------------------------- Session ---------------------------------- */

function memoriserSession(token, bailleur, persistant) {
  ecrireStockage(CLE_JETON_BAILLEUR, token, persistant);
  ecrireStockage(CLE_BAILLEUR, JSON.stringify(bailleur), persistant);
}

export function effacerSession() {
  effacerStockage(CLE_JETON_BAILLEUR);
  effacerStockage(CLE_BAILLEUR);
}

export function lireJeton() {
  return lireStockage(CLE_JETON_BAILLEUR);
}

export function lireBailleurLocal() {
  const brut = lireStockage(CLE_BAILLEUR);
  if (!brut) return null;
  try {
    return JSON.parse(brut);
  } catch {
    return null;
  }
}

/* ------------------------ Authentification ---------------------------- */

/** GET /api/bailleur/types-organisation — public. */
export async function typesOrganisation() {
  const { data } = await apiBailleur.get('/bailleur/types-organisation');
  return data.items ?? [];
}

/**
 * POST /api/bailleur/inscription
 *
 * Ne connecte pas : le compte et l'organisation attendent la validation
 * de l'equipe HOPE.
 */
export async function inscrire(corps) {
  const { data } = await apiBailleur.post('/bailleur/inscription', corps);
  return { bailleur: data.bailleur, message: data.message };
}

/** POST /api/bailleur/login */
export async function connecter(email, motDePasse, persistant = true) {
  const { data } = await apiBailleur.post('/bailleur/login', { email, motDePasse });
  memoriserSession(data.token, data.bailleur, persistant);
  return data.bailleur;
}

/** GET /api/bailleur/me */
export async function recupererProfil() {
  const { data } = await apiBailleur.get('/bailleur/me');
  if (!data?.authenticated) throw new Error('Session non authentifiee.');
  return data.bailleur;
}

export async function deconnecter() {
  try {
    if (lireJeton()) await apiBailleur.post('/bailleur/logout');
  } catch {
    // Jeton deja expire ou API injoignable : on continue.
  } finally {
    effacerSession();
  }
}

/* ---------------------------- L'espace -------------------------------- */

/** GET /api/bailleur/tableau-de-bord */
export async function tableauDeBord() {
  const { data } = await apiBailleur.get('/bailleur/tableau-de-bord');
  return data;
}

/** GET /api/bailleur/partenariat */
export async function partenariat() {
  const { data } = await apiBailleur.get('/bailleur/partenariat');
  return data;
}

/** GET /api/bailleur/versements */
export async function versements(filtres = {}) {
  const { data } = await apiBailleur.get('/bailleur/versements', { params: filtres });
  return data.items ?? [];
}

/** GET /api/bailleur/documents */
export async function documents(filtres = {}) {
  const { data } = await apiBailleur.get('/bailleur/documents', { params: filtres });
  return data;
}

/**
 * POST /api/bailleur/documents/:id/telechargement
 *
 * Enregistre le telechargement et renvoie l'adresse du fichier : c'est
 * ainsi que HOPE sait si ses rapports sont reellement lus.
 */
export async function telechargerDocument(id) {
  const { data } = await apiBailleur.post(`/bailleur/documents/${id}/telechargement`);
  return data;
}

/** POST /api/bailleur/certificat */
export async function genererCertificat() {
  const { data } = await apiBailleur.post('/bailleur/certificat');
  return data;
}

/** GET /api/bailleur/preuves */
export async function preuves() {
  const { data } = await apiBailleur.get('/bailleur/preuves');
  return data.items ?? [];
}

/**
 * Le fichier d'une preuve, sous forme d'URL locale.
 *
 * Il est servi derriere le jeton : une balise <img src="..."> ne peut
 * pas l'atteindre, elle ne porte pas d'en-tete Authorization. On passe
 * donc par un blob, que l'appelant libere avec URL.revokeObjectURL --
 * sinon le navigateur garde chaque image en memoire.
 *
 * @returns {Promise<string|null>} null si le fichier n'est pas servi
 */
export async function urlDuFichierPreuve(preuve, fichier = null) {
  const cible = fichier ?? preuve?.files?.[0] ?? null;
  if (!preuve?.id || !cible?.id) return null;

  const reponse = await fetch(
    `${URL_API}/bailleur/preuves/${preuve.id}/fichiers/${cible.id}`,
    { headers: { Authorization: `Bearer ${lireJeton()}` } }
  );
  if (!reponse.ok) return null;

  return URL.createObjectURL(await reponse.blob());
}

/** GET /api/bailleur/fil */
export async function fil() {
  const { data } = await apiBailleur.get('/bailleur/fil');
  return data.items ?? [];
}

/**
 * POST /api/bailleur/interet
 *
 * "Financer ce projet" : enregistre une intention. Rien n'est debite,
 * aucun engagement n'est cree ; l'equipe HOPE prend contact ensuite.
 */
export async function manifesterUnInteret(corps) {
  const { data } = await apiBailleur.post('/bailleur/interet', corps);
  return data;
}

/** GET /api/bailleur/profil */
export async function profil() {
  const { data } = await apiBailleur.get('/bailleur/profil');
  return data;
}

/** PATCH /api/bailleur/profil/contact */
export async function mettreAJourContact(corps) {
  const { data } = await apiBailleur.patch('/bailleur/profil/contact', corps);
  return data;
}

/**
 * POST /api/bailleur/profil/photo
 *
 * Televerse la photo et rend son adresse ; c'est la mise a jour de la
 * fiche de contact qui la rattache ensuite au compte.
 */
export async function televerserPhoto(fichier) {
  const formulaire = new FormData();
  formulaire.append('file', fichier);

  // Le client pose "application/json" par defaut, et cet en-tete arrive
  // alors sans la frontiere du multipart : multer ne trouve plus rien a
  // lire. Le mettre a undefined laisse le navigateur ecrire le sien.
  const { data } = await apiBailleur.post('/bailleur/profil/photo', formulaire, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}
