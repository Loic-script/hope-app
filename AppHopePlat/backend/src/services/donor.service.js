import bcrypt from 'bcrypt';

import * as donorRepository from '../repositories/donor.repository.js';

import { ErreurIntrouvable, ErreurRegleMetier, ErreurValidation } from '../shared/errors.js';
import { texteFacultatif, texteRequis, identifiantRequis, valeurParmi } from '../shared/validation.js';

export const ORIGINES = ['LOCAL', 'INTERNATIONAL'];
export const STATUTS_COMPTE = ['ACTIVE', 'SUSPENDED'];

const TOURS_BCRYPT = 12;

const LONGUEUR_MOT_DE_PASSE = 8;

export async function lister(requete = {}) {
  let avecCompte = null;
  if (requete.account === 'AVEC') avecCompte = true;
  if (requete.account === 'SANS') avecCompte = false;

  const [donateurs, synthese] = await Promise.all([
    donorRepository.lister({
      avecCompte,
      origine: requete.origin ? valeurParmi(requete.origin, 'origin', ORIGINES) : null,
      recherche: texteFacultatif(requete.search, 'search', { max: 120 }),
    }),
    donorRepository.synthese(),
  ]);

  return { items: donateurs, summary: synthese };
}

export async function recupererParId(id) {
  const donateur = await donorRepository.trouverParId(identifiantRequis(id, 'id'));
  if (!donateur) throw new ErreurIntrouvable('Le donateur', id);
  return donateur;
}

function validerIdentite({ prenom, nom, organisation }) {
  if (!prenom && !nom && !organisation) {
    throw new ErreurRegleMetier(
      'Renseignez au moins un nom de personne ou une organisation.',
      'IDENTITE_MANQUANTE'
    );
  }
}

export async function creer(corps = {}) {
  const prenom = texteFacultatif(corps.firstName, 'firstName', { max: 120 });
  const nom = texteFacultatif(corps.lastName, 'lastName', { max: 120 });
  const organisation = texteFacultatif(corps.organizationName, 'organizationName', { max: 200 });

  validerIdentite({ prenom, nom, organisation });

  const pays = texteFacultatif(corps.country, 'country', { max: 120 }) ?? 'Madagascar';

  const origine = corps.origin
    ? valeurParmi(corps.origin, 'origin', ORIGINES)
    : pays.trim().toLowerCase() === 'madagascar'
      ? 'LOCAL'
      : 'INTERNATIONAL';

  return donorRepository.creer({
    firstName: prenom,
    lastName: nom,
    organizationName: organisation,
    email: texteFacultatif(corps.email, 'email', { max: 200 }),
    phone: texteFacultatif(corps.phone, 'phone', { max: 40 }),
    country: pays,
    city: texteFacultatif(corps.city, 'city', { max: 120 }),
    origin: origine,
  });
}

export async function mettreAJour(id, corps = {}) {
  const donorId = identifiantRequis(id, 'id');
  const existant = await donorRepository.trouverParId(donorId);
  if (!existant) throw new ErreurIntrouvable('Le donateur', donorId);

  const colonnes = {};
  if (corps.firstName !== undefined) {
    colonnes.first_name = texteFacultatif(corps.firstName, 'firstName', { max: 120 });
  }
  if (corps.lastName !== undefined) {
    colonnes.last_name = texteFacultatif(corps.lastName, 'lastName', { max: 120 });
  }
  if (corps.organizationName !== undefined) {
    colonnes.organization_name = texteFacultatif(corps.organizationName, 'organizationName', { max: 200 });
  }
  if (corps.email !== undefined) colonnes.email = texteFacultatif(corps.email, 'email', { max: 200 });
  if (corps.phone !== undefined) colonnes.phone = texteFacultatif(corps.phone, 'phone', { max: 40 });
  if (corps.country !== undefined) colonnes.country = texteFacultatif(corps.country, 'country', { max: 120 });
  if (corps.city !== undefined) colonnes.city = texteFacultatif(corps.city, 'city', { max: 120 });
  if (corps.origin !== undefined) colonnes.origin = valeurParmi(corps.origin, 'origin', ORIGINES);

  validerIdentite({
    prenom: colonnes.first_name ?? existant.firstName,
    nom: colonnes.last_name ?? existant.lastName,
    organisation: colonnes.organization_name ?? existant.organizationName,
  });

  return donorRepository.mettreAJour(donorId, colonnes);
}

export async function ouvrirCompte(donorId, corps = {}) {
  const id = identifiantRequis(donorId, 'donorId');
  const donateur = await donorRepository.trouverParId(id);
  if (!donateur) throw new ErreurIntrouvable('Le donateur', id);

  if (donateur.hasAccount) {
    throw new ErreurRegleMetier('Ce donateur possède déjà un compte.', 'COMPTE_EXISTANT');
  }

  const courriel = texteRequis(corps.email ?? donateur.email, 'email', { max: 200 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(courriel)) {
    throw new ErreurValidation('Adresse e-mail invalide.', { email: 'Format attendu : nom@domaine.fr' });
  }

  const motDePasse = String(corps.password ?? '');
  if (motDePasse.length < LONGUEUR_MOT_DE_PASSE) {
    throw new ErreurValidation(
      `Le mot de passe doit comporter au moins ${LONGUEUR_MOT_DE_PASSE} caractères.`,
      { password: `Minimum ${LONGUEUR_MOT_DE_PASSE} caractères` }
    );
  }

  const compte = await donorRepository.creerCompte({
    donorId: id,
    email: courriel,
    passwordHash: await bcrypt.hash(motDePasse, TOURS_BCRYPT),
  });

  return { donor: await donorRepository.trouverParId(id), account: compte };
}

export async function changerStatutCompte(accountId, corps = {}) {
  const id = identifiantRequis(accountId, 'id');
  const statut = valeurParmi(corps.status, 'status', STATUTS_COMPTE);

  const compte = await donorRepository.changerStatutCompte(id, statut);
  if (!compte) throw new ErreurIntrouvable('Le compte donateur', id);
  return compte;
}

export async function listerComptes() {
  return { items: await donorRepository.listerComptes() };
}
