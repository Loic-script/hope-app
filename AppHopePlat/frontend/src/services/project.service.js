/**
 * Service frontend des projets.
 * Les pages n'appellent jamais Axios directement : elles passent par ici.
 */
import { api } from './api.js';

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

export async function supprimer(id) {
  const { data } = await api.delete(`/admin/projects/${id}`);
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
