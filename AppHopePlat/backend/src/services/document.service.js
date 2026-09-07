/**
 * Service des justificatifs.
 *
 * Un justificatif est le document qui prouve une depense (facture, recu,
 * preuve bancaire, contrat). La description de la depense reste dans
 * expenses.description : le justificatif ne la remplace pas.
 */
import path from 'node:path';

import * as documentRepository from '../repositories/document.repository.js';
import * as expenseRepository from '../repositories/expense.repository.js';

import { DOSSIER_JUSTIFICATIFS, supprimerFichier } from '../middleware/upload.middleware.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';
import {
  dateFacultative,
  identifiantFacultatif,
  identifiantRequis,
  texteFacultatif,
  valeurParmi,
} from '../shared/validation.js';

export const TYPES = ['INVOICE', 'RECEIPT', 'BANK_PROOF', 'CONTRACT', 'OTHER'];

/** Libelles metier, utilises par le frontend pour l'affichage. */
export const LIBELLES_TYPES = {
  INVOICE: 'Facture',
  RECEIPT: 'Recu',
  BANK_PROOF: 'Preuve bancaire',
  CONTRACT: 'Contrat',
  OTHER: 'Autre',
};

/** Ajoute l'URL de telechargement servie par l'API. */
function enrichir(document) {
  if (!document) return null;
  return {
    ...document,
    typeLabel: LIBELLES_TYPES[document.documentType] ?? document.documentType,
    downloadUrl: `/api/admin/documents/${document.id}/download`,
  };
}

export async function lister(requete = {}) {
  const documents = await documentRepository.lister({
    projectId: identifiantFacultatif(requete.projectId, 'projectId'),
    expenseId: identifiantFacultatif(requete.expenseId, 'expenseId'),
    type: requete.type ? valeurParmi(requete.type, 'type', TYPES) : null,
    recherche: texteFacultatif(requete.search, 'search', { max: 120 }),
  });
  return { items: documents.map(enrichir) };
}

export async function listerParDepense(expenseId) {
  const id = identifiantRequis(expenseId, 'expenseId');
  const depense = await expenseRepository.trouverParId(id);
  if (!depense) throw new ErreurIntrouvable('La depense', id);

  const documents = await documentRepository.listerParDepense(id);
  return { items: documents.map(enrichir) };
}

export async function recupererParId(id) {
  const document = await documentRepository.trouverParId(identifiantRequis(id, 'id'));
  if (!document) throw new ErreurIntrouvable('Le justificatif', id);
  return enrichir(document);
}

/**
 * Enregistre un justificatif deja televerse par le middleware multer.
 *
 * @param {number|string} expenseId depense justifiee
 * @param {Express.Multer.File} fichier fichier ecrit sur le disque
 * @param {Record<string, unknown>} corps champs du formulaire
 */
export async function creer(expenseId, fichier, corps = {}) {
  const id = identifiantRequis(expenseId, 'expenseId');

  if (!fichier) {
    throw new ErreurValidation('Aucun fichier recu. Le champ "file" est obligatoire.', {
      file: 'Champ obligatoire',
    });
  }

  const depense = await expenseRepository.trouverParId(id);
  if (!depense) {
    // La depense n'existe pas : on ne conserve pas le fichier orphelin.
    await supprimerFichier(fichier.path);
    throw new ErreurIntrouvable('La depense', id);
  }

  const document = await documentRepository.creer({
    expenseId: id,
    documentType: valeurParmi(corps.documentType, 'documentType', TYPES, { defaut: 'OTHER' }),
    // On garde le nom d'origine pour l'affichage, mais il ne sert jamais de
    // chemin sur le disque : seul le nom genere par multer est stocke.
    fileName: texteFacultatif(corps.fileName, 'fileName', { max: 255 }) ?? fichier.originalname,
    filePath: fichier.filename,
    mimeType: fichier.mimetype,
    fileSize: fichier.size,
    reference: texteFacultatif(corps.reference, 'reference', { max: 120 }),
    issuedAt: dateFacultative(corps.issuedAt, 'issuedAt'),
  });

  return enrichir(document);
}

/**
 * Chemin absolu du fichier, pour le telechargement.
 * Le chemin est reconstruit depuis le dossier de stockage et le nom stocke :
 * une valeur piegee en base ne peut pas faire sortir du dossier.
 */
export async function preparerTelechargement(id) {
  const document = await recupererParId(id);
  const nomSurDisque = path.basename(document.filePath);

  return {
    document,
    cheminAbsolu: path.join(DOSSIER_JUSTIFICATIFS, nomSurDisque),
  };
}

/** Supprime un justificatif (ligne en base et fichier sur le disque). */
export async function supprimer(id) {
  const documentId = identifiantRequis(id, 'id');
  const document = await documentRepository.trouverParId(documentId);
  if (!document) throw new ErreurIntrouvable('Le justificatif', documentId);

  const chemin = await documentRepository.supprimer(documentId);
  if (chemin) {
    await supprimerFichier(path.join(DOSSIER_JUSTIFICATIFS, path.basename(chemin)));
  }
  return { id: documentId, deleted: true };
}
