import { URL_API } from './api.js';
import { apiBenevole } from './apiBenevole.js';

export async function apercu() {
  const { data } = await apiBenevole.get('/benevole/apercu');
  return data;
}

export async function optionsDon() {
  const { data } = await apiBenevole.get('/benevole/dons/options');
  return data;
}

export async function faireUnDon(don) {
  const { data } = await apiBenevole.post('/benevole/dons', don);
  return data;
}

export async function coordonneesDePaiement() {
  const { data } = await apiBenevole.get('/benevole/paiement/coordonnees');
  return data;
}

export async function reglagesCarte() {
  const { data } = await apiBenevole.get('/benevole/paiement/carte');
  return data;
}

export async function ouvrirPaiementCarte(corps) {
  const { data } = await apiBenevole.post('/benevole/paiement/carte/session', corps);
  return data;
}

export async function etatPaiementCarte(sessionId) {
  const { data } = await apiBenevole.get(`/benevole/paiement/carte/session/${sessionId}`);
  return data;
}

export async function declarerPaiement(id, referencePaiement) {
  const { data } = await apiBenevole.patch(`/benevole/dons/${id}/justificatif`, { referencePaiement });
  return data;
}

export async function actualites() {
  const { data } = await apiBenevole.get('/benevole/actualites');
  return data.items ?? [];
}

export async function listerProjets() {
  const { data } = await apiBenevole.get('/benevole/projets');
  return data.items ?? [];
}

export async function recupererProjet(id) {
  const { data } = await apiBenevole.get(`/benevole/projets/${id}`);
  return data;
}

export async function urlDuFichierPreuve(projetId, preuve, fichier) {
  if (!projetId || !preuve?.id || !fichier?.id) return null;

  const reponse = await fetch(
    `${URL_API}/benevole/projets/${projetId}/preuves/${preuve.id}/fichiers/${fichier.id}`,
    { credentials: 'same-origin' }
  );
  if (!reponse.ok) return null;
  return URL.createObjectURL(await reponse.blob());
}

export async function ajouterPreuve(projetId, { proofType, description, occurredOn, fichiers = [] }) {
  const formulaire = new FormData();
  formulaire.append('proofType', proofType);
  formulaire.append('description', description);
  if (occurredOn) formulaire.append('occurredOn', occurredOn);
  for (const fichier of fichiers) formulaire.append('files', fichier);

  const { data } = await apiBenevole.post(`/benevole/projets/${projetId}/preuves`, formulaire, {
    headers: { 'Content-Type': undefined },
    timeout: 120000,
  });
  return data;
}

export async function supprimerPreuve(projetId, preuveId) {
  const { data } = await apiBenevole.delete(`/benevole/projets/${projetId}/preuves/${preuveId}`);
  return data;
}

export async function mesTaches(filtres = {}) {
  const { data } = await apiBenevole.get('/benevole/taches', { params: filtres });
  return data;
}

export async function tachesLibres() {
  const { data } = await apiBenevole.get('/benevole/taches/libres');
  return data.items ?? [];
}

export async function demanderTache(id) {
  const { data } = await apiBenevole.post(`/benevole/taches/${id}/demander`);
  return data;
}

export async function annulerDemandeTache(id) {
  const { data } = await apiBenevole.post(`/benevole/taches/${id}/annuler-demande`);
  return data;
}

export async function relacherTache(id) {
  const { data } = await apiBenevole.post(`/benevole/taches/${id}/relacher`);
  return data;
}

export async function livrerTache(id, fichiers = [], commentaire = '') {
  const formulaire = new FormData();
  for (const fichier of fichiers) formulaire.append('files', fichier);
  if (commentaire.trim()) formulaire.append('commentaire', commentaire.trim());

  const { data } = await apiBenevole.post(`/benevole/taches/${id}/livrer`, formulaire, {
    headers: { 'Content-Type': undefined },
    timeout: 120000,
  });
  return data;
}

export async function urlDuFichierTache(tache, fichier) {
  if (!tache?.id || !fichier?.id) return null;

  const reponse = await fetch(`${URL_API}/benevole/taches/${tache.id}/fichiers/${fichier.id}`, { credentials: 'same-origin' });
  if (!reponse.ok) return null;
  return URL.createObjectURL(await reponse.blob());
}

export async function recupererProfil() {
  const { data } = await apiBenevole.get('/benevole/profil');
  return data;
}

export async function mettreAJourProfil(corps) {
  const { data } = await apiBenevole.patch('/benevole/profil', corps);
  return data;
}

export async function televerserPhoto(fichier) {
  const formulaire = new FormData();
  formulaire.append('file', fichier);

  const { data } = await apiBenevole.post('/benevole/profil/photo', formulaire, {
    headers: { 'Content-Type': undefined },
  });
  return data;
}

export async function journal() {
  const { data } = await apiBenevole.get('/benevole/journal');
  return data;
}

export async function listerBenevoles() {
  const { data } = await apiBenevole.get('/benevole/benevoles');
  return data.items ?? [];
}

export async function profilBenevole(id) {
  const { data } = await apiBenevole.get(`/benevole/benevoles/${id}`);
  return data;
}
