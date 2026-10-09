import { apiDonateur } from './apiDonateur.js';

export async function recupererProfil() {
  const { data } = await apiDonateur.get('/donateur/profil');
  return data;
}

export async function listerProjets() {
  const { data } = await apiDonateur.get('/donateur/projets');
  return data;
}

export async function projet(id) {
  const { data } = await apiDonateur.get(`/donateur/projets/${id}`);
  return data;
}

export async function mesDons() {
  const { data } = await apiDonateur.get('/donateur/dons');
  return data;
}

export async function faireUnDon(don) {
  const { data } = await apiDonateur.post('/donateur/dons', don);
  return data;
}

export async function compteMvola() {
  const { data } = await apiDonateur.get('/donateur/paiement/mvola');
  return data;
}

export async function compteOrangeMoney() {
  const { data } = await apiDonateur.get('/donateur/paiement/orange-money');
  return data;
}

export async function coordonneesDePaiement() {
  const { data } = await apiDonateur.get('/donateur/paiement/coordonnees');
  return data;
}

export async function reglagesCarte() {
  const { data } = await apiDonateur.get('/donateur/paiement/carte');
  return data;
}

export async function ouvrirPaiementCarte(corps) {
  const { data } = await apiDonateur.post('/donateur/paiement/carte/session', corps);
  return data;
}

export async function etatPaiementCarte(sessionId) {
  const { data } = await apiDonateur.get(`/donateur/paiement/carte/session/${sessionId}`);
  return data;
}

export async function declarerPaiement(id, referencePaiement) {
  const { data } = await apiDonateur.patch(`/donateur/dons/${id}/justificatif`, { referencePaiement });
  return data;
}

export async function actualites() {
  const { data } = await apiDonateur.get('/donateur/actualites');
  return data.items ?? [];
}

export async function televerserPhoto(fichier) {
  const formulaire = new FormData();
  formulaire.append('file', fichier);
  const { data } = await apiDonateur.post('/donateur/profil/photo', formulaire, {
    headers: { 'Content-Type': undefined },
    timeout: 60000,
  });
  return data;
}

export async function changerPhoto(photoUrl) {
  const { data } = await apiDonateur.patch('/donateur/profil/photo', { photoUrl });
  return data;
}

export async function enregistrerEtape5(frequence) {
  const { data } = await apiDonateur.put('/donateur/profil/etape-5', frequence);
  return data;
}

export async function enregistrerEtape4(paiement) {
  const { data } = await apiDonateur.put('/donateur/profil/etape-4', paiement);
  return data;
}

export async function enregistrerEtape3(choix) {
  const { data } = await apiDonateur.put('/donateur/profil/etape-3', choix);
  return data;
}

export async function enregistrerEtape2(profil) {
  const { data } = await apiDonateur.put('/donateur/profil/etape-2', profil);
  return data;
}

export async function enregistrerEtape1(informations) {
  const { data } = await apiDonateur.put('/donateur/profil/etape-1', informations);
  return data;
}
