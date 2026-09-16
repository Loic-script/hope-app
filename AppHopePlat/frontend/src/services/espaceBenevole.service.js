/**
 * Services de l'espace benevole connecte.
 *
 * Tout passe par apiBenevole : ces routes exigent le jeton du benevole,
 * pas celui de l'administrateur.
 */
import { apiBenevole } from './apiBenevole.js';

/* ---------------------------- Vue d'ensemble --------------------------- */

/** GET /api/benevole/apercu */
export async function apercu() {
  const { data } = await apiBenevole.get('/benevole/apercu');
  return data;
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

/** POST /api/benevole/taches/:id/prendre */
export async function prendreTache(id) {
  const { data } = await apiBenevole.post(`/benevole/taches/${id}/prendre`);
  return data;
}

/** POST /api/benevole/taches/:id/relacher */
export async function relacherTache(id) {
  const { data } = await apiBenevole.post(`/benevole/taches/${id}/relacher`);
  return data;
}

/** POST /api/benevole/taches/:id/livrer */
export async function livrerTache(id) {
  const { data } = await apiBenevole.post(`/benevole/taches/${id}/livrer`);
  return data;
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
