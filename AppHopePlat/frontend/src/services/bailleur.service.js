/**
 * Services de l'espace bailleur, cote frontend.
 *
 * Authentification et espace connecte dans un seul fichier : l'espace
 * est en lecture seule sur les montants, il n'y a donc que des
 * lectures, plus deux ecritures -- la fiche de contact et la
 * manifestation d'interet.
 */
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

/** GET /api/bailleur/projets — les projets HOPE, et ceux qu'il finance. */
export async function projets() {
  const { data } = await apiBailleur.get('/bailleur/projets');
  return data.items ?? [];
}

/**
 * GET /api/bailleur/projets/:id — la fiche du projet : ce qu'il est, son
 * financement en totaux, son impact collectif.
 */
export async function projet(id) {
  const { data } = await apiBailleur.get(`/bailleur/projets/${id}`);
  return data;
}

/**
 * GET /api/bailleur/projets/:id/rapport
 *
 * Le rapport a jour du projet, compose avec les donnees du jour.
 */
export async function rapportProjet(id) {
  const { data } = await apiBailleur.get(`/bailleur/projets/${id}/rapport`);
  return data;
}

/**
 * GET /api/bailleur/projets/:id/rapport/pdf
 *
 * La route exige le jeton : un simple lien ne l'enverrait pas. Le fichier
 * est donc lu, puis remis au navigateur comme un telechargement nomme.
 */
export async function telechargerRapportProjet(id, reference) {
  let reponse;
  try {
    reponse = await apiBailleur.get(`/bailleur/projets/${id}/rapport/pdf`, {
      responseType: 'blob',
      timeout: 30000,
    });
  } catch (echec) {
    // Demandee en blob, la reponse d'erreur arrive en blob elle aussi :
    // on la relit en JSON pour que messageErreur y trouve le motif.
    const corps = echec?.response?.data;
    if (corps instanceof Blob) {
      try {
        echec.response.data = JSON.parse(await corps.text());
      } catch {
        // Pas du JSON : le message par defaut fera l'affaire.
      }
    }
    throw echec;
  }

  const url = URL.createObjectURL(reponse.data);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `rapport-impact-${reference ?? id}.pdf`;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** GET /api/bailleur/documents */
export async function documents(filtres = {}) {
  const { data } = await apiBailleur.get('/bailleur/documents', { params: filtres });
  return data;
}

/**
 * GET /api/bailleur/documents/:id/apercu
 *
 * Le contenu du rapport, pour le lire dans la fenetre. Rien n'est
 * enregistre : un coup d'oeil n'est pas un telechargement.
 */
export async function apercuDocument(id) {
  const { data } = await apiBailleur.get(`/bailleur/documents/${id}/apercu`);
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

/**
 * PATCH /api/bailleur/organisation
 *
 * La fiche de l'organisation se renseigne dans les parametres du compte :
 * l'inscription ne demande rien de plus que l'etat civil.
 */
export async function mettreAJourOrganisation(corps) {
  const { data } = await apiBailleur.patch('/bailleur/organisation', corps);
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
