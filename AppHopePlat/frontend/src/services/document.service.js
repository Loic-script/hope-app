import { api, URL_API } from './api.js';

export async function lister(filtres = {}) {
  const { data } = await api.get('/admin/documents', { params: filtres });
  return data;
}

export async function listerParDepense(expenseId) {
  const { data } = await api.get(`/admin/expenses/${expenseId}/documents`);
  return data;
}

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

export async function ouvrir(document) {
  const reponse = await fetch(`${URL_API}/admin/documents/${document.id}/download`, { credentials: 'same-origin' });

  if (!reponse.ok) {
    throw new Error("Le fichier est introuvable sur le serveur.");
  }

  const contenu = await reponse.blob();
  const url = URL.createObjectURL(contenu);
  window.open(url, '_blank', 'noopener');

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
