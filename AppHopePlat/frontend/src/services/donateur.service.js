/**
 * Service de l'espace donateur.
 *
 * Tout passe par apiDonateur : son jeton ne vaut que pour cet espace.
 */
import { apiDonateur } from './apiDonateur.js';

/**
 * GET /api/donateur/profil
 *
 * La fiche, l'etape ou reprendre le parcours d'accueil, et les listes
 * dont le formulaire a besoin.
 */
export async function recupererProfil() {
  const { data } = await apiDonateur.get('/donateur/profil');
  return data;
}

/**
 * GET /api/donateur/projets
 *
 * Les projets que l'on peut soutenir : leur face publique et leurs
 * totaux, ceux qui ont le plus besoin de soutien en premier.
 */
export async function listerProjets() {
  const { data } = await apiDonateur.get('/donateur/projets');
  return data;
}

/**
 * GET /api/donateur/projets/:id
 *
 * La fiche d'un projet -- ce qu'il est, son financement en totaux, son
 * impact collectif --, ce que le donateur y a donne, et s'il est encore
 * ouvert aux dons.
 */
export async function projet(id) {
  const { data } = await apiDonateur.get(`/donateur/projets/${id}`);
  return data;
}

/** GET /api/donateur/dons : ses dons, et leur synthese par devise. */
export async function mesDons() {
  const { data } = await apiDonateur.get('/donateur/dons');
  return data;
}

/**
 * POST /api/donateur/dons : une promesse de don.
 *
 * Elle part en attente ; l'equipe HOPE la confirme a reception du
 * paiement.
 *
 * @param {{ affectation: 'PROJECT'|'HOPE', projetId?: number, montant: string,
 *           devise: string, mode: string, frequence: 'ONE_TIME'|'MONTHLY',
 *           message?: string }} don
 */
export async function faireUnDon(don) {
  const { data } = await apiDonateur.post('/donateur/dons', don);
  return data;
}

/**
 * GET /api/donateur/paiement/mvola : le compte MVola de HOPE, ou le
 * donateur envoie son don.
 *
 * @returns {Promise<{ disponible: boolean, numero: string, titulaire: string }>}
 */
export async function compteMvola() {
  const { data } = await apiDonateur.get('/donateur/paiement/mvola');
  return data;
}

/** GET /api/donateur/paiement/orange-money : le compte Orange Money de HOPE. */
export async function compteOrangeMoney() {
  const { data } = await apiDonateur.get('/donateur/paiement/orange-money');
  return data;
}

/**
 * GET /api/donateur/paiement/coordonnees : ou envoyer un don hors ligne --
 * le compte bancaire, le bureau, le retrait au guichet, les numeros
 * mobiles.
 */
export async function coordonneesDePaiement() {
  const { data } = await apiDonateur.get('/donateur/paiement/coordonnees');
  return data;
}

/**
 * PATCH /api/donateur/dons/:id/justificatif : le donateur signale avoir
 * paye une promesse, avec la reference de sa banque ou du transfert.
 */
export async function declarerPaiement(id, referencePaiement) {
  const { data } = await apiDonateur.patch(`/donateur/dons/${id}/justificatif`, { referencePaiement });
  return data;
}

/** GET /api/donateur/actualites : les nouvelles de HOPE, sans argent. */
export async function actualites() {
  const { data } = await apiDonateur.get('/donateur/actualites');
  return data.items ?? [];
}

/**
 * POST /api/donateur/profil/photo -- televerse la photo de profil.
 * Elle se rattache ensuite au compte par changerPhoto.
 */
export async function televerserPhoto(fichier) {
  const formulaire = new FormData();
  formulaire.append('file', fichier);
  // Le client pose "application/json" par defaut : l'en-tete arriverait
  // sans la frontiere du multipart, et multer ne trouverait rien a lire.
  const { data } = await apiDonateur.post('/donateur/profil/photo', formulaire, {
    headers: { 'Content-Type': undefined },
    timeout: 60000,
  });
  return data;
}

/** PATCH /api/donateur/profil/photo : rattache (ou retire, null) la photo. */
export async function changerPhoto(photoUrl) {
  const { data } = await apiDonateur.patch('/donateur/profil/photo', { photoUrl });
  return data;
}

/** PUT /api/donateur/profil/etape-5 : la frequence ; clot le parcours. */
export async function enregistrerEtape5(frequence) {
  const { data } = await apiDonateur.put('/donateur/profil/etape-5', frequence);
  return data;
}

/** PUT /api/donateur/profil/etape-4 : le mode de paiement. */
export async function enregistrerEtape4(paiement) {
  const { data } = await apiDonateur.put('/donateur/profil/etape-4', paiement);
  return data;
}

/** PUT /api/donateur/profil/etape-3 : l'affectation du don. */
export async function enregistrerEtape3(choix) {
  const { data } = await apiDonateur.put('/donateur/profil/etape-3', choix);
  return data;
}

/** PUT /api/donateur/profil/etape-2 : le profil et les preferences. */
export async function enregistrerEtape2(profil) {
  const { data } = await apiDonateur.put('/donateur/profil/etape-2', profil);
  return data;
}

/** PUT /api/donateur/profil/etape-1 : les informations personnelles. */
export async function enregistrerEtape1(informations) {
  const { data } = await apiDonateur.put('/donateur/profil/etape-1', informations);
  return data;
}
