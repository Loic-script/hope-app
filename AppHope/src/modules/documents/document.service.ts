import type { Prisma, SupportingDocument } from '@prisma/client';
import { DocumentRepository } from './document.repository.js';
import type { AttachDocumentInput, DocumentFilters } from './document.types.js';
import { ExpenseRepository } from '../expenses/expense.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.types.js';
import { runInTransaction } from '../../database/unit-of-work.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import type { DbClient, PaginationOptions } from '../../shared/types.js';
import { optionalDate, optionalText, requireText } from '../../shared/validation.js';

/**
 * Justificatifs de depense (factures, recus, preuves bancaires...).
 *
 * PERIMETRE DE LA PHASE 1
 *   Le backend enregistre les METADONNEES du document, pas le fichier.
 *   L'upload HTTP et le stockage (disque, S3...) seront ajoutes plus tard :
 *   il suffira alors de renseigner `filePath` avec l'emplacement reel.
 */
export class DocumentService {
  constructor(
    private readonly documentRepository: DocumentRepository = new DocumentRepository(),
    private readonly expenseRepository: ExpenseRepository = new ExpenseRepository(),
    private readonly auditService: AuditService = new AuditService(),
  ) {}

  async attachDocument(input: AttachDocumentInput): Promise<SupportingDocument> {
    return runInTransaction(async (tx) => {
      const expense = await this.expenseRepository.findById(input.expenseId, tx);
      if (!expense) throw new NotFoundError('Depense', input.expenseId);

      if (input.fileSize != null && (!Number.isInteger(input.fileSize) || input.fileSize < 0)) {
        throw new ValidationError('fileSize doit etre un entier positif (en octets).', {
          fileSize: input.fileSize,
        });
      }

      const document = await this.documentRepository.create(
        {
          expenseId: expense.id,
          documentType: input.documentType,
          fileName: requireText(input.fileName, 'fileName', 255),
          filePath: requireText(input.filePath, 'filePath', 500),
          mimeType: optionalText(input.mimeType, 'mimeType', 120),
          fileSize: input.fileSize ?? null,
          reference: optionalText(input.reference, 'reference', 120),
          issuedAt: optionalDate(input.issuedAt, 'issuedAt'),
        },
        tx,
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.SUPPORTING_DOCUMENT,
          entityId: document.id,
          action: AUDIT_ACTIONS.DOCUMENT_ATTACHED,
          newData: {
            expenseId: expense.id,
            expenseReference: expense.reference,
            documentType: document.documentType,
            fileName: document.fileName,
            reference: document.reference,
          },
        },
        tx,
      );

      return document;
    });
  }

  async getDocumentById(id: string, tx?: DbClient): Promise<SupportingDocument> {
    const document = await this.documentRepository.findById(id, tx);
    if (!document) throw new NotFoundError('Justificatif', id);
    return document;
  }

  async getDocumentsForExpense(expenseId: string): Promise<SupportingDocument[]> {
    return this.documentRepository.findByExpenseId(expenseId);
  }

  async listDocuments(
    filters: DocumentFilters = {},
    options: PaginationOptions = {},
  ): Promise<SupportingDocument[]> {
    const where: Prisma.SupportingDocumentWhereInput = {};
    if (filters.expenseId) where.expenseId = filters.expenseId;
    if (filters.documentType) where.documentType = filters.documentType;
    return this.documentRepository.findMany(where, options);
  }

  /** true si la depense possede au moins un justificatif. */
  async hasSupportingDocument(expenseId: string): Promise<boolean> {
    return (await this.documentRepository.countByExpense(expenseId)) > 0;
  }
}
