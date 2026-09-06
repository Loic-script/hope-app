/**
 * Service des beneficiaires et de leur rattachement aux projets.
 *
 * Confidentialite (cahier des charges, section 30) : ces donnees ne sont
 * servies que par des routes /api/admin/* protegees par le JWT
 * administrateur. Rien ici n'est destine a la partie publique du site.
 */
import * as beneficiaryRepository from '../repositories/beneficiary.repository.js';
import * as projectRepository from '../repositories/project.repository.js';

import { ErreurIntrouvable, ErreurRegleMetier } from '../shared/errors.js';
import {
  dateFacultative,
  identifiantFacultatif,
  identifiantRequis,
  texteFacultatif,
  texteRequis,
  valeurParmi,
} from '../shared/validation.js';

export const TYPES = ['ORPHAN', 'SINGLE_MOTHER', 'FAMILY', 'OTHER'];
export const STATUTS = ['ACTIVE', 'INACTIVE'];
export const GENRES = ['F', 'M', 'OTHER'];
export const STATUTS_RATTACHEMENT = ['ACTIVE', 'COMPLETED', 'WITHDRAWN'];

/** Libelles metier envoyes au frontend. */
export const LIBELLES_TYPES = {
  ORPHAN: 'Orphelin',
  SINGLE_MOTHER: 'Mere celibataire',
  FAMILY: 'Famille',
  OTHER: 'Autre',
};

