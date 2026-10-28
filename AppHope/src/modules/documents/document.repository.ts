import type { Prisma, SupportingDocument } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { normalizePagination, type DbClient, type PaginationOptions } from '../../shared/types.js';

export class DocumentRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async create(
    data: Prisma.SupportingDocumentUncheckedCreateInput,
    tx?: DbClient,
  ): Promise<SupportingDocument> {
    return (tx ?? this.db).supportingDocument.create({ data });
  }

  async findById(id: string, tx?: DbClient): Promise<SupportingDocument | null> {
    return (tx ?? this.db).supportingDocument.findUnique({ where: { id } });
  }

  async findByExpenseId(expenseId: string, tx?: DbClient): Promise<SupportingDocument[]> {
    return (tx ?? this.db).supportingDocument.findMany({
      where: { expenseId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findMany(
    where: Prisma.SupportingDocumentWhereInput = {},
    options: PaginationOptions = {},
    tx?: DbClient,
  ): Promise<SupportingDocument[]> {
    const { skip, take } = normalizePagination(options);
    return (tx ?? this.db).supportingDocument.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async delete(id: string, tx?: DbClient): Promise<SupportingDocument> {
    return (tx ?? this.db).supportingDocument.delete({ where: { id } });
  }

  async countByExpense(expenseId: string, tx?: DbClient): Promise<number> {
    return (tx ?? this.db).supportingDocument.count({ where: { expenseId } });
  }
}
