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

/* ------------------------------- Missions ------------------------------ */

/** GET /api/benevole/projets — ce que HOPE mene, et ce qu'il y a a y faire. */
export async function listerProjets() {
  const { data } = await apiBenevole.get('/benevole/projets');
  return data.items ?? [];
}

/** GET /api/benevole/projets/:id — le projet, ses taches, ses missions. */
export async function recupererProjet(id) {
  const { data } = await apiBenevole.get(`/benevole/projets/${id}`);
  return data;
}

/**
 * GET /api/benevole/missions
 * @param {{ format?: string, statut?: string, aVenir?: boolean, search?: string }} filtres
 */
export async function listerMissions(filtres = {}) {
  const { data } = await apiBenevole.get('/benevole/missions', { params: filtres });
  return data.items ?? [];
}

/** GET /api/benevole/missions/:id */
export async function recupererMission(id) {
  const { data } = await apiBenevole.get(`/benevole/missions/${id}`);
  return data;
}

/** GET /api/benevole/missions/miennes */
export async function mesMissions() {
  const { data } = await apiBenevole.get('/benevole/missions/miennes');
  return data.items ?? [];
}

/** POST /api/benevole/missions/:id/inscription */
export async function sInscrire(id) {
  const { data } = await apiBenevole.post(`/benevole/missions/${id}/inscription`);
  return data;
}

/** DELETE /api/benevole/missions/:id/inscription */
export async function seDesinscrire(id, motif = '') {
  const { data } = await apiBenevole.delete(`/benevole/missions/${id}/inscription`, {
    data: { motif },
  });
  return data;
}

/** POST /api/benevole/missions/:id/avis */
export async function laisserUnAvis(id, { note, commentaire }) {
  const { data } = await apiBenevole.post(`/benevole/missions/${id}/avis`, {
    note,
    commentaire,
  });
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

/** GET /api/benevole/journal */
export async function journal() {
  const { data } = await apiBenevole.get('/benevole/journal');
  return data;
}
