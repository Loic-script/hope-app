import type { DocumentType } from '@prisma/client';

/**
 * Phase 1 : on enregistre uniquement les METADONNEES d'un justificatif.
 * Aucun upload HTTP, aucun stockage binaire : `filePath` designe simplement
 * l'emplacement du fichier (disque local, futur bucket S3...).
 */
export interface AttachDocumentInput {
  expenseId: string;
  documentType: DocumentType;
  fileName: string;
  filePath: string;
  mimeType?: string | null;
  fileSize?: number | null;
  /** Numero de facture / de recu figurant sur le document. */
  reference?: string | null;
  issuedAt?: Date | string | null;
}

export interface DocumentFilters {
  expenseId?: string;
  documentType?: DocumentType;
}
