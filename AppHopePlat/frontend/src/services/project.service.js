/**
 * Service frontend des projets.
 * Les pages n'appellent jamais Axios directement : elles passent par ici.
 */
import { api, URL_API } from './api.js';
import { lireJeton } from './auth.service.js';

/** @param {{ status?, categoryId?, search?, includeArchived?, page?, pageSize? }} filtres */
export async function lister(filtres = {}) {
  const { data } = await api.get('/admin/projects', { params: filtres });
  return data;
}

export async function recuperer(id) {
  const { data } = await api.get(`/admin/projects/${id}`);
  return data;
}

/** Vue complete alimentant tous les onglets de la fiche projet. */
export async function recupererApercu(id) {
  const { data } = await api.get(`/admin/projects/${id}/overview`);
  return data;
}

/**
 * GET /api/admin/projects/:id/rapport
 *
 * Le rapport du jour, compose a partir des donnees du projet, ses
 * destinataires, et les rapports deja envoyes.
 */
export async function recupererRapport(id) {
  const { data } = await api.get(`/admin/projects/${id}/rapport`);
  return data;
}

/** Le contenu d'un rapport deja envoye, tel que le bailleur l'a recu. */
export async function contenuRapportPublie(id, documentId) {
  const { data } = await api.get(`/admin/projects/${id}/rapport/publies/${documentId}`);
  return data;
}

/** POST : envoie le rapport du jour a chaque bailleur du projet. */
export async function publierRapport(id) {
  const { data } = await api.post(`/admin/projects/${id}/rapport/publication`);
  return data;
}

/**
 * Enregistre le PDF du jour sur le poste.
 *
 * La route est protegee par le JWT : un simple lien n'enverrait pas
 * l'en-tete Authorization. Le fichier est donc lu, puis remis au
 * navigateur comme un telechargement nomme.
 */
export async function telechargerRapportPdf(id, reference) {
  const reponse = await fetch(`${URL_API}/admin/projects/${id}/rapport/pdf`, {
    headers: { Authorization: `Bearer ${lireJeton()}` },
  });
  if (!reponse.ok) throw new Error('Le PDF du rapport n’a pas pu être préparé.');

  const url = URL.createObjectURL(await reponse.blob());
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `rapport-impact-${reference ?? id}.pdf`;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Projets termines, pour l'ecran Impact. */
export async function listerTermines() {
  const { data } = await api.get('/admin/projects/completed');
  return data;
}

export async function creer(projet) {
  const { data } = await api.post('/admin/projects', projet);
  return data;
}

export async function mettreAJour(id, modifications) {
  const { data } = await api.patch(`/admin/projects/${id}`, modifications);
  return data;
}

/** Termine un projet : le resultat obtenu est obligatoire. */
export async function terminer(id, outcome) {
  const { data } = await api.patch(`/admin/projects/${id}/complete`, { outcome });
  return data;
}

export async function rouvrir(id) {
  const { data } = await api.patch(`/admin/projects/${id}/reopen`);
  return data;
}

export async function archiver(id) {
  const { data } = await api.patch(`/admin/projects/${id}/archive`);
  return data;
}

/**
 * Supprime un projet.
 *
 * @param {{ force?: boolean }} [options] force : supprimer malgre les
 *   dons, depenses et investissements rattaches. Les dons rejoignent
 *   les fonds de HOPE, le reste est efface. Irreversible.
 */
export async function supprimer(id, { force = false } = {}) {
  const { data } = await api.delete(`/admin/projects/${id}${force ? '?force=1' : ''}`);
  return data;
}

/**
 * Televerse la photo ou la video qui illustre un projet.
 *
 * Axios choisit lui-meme l'en-tete multipart et sa frontiere, d'ou le
 * Content-Type mis a undefined.
 *
 * @param {File} fichier image (JPG, PNG, WEBP) ou video (MP4, WEBM), 50 Mo max
 * @returns {Promise<{ url: string, type: 'PHOTO'|'VIDEO', fileName: string, size: number }>}
 */
export async function televerserMedia(fichier) {
  const formulaire = new FormData();
  formulaire.append('file', fichier);

  const { data } = await api.post('/admin/projects/media', formulaire, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}
