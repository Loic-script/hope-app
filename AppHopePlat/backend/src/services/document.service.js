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

export const TYPES = [
  'INVOICE',
  'RECEIPT',
  'QUOTE',
  'CONTRACT',
  'DELIVERY_NOTE',
  'BANK_PROOF',
  'ACTIVITY_REPORT',
  'COMPLETION_PHOTO',
  'CERTIFICATE',
  'PARTNER_AGREEMENT',
  'OTHER',
];

export const LIBELLES_TYPES = {
  INVOICE: 'Facture',
  RECEIPT: 'Reçu',
  QUOTE: 'Devis',
  CONTRACT: 'Contrat',
  DELIVERY_NOTE: 'Bon de livraison',
  BANK_PROOF: 'Preuve de paiement',
  ACTIVITY_REPORT: 'Rapport d’activité',
  COMPLETION_PHOTO: 'Photo de réalisation',
  CERTIFICATE: 'Certificat',
  PARTNER_AGREEMENT: 'Convention partenaire',
  OTHER: 'Autre',
};

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

export async function creer(expenseId, fichier, corps = {}, admin = null) {
  const id = identifiantRequis(expenseId, 'expenseId');

  if (!fichier) {
    throw new ErreurValidation('Aucun fichier recu. Le champ "file" est obligatoire.', {
      file: 'Champ obligatoire',
    });
  }

  const depense = await expenseRepository.trouverParId(id);
  if (!depense) {
    await supprimerFichier(fichier.path);
    throw new ErreurIntrouvable('La depense', id);
  }

  const document = await documentRepository.creer({
    expenseId: id,
    adminId: admin?.id ?? null,
    documentType: valeurParmi(corps.documentType, 'documentType', TYPES, { defaut: 'INVOICE' }),
    fileName: texteFacultatif(corps.fileName, 'fileName', { max: 255 }) ?? fichier.originalname,
    filePath: fichier.filename,
    mimeType: fichier.mimetype,
    fileSize: fichier.size,
    reference: texteFacultatif(corps.reference, 'reference', { max: 120 }),
    issuedAt: dateFacultative(corps.issuedAt, 'issuedAt'),
  });

  return enrichir(document);
}

export async function preparerTelechargement(id) {
  const document = await recupererParId(id);
  const nomSurDisque = path.basename(document.filePath);

  return {
    document,
    cheminAbsolu: path.join(DOSSIER_JUSTIFICATIFS, nomSurDisque),
  };
}

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