/** Calcule l'age a partir de la date de naissance. */
function calculerAge(dateNaissance) {
  if (!dateNaissance) return null;
  const naissance = new Date(dateNaissance);
  if (Number.isNaN(naissance.getTime())) return null;

  const aujourdhui = new Date();
  let age = aujourdhui.getUTCFullYear() - naissance.getUTCFullYear();
  const mois = aujourdhui.getUTCMonth() - naissance.getUTCMonth();
  if (mois < 0 || (mois === 0 && aujourdhui.getUTCDate() < naissance.getUTCDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function enrichir(beneficiaire) {
  if (!beneficiaire) return null;
  return {
    ...beneficiaire,
    typeLabel: LIBELLES_TYPES[beneficiaire.beneficiaryType] ?? beneficiaire.beneficiaryType,
    age: calculerAge(beneficiaire.birthDate),
  };
}

export async function lister(requete = {}) {
  const beneficiaires = await beneficiaryRepository.lister({
    statut: requete.status ? valeurParmi(requete.status, 'status', STATUTS) : null,
    type: requete.type ? valeurParmi(requete.type, 'type', TYPES) : null,
    projectId: identifiantFacultatif(requete.projectId, 'projectId'),
    recherche: texteFacultatif(requete.search, 'search', { max: 120 }),
  });
  return { items: beneficiaires.map(enrichir) };
}

export async function recupererParId(id) {
  const beneficiaryId = identifiantRequis(id, 'id');
  const beneficiaire = await beneficiaryRepository.trouverParId(beneficiaryId);
  if (!beneficiaire) throw new ErreurIntrouvable('Le beneficiaire', beneficiaryId);

  return {
    ...enrichir(beneficiaire),
    projects: await beneficiaryRepository.listerProjetsDuBeneficiaire(beneficiaryId),
  };
}

export async function creer(corps = {}) {
  const beneficiaire = await beneficiaryRepository.creer({
    firstName: texteRequis(corps.firstName, 'firstName', { max: 120 }),
    lastName: texteRequis(corps.lastName, 'lastName', { max: 120 }),
    beneficiaryType: valeurParmi(corps.beneficiaryType, 'beneficiaryType', TYPES),
    gender: corps.gender ? valeurParmi(corps.gender, 'gender', GENRES) : null,
    birthDate: dateFacultative(corps.birthDate, 'birthDate'),
    country: texteFacultatif(corps.country, 'country', { max: 120 }) ?? 'Madagascar',
    city: texteFacultatif(corps.city, 'city', { max: 120 }),
    status: valeurParmi(corps.status, 'status', STATUTS, { defaut: 'ACTIVE' }),
    notes: texteFacultatif(corps.notes, 'notes', { max: 5000 }),
  });

  // Rattachement immediat si un projet est indique dans le formulaire.
  const projectId = identifiantFacultatif(corps.projectId, 'projectId');
  if (projectId !== null) {
    await rattacherAuProjet(projectId, { beneficiaryId: beneficiaire.id });
    return recupererParId(beneficiaire.id);
  }

  return enrichir(beneficiaire);
}

export async function mettreAJour(id, corps = {}) {
  const beneficiaryId = identifiantRequis(id, 'id');
  const existant = await beneficiaryRepository.trouverParId(beneficiaryId);
  if (!existant) throw new ErreurIntrouvable('Le beneficiaire', beneficiaryId);

  const colonnes = {};
  if (corps.firstName !== undefined) {
    colonnes.first_name = texteRequis(corps.firstName, 'firstName', { max: 120 });
  }
  if (corps.lastName !== undefined) {
    colonnes.last_name = texteRequis(corps.lastName, 'lastName', { max: 120 });
  }
  if (corps.beneficiaryType !== undefined) {
    colonnes.beneficiary_type = valeurParmi(corps.beneficiaryType, 'beneficiaryType', TYPES);
  }
  if (corps.gender !== undefined) {
    colonnes.gender = corps.gender ? valeurParmi(corps.gender, 'gender', GENRES) : null;
  }
  if (corps.birthDate !== undefined) {
    colonnes.birth_date = dateFacultative(corps.birthDate, 'birthDate');
  }
  if (corps.country !== undefined) {
    colonnes.country = texteFacultatif(corps.country, 'country', { max: 120 });
  }
  if (corps.city !== undefined) colonnes.city = texteFacultatif(corps.city, 'city', { max: 120 });
  if (corps.status !== undefined) colonnes.status = valeurParmi(corps.status, 'status', STATUTS);
  if (corps.notes !== undefined) colonnes.notes = texteFacultatif(corps.notes, 'notes', { max: 5000 });

  return enrichir(await beneficiaryRepository.mettreAJour(beneficiaryId, colonnes));
}

// ------------------------------------------------------------------
// Rattachement aux projets
// ------------------------------------------------------------------

export async function listerParProjet(projectId) {
  const id = identifiantRequis(projectId, 'projectId');
  const projet = await projectRepository.trouverParId(id);
  if (!projet) throw new ErreurIntrouvable('Le projet', id);

  const rattachements = await beneficiaryRepository.listerParProjet(id);
  return {
    items: rattachements.map((rattachement) => ({
      ...rattachement,
      typeLabel: LIBELLES_TYPES[rattachement.beneficiaryType] ?? rattachement.beneficiaryType,
      age: calculerAge(rattachement.birthDate),
    })),
  };
}

/** Rattache un beneficiaire existant a un projet. */
export async function rattacherAuProjet(projectId, corps = {}) {
  const idProjet = identifiantRequis(projectId, 'projectId');
  const idBeneficiaire = identifiantRequis(corps.beneficiaryId, 'beneficiaryId');

  const projet = await projectRepository.trouverParId(idProjet);
  if (!projet) throw new ErreurIntrouvable('Le projet', idProjet);
  // On peut nommer les beneficiaires apres la cloture du projet ;
  // seul l'archivage fige definitivement le dossier.
  if (projet.status === 'ARCHIVED') {
    throw new ErreurRegleMetier(
      'Ce projet est archivé : sa liste de bénéficiaires est figée.',
      'PROJET_ARCHIVE'
    );
  }

  const beneficiaire = await beneficiaryRepository.trouverParId(idBeneficiaire);
  if (!beneficiaire) throw new ErreurIntrouvable('Le beneficiaire', idBeneficiaire);

  const existant = await beneficiaryRepository.trouverRattachement(idProjet, idBeneficiaire);
  if (existant) {
    throw new ErreurRegleMetier(
      'Ce beneficiaire est deja rattache a ce projet.',
      'RATTACHEMENT_EXISTANT'
    );
  }

  return beneficiaryRepository.rattacher({
    projectId: idProjet,
    beneficiaryId: idBeneficiaire,
    joinedAt: dateFacultative(corps.joinedAt, 'joinedAt'),
    status: valeurParmi(corps.status, 'status', STATUTS_RATTACHEMENT, { defaut: 'ACTIVE' }),
    notes: texteFacultatif(corps.notes, 'notes', { max: 2000 }),
  });
}

/** Met a jour un rattachement (sortie du programme, notes de suivi). */
export async function mettreAJourRattachement(id, corps = {}) {
  const rattachementId = identifiantRequis(id, 'id');

  const colonnes = {};
  if (corps.status !== undefined) {
    colonnes.status = valeurParmi(corps.status, 'status', STATUTS_RATTACHEMENT);
  }
  if (corps.leftAt !== undefined) colonnes.left_at = dateFacultative(corps.leftAt, 'leftAt');
  if (corps.joinedAt !== undefined) colonnes.joined_at = dateFacultative(corps.joinedAt, 'joinedAt');
  if (corps.notes !== undefined) colonnes.notes = texteFacultatif(corps.notes, 'notes', { max: 2000 });

  const rattachement = await beneficiaryRepository.mettreAJourRattachement(rattachementId, colonnes);
  if (!rattachement) throw new ErreurIntrouvable('Le rattachement', rattachementId);
  return rattachement;
}
