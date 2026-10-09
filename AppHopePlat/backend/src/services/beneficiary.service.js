import * as beneficiaryRepository from '../repositories/beneficiary.repository.js';
import * as projectRepository from '../repositories/project.repository.js';
import * as expenseRepository from '../repositories/expense.repository.js';
import * as expenseService from './expense.service.js';
import { transaction } from '../config/database.js';
import * as photos from './photoBeneficiaire.service.js';

import { ErreurIntrouvable, ErreurRegleMetier, ErreurValidation } from '../shared/errors.js';
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

export const LIBELLES_TYPES = {
  ORPHAN: 'Orphelin',
  SINGLE_MOTHER: 'Mere celibataire',
  FAMILY: 'Famille',
  OTHER: 'Autre',
};

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

function enrichir(beneficiaire, admin = null) {
  if (!beneficiaire) return null;
  return {
    ...beneficiaire,
    typeLabel: LIBELLES_TYPES[beneficiaire.beneficiaryType] ?? beneficiaire.beneficiaryType,
    age: calculerAge(beneficiaire.birthDate),
    photoUrl: beneficiaire.photoFichier ? photos.adresseSignee(beneficiaire.photoFichier, admin) : null,
  };
}

async function photoValide(fichier, beneficiaryId = null) {
  if (fichier === null || fichier === '') return null;
  if (!photos.existe(fichier)) {
    throw new ErreurValidation('Cette photo est introuvable : importez-la de nouveau.', {
      photoFichier: 'Photo introuvable',
    });
  }
  if (await beneficiaryRepository.photoDejaPrise(fichier, beneficiaryId)) {
    throw new ErreurValidation('Cette photo appartient déjà à un autre bénéficiaire.', {
      photoFichier: 'Photo déjà utilisée',
    });
  }
  return fichier;
}

export async function televerserPhoto(fichier, admin) {
  const nom = await photos.enregistrer(fichier);
  return { fichier: nom, url: photos.adresseSignee(nom, admin) };
}

export async function lister(requete = {}, admin = null) {
  const beneficiaires = await beneficiaryRepository.lister({
    statut: requete.status ? valeurParmi(requete.status, 'status', STATUTS) : null,
    type: requete.type ? valeurParmi(requete.type, 'type', TYPES) : null,
    projectId: identifiantFacultatif(requete.projectId, 'projectId'),
    recherche: texteFacultatif(requete.search, 'search', { max: 120 }),
  });
  return { items: beneficiaires.map((b) => enrichir(b, admin)) };
}

export async function recupererParId(id, admin = null) {
  const beneficiaryId = identifiantRequis(id, 'id');
  const beneficiaire = await beneficiaryRepository.trouverParId(beneficiaryId);
  if (!beneficiaire) throw new ErreurIntrouvable('Le beneficiaire', beneficiaryId);

  const [projets, depenses] = await Promise.all([
    beneficiaryRepository.listerProjetsDuBeneficiaire(beneficiaryId),
    expenseRepository.lister({ beneficiaryId, limite: 200 }),
  ]);
  return {
    ...enrichir(beneficiaire, admin),
    projects: projets,
    expenses: depenses,
  };
}

export async function creer(corps = {}, admin = null) {
  const photoFichier =
    corps.photoFichier === undefined ? null : await photoValide(corps.photoFichier);
  const projectId = identifiantFacultatif(corps.projectId, 'projectId');
  const depense = corps.depense && String(corps.depense.amount ?? '').trim() !== '' ? corps.depense : null;
  if (depense && projectId === null) {
    throw new ErreurValidation('Choisissez le projet sur lequel l’argent a été dépensé.', {
      projectId: 'Projet requis pour une dépense',
    });
  }

  const cree = await transaction(async (client) => {
    const beneficiaire = await beneficiaryRepository.creer(
      {
        firstName: texteRequis(corps.firstName, 'firstName', { max: 120 }),
        lastName: texteRequis(corps.lastName, 'lastName', { max: 120 }),
        beneficiaryType: valeurParmi(corps.beneficiaryType, 'beneficiaryType', TYPES),
        gender: corps.gender ? valeurParmi(corps.gender, 'gender', GENRES) : null,
        birthDate: dateFacultative(corps.birthDate, 'birthDate'),
        country: texteFacultatif(corps.country, 'country', { max: 120 }) ?? 'Madagascar',
        city: texteFacultatif(corps.city, 'city', { max: 120 }),
        status: valeurParmi(corps.status, 'status', STATUTS, { defaut: 'ACTIVE' }),
        notes: texteFacultatif(corps.notes, 'notes', { max: 5000 }),
        photoFichier,
      },
      client
    );

    if (projectId !== null) {
      const projet = await projectRepository.trouverParId(projectId, client);
      if (!projet) throw new ErreurIntrouvable('Le projet', projectId);
      if (projet.status === 'ARCHIVED') {
        throw new ErreurRegleMetier('Ce projet est archivé : sa liste de bénéficiaires est figée.', 'PROJET_ARCHIVE');
      }
      await beneficiaryRepository.rattacher(
        { projectId, beneficiaryId: beneficiaire.id, joinedAt: null, status: 'ACTIVE', notes: null },
        client
      );
    }

    if (depense) {
      await expenseService.enregistrer(client, {
        projectId,
        beneficiaryId: beneficiaire.id,
        amount: depense.amount,
        currency: depense.currency,
        description:
          texteFacultatif(depense.description, 'description', { max: 2000 }) ??
          `Dépense pour ${beneficiaire.firstName} ${beneficiaire.lastName}`.trim(),
        category: depense.category,
        expenseDate: depense.expenseDate,
      });
    }
    return beneficiaire;
  });

  return projectId !== null ? recupererParId(cree.id, admin) : enrichir(cree, admin);
}

export async function mettreAJour(id, corps = {}, admin = null) {
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
  if (corps.photoFichier !== undefined) {
    colonnes.photo_fichier = await photoValide(corps.photoFichier, beneficiaryId);
  }

  const misAJour = await beneficiaryRepository.mettreAJour(beneficiaryId, colonnes);

  if (
    colonnes.photo_fichier !== undefined &&
    existant.photoFichier &&
    existant.photoFichier !== colonnes.photo_fichier
  ) {
    await photos.effacer(existant.photoFichier);
  }

  return enrichir(misAJour, admin);
}

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

export async function rattacherAuProjet(projectId, corps = {}) {
  const idProjet = identifiantRequis(projectId, 'projectId');
  const idBeneficiaire = identifiantRequis(corps.beneficiaryId, 'beneficiaryId');

  const projet = await projectRepository.trouverParId(idProjet);
  if (!projet) throw new ErreurIntrouvable('Le projet', idProjet);
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
