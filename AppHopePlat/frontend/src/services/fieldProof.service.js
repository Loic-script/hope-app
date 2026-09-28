/**
 * Service frontend des preuves terrain.
 *
 * Comme pour les justificatifs, le televersement passe par un FormData et
 * on laisse Axios choisir l'en-tete multipart et sa frontiere -- d'ou le
 * Content-Type mis a undefined.
 *
 * Le fichier d'une preuve est servi derriere le jeton, donc une balise
 * <img src="..."> ne peut pas l'afficher : elle ne porte pas d'en-tete
 * Authorization. On le recupere en blob, comme le fait deja
 * document.service.js pour ouvrir un justificatif.
 */
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

/**
 * Publie une preuve.
 *
 * @param {{ projectId: number, proofType: string, description: string,
 *           occurredOn?: string, files?: File[] }} champs
 */
export async function publier(champs) {
  const formulaire = new FormData();
  formulaire.append('projectId', champs.projectId);
  formulaire.append('proofType', champs.proofType);
  formulaire.append('description', champs.description);
  if (champs.occurredOn) formulaire.append('occurredOn', champs.occurredOn);
  // Un temoignage se passe de fichier : la boucle ne tourne alors pas.
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

/** Le premier fichier d'une preuve : celui qui la represente. */
export function fichierPrincipal(preuve) {
  return preuve?.files?.[0] ?? null;
}

/**
 * Recupere un fichier de preuve sous forme d'URL locale, utilisable dans
 * une balise <img> ou <video>.
 *
 * L'appelant doit liberer l'URL avec URL.revokeObjectURL quand il n'en a
 * plus besoin, sinon le navigateur garde le blob en memoire.
 *
 * @param {{ id: number }} preuve
 * @param {{ id: number }} [fichier] a defaut, le premier de la preuve
 * @returns {Promise<string|null>} null s'il n'y a pas de fichier
 */
export async function urlDuFichier(preuve, fichier = null) {
  const cible = fichier ?? fichierPrincipal(preuve);
  if (!preuve?.id || !cible?.id) return null;

  const reponse = await fetch(`${URL_API}/admin/field-proofs/${preuve.id}/files/${cible.id}`, { credentials: 'same-origin' });
  if (!reponse.ok) return null;

  return URL.createObjectURL(await reponse.blob());
}
