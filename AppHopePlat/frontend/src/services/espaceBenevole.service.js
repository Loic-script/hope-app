/**
 * Services de l'espace benevole connecte.
 *
 * Tout passe par apiBenevole : ces routes exigent le jeton du benevole,
 * pas celui de l'administrateur.
 */
import { URL_API } from './api.js';
import { apiBenevole, CLE_JETON_BENEVOLE, lireStockage } from './apiBenevole.js';

/* ---------------------------- Vue d'ensemble --------------------------- */

/** GET /api/benevole/apercu */
export async function apercu() {
  const { data } = await apiBenevole.get('/benevole/apercu');
  return data;
}

/** GET /api/benevole/dons/options : les modes de paiement et les devises du don. */
export async function optionsDon() {
  const { data } = await apiBenevole.get('/benevole/dons/options');
  return data;
}

/**
 * POST /api/benevole/dons : une promesse de don a un projet, ponctuelle.
 * L'equipe HOPE la confirme a reception du paiement.
 */
export async function faireUnDon(don) {
  const { data } = await apiBenevole.post('/benevole/dons', don);
  return data;
}

/** GET /api/benevole/paiement/coordonnees : ou envoyer un don. */
export async function coordonneesDePaiement() {
  const { data } = await apiBenevole.get('/benevole/paiement/coordonnees');
  return data;
}

/* ---------------------------------------------------------------
   Le paiement par carte, encaisse en ligne par Stripe
   --------------------------------------------------------------- */

/** GET /benevole/paiement/carte : la carte est-elle acceptee ici ? */
export async function reglagesCarte() {
  const { data } = await apiBenevole.get('/benevole/paiement/carte');
  return data;
}

/**
 * POST /benevole/paiement/carte/session : enregistre le don et ouvre une
 * session de paiement chez Stripe. Rend le "client secret" du cadre de
 * saisie -- le numero de carte, lui, ne passe jamais par HOPE.
 */
export async function ouvrirPaiementCarte(corps) {
  const { data } = await apiBenevole.post('/benevole/paiement/carte/session', corps);
  return data;
}

/** GET /benevole/paiement/carte/session/:id : ou en est ce paiement. */
export async function etatPaiementCarte(sessionId) {
  const { data } = await apiBenevole.get(`/benevole/paiement/carte/session/${sessionId}`);
  return data;
}

/** PATCH /api/benevole/dons/:id/justificatif : "j'ai paye", avec la reference. */
export async function declarerPaiement(id, referencePaiement) {
  const { data } = await apiBenevole.patch(`/benevole/dons/${id}/justificatif`, { referencePaiement });
  return data;
}

/* ------------------------------ Actualites ----------------------------- */

/** GET /api/benevole/actualites — les nouvelles de HOPE, sans aucun chiffre. */
export async function actualites() {
  const { data } = await apiBenevole.get('/benevole/actualites');
  return data.items ?? [];
}

/* ------------------------------- Projets ------------------------------- */

/** GET /api/benevole/projets — ce que HOPE mene, et ce qu'il y a a y faire. */
export async function listerProjets() {
  const { data } = await apiBenevole.get('/benevole/projets');
  return data.items ?? [];
}

/** GET /api/benevole/projets/:id — le projet et ses taches. */
export async function recupererProjet(id) {
  const { data } = await apiBenevole.get(`/benevole/projets/${id}`);
  return data;
}

/**
 * Un fichier d'une preuve terrain du projet (onglet Impact), en URL locale.
 *
 * Servi derriere le jeton, comme les fichiers de taches : une balise
 * <img src> ne peut pas l'atteindre. L'appelant libere l'URL avec
 * URL.revokeObjectURL.
 *
 * @returns {Promise<string|null>}
 */
export async function urlDuFichierPreuve(projetId, preuve, fichier) {
  if (!projetId || !preuve?.id || !fichier?.id) return null;

  const reponse = await fetch(
    `${URL_API}/benevole/projets/${projetId}/preuves/${preuve.id}/fichiers/${fichier.id}`,
    { headers: { Authorization: `Bearer ${lireStockage(CLE_JETON_BENEVOLE)}` } }
  );
  if (!reponse.ok) return null;
  return URL.createObjectURL(await reponse.blob());
}

/**
 * POST /api/benevole/projets/:id/preuves -- ajouter une preuve terrain.
 *
 * @param {{ proofType: string, description: string, occurredOn: string,
 *           fichiers: File[] }} preuve
 */
