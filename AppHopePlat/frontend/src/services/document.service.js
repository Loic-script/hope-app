/**
 * Service frontend des justificatifs.
 *
 * Le televersement passe par un FormData : on laisse Axios choisir lui-meme
 * l'en-tete multipart et sa frontiere, d'ou le Content-Type mis a undefined.
 */
import { api, URL_API } from './api.js';
import { lireJeton } from './auth.service.js';

export async function lister(filtres = {}) {
  const { data } = await api.get('/admin/documents', { params: filtres });
  return data;
}

export async function listerParDepense(expenseId) {
  const { data } = await api.get(`/admin/expenses/${expenseId}/documents`);
  return data;
}

/**
 * @param {number} expenseId depense justifiee
 * @param {{ file: File, documentType?: string, reference?: string, issuedAt?: string }} champs
 */
export async function televerser(expenseId, champs) {
  const formulaire = new FormData();
  formulaire.append('file', champs.file);
  if (champs.documentType) formulaire.append('documentType', champs.documentType);
  if (champs.reference) formulaire.append('reference', champs.reference);
  if (champs.issuedAt) formulaire.append('issuedAt', champs.issuedAt);

  const { data } = await api.post(`/admin/expenses/${expenseId}/documents`, formulaire, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}

export async function supprimer(id) {
  const { data } = await api.delete(`/admin/documents/${id}`);
  return data;
}

/**
 * Ouvre un justificatif dans un nouvel onglet.
 *
 * La route de telechargement est protegee par le JWT : un simple lien ne
 * suffit pas, le navigateur n'enverrait pas l'en-tete Authorization. On
 * telecharge donc le fichier puis on l'affiche depuis une URL locale.
 */
export async function ouvrir(document) {
  const reponse = await fetch(`${URL_API}/admin/documents/${document.id}/download`, {
    headers: { Authorization: `Bearer ${lireJeton()}` },
  });

  if (!reponse.ok) {
    throw new Error("Le fichier est introuvable sur le serveur.");
  }

  const contenu = await reponse.blob();
  const url = URL.createObjectURL(contenu);
  window.open(url, '_blank', 'noopener');

  // L'onglet a le temps de charger le blob avant qu'on libere l'URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
