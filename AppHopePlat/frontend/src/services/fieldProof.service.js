import { api, URL_API } from './api.js';

export async function lister(filtres = {}) {
  const { data } = await api.get('/admin/field-proofs', { params: filtres });
  return data;
}

export async function recuperer(id) {
  const { data } = await api.get(`/admin/field-proofs/${id}`);
  return data;
}

export async function listerParProjet(projectId) {
  const { data } = await api.get(`/admin/projects/${projectId}/field-proofs`);
  return data;
}

export async function publier(champs) {
  const formulaire = new FormData();
  formulaire.append('projectId', champs.projectId);
  formulaire.append('proofType', champs.proofType);
  formulaire.append('description', champs.description);
  if (champs.occurredOn) formulaire.append('occurredOn', champs.occurredOn);
  for (const fichier of champs.files ?? []) formulaire.append('files', fichier);

  const { data } = await api.post('/admin/field-proofs', formulaire, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}

export async function supprimer(id) {
  const { data } = await api.delete(`/admin/field-proofs/${id}`);
  return data;
}

export function fichierPrincipal(preuve) {
  return preuve?.files?.[0] ?? null;
}

export async function urlDuFichier(preuve, fichier = null) {
  const cible = fichier ?? fichierPrincipal(preuve);
  if (!preuve?.id || !cible?.id) return null;

  const reponse = await fetch(`${URL_API}/admin/field-proofs/${preuve.id}/files/${cible.id}`, { credentials: 'same-origin' });
  if (!reponse.ok) return null;

  return URL.createObjectURL(await reponse.blob());
}