export async function ajouterPreuve(projetId, { proofType, description, occurredOn, fichiers = [] }) {
  const formulaire = new FormData();
  formulaire.append('proofType', proofType);
  formulaire.append('description', description);
  if (occurredOn) formulaire.append('occurredOn', occurredOn);
  for (const fichier of fichiers) formulaire.append('files', fichier);

  // Le client pose "application/json" par defaut : l'en-tete arriverait
  // sans la frontiere du multipart, et multer ne trouverait rien a lire.
  const { data } = await apiBenevole.post(`/benevole/projets/${projetId}/preuves`, formulaire, {
    headers: { 'Content-Type': undefined },
    // Une video d'une minute depasse vite les dix secondes par defaut.
    timeout: 120000,
  });
  return data;
}

/** DELETE /api/benevole/projets/:id/preuves/:preuveId -- retirer la sienne. */
export async function supprimerPreuve(projetId, preuveId) {
  const { data } = await apiBenevole.delete(`/benevole/projets/${projetId}/preuves/${preuveId}`);
  return data;
}

/* -------------------------------- Taches ------------------------------- */

/** GET /api/benevole/taches */
export async function mesTaches(filtres = {}) {
  const { data } = await apiBenevole.get('/benevole/taches', { params: filtres });
  return data;
}

/** GET /api/benevole/taches/libres */
export async function tachesLibres() {
  const { data } = await apiBenevole.get('/benevole/taches/libres');
  return data.items ?? [];
}

/**
 * POST /api/benevole/taches/:id/demander
 *
 * Prendre une tache -- ou rejoindre son equipe --, c'est la demander :
 * elle ne devient la sienne qu'une fois validee par l'equipe HOPE.
 */
export async function demanderTache(id) {
  const { data } = await apiBenevole.post(`/benevole/taches/${id}/demander`);
  return data;
}

/** POST /api/benevole/taches/:id/annuler-demande */
export async function annulerDemandeTache(id) {
  const { data } = await apiBenevole.post(`/benevole/taches/${id}/annuler-demande`);
  return data;
}

/** POST /api/benevole/taches/:id/relacher — quitter l'equipe de la tache. */
export async function relacherTache(id) {
  const { data } = await apiBenevole.post(`/benevole/taches/${id}/relacher`);
  return data;
}

/**
 * POST /api/benevole/taches/:id/livrer
 *
 * Livrer, c'est joindre sa preuve : les photos et videos partent avec la
 * declaration, dans la meme requete. Le serveur refuse une livraison
 * sans elles.
 *
 * @param {File[]} fichiers
 */
export async function livrerTache(id, fichiers = []) {
  const formulaire = new FormData();
  for (const fichier of fichiers) formulaire.append('files', fichier);

  // Le client pose "application/json" par defaut : l'en-tete arriverait
  // sans la frontiere du multipart, et multer ne trouverait rien a lire.
  const { data } = await apiBenevole.post(`/benevole/taches/${id}/livrer`, formulaire, {
    headers: { 'Content-Type': undefined },
    // Une video d'une minute depasse vite les dix secondes par defaut.
    timeout: 120000,
  });
  return data;
}

/**
 * Un fichier de sa livraison, sous forme d'URL locale.
 *
 * Servi derriere le jeton : une balise <img src> ne peut pas l'atteindre.
 * L'appelant libere l'URL avec URL.revokeObjectURL.
 *
 * @returns {Promise<string|null>}
 */
export async function urlDuFichierTache(tache, fichier) {
  if (!tache?.id || !fichier?.id) return null;

  const reponse = await fetch(`${URL_API}/benevole/taches/${tache.id}/fichiers/${fichier.id}`, {
    headers: { Authorization: `Bearer ${lireStockage(CLE_JETON_BENEVOLE)}` },
  });
  if (!reponse.ok) return null;
  return URL.createObjectURL(await reponse.blob());
}

/* --------------------------- Profil et journal ------------------------- */

/** GET /api/benevole/profil */
export async function recupererProfil() {
  const { data } = await apiBenevole.get('/benevole/profil');
  return data;
}

/** PATCH /api/benevole/profil */
export async function mettreAJourProfil(corps) {
  const { data } = await apiBenevole.patch('/benevole/profil', corps);
  return data;
}

/**
 * POST /api/benevole/profil/photo
 *
 * Televerse la photo et rend son adresse. Le rattachement au compte se
 * fait ensuite par la mise a jour du profil : deux etapes, comme pour
 * les medias de projet cote administration.
 */
export async function televerserPhoto(fichier) {
  const formulaire = new FormData();
  formulaire.append('file', fichier);

  // Le client pose "application/json" par defaut. Laisse tel quel, cet
  // en-tete arrive sans la frontiere du multipart, et multer ne trouve
  // aucun fichier a lire. Le mettre a undefined laisse le navigateur
  // ecrire le sien -- le meme detour que cote administration.
  const { data } = await apiBenevole.post('/benevole/profil/photo', formulaire, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}

/** GET /api/benevole/journal */
export async function journal() {
  const { data } = await apiBenevole.get('/benevole/journal');
  return data;
}
