import type { AuditLog, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { normalizePagination, type DbClient, type PaginationOptions } from '../../shared/types.js';
import type { AuditAction, AuditEntityType } from './audit.types.js';

export interface CreateAuditLogData {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  oldData: Prisma.InputJsonValue | undefined;
  newData: Prisma.InputJsonValue | undefined;
  actorId: string | null;
}

export class AuditRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async create(data: CreateAuditLogData, tx?: DbClient): Promise<AuditLog> {
    return (tx ?? this.db).auditLog.create({ data });
  }

  async findByEntity(
    entityType: AuditEntityType,
    entityId: string,
    options: PaginationOptions = {},
    tx?: DbClient,
  ): Promise<AuditLog[]> {
    const { skip, take } = normalizePagination(options);
    return (tx ?? this.db).auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async findByAction(
    action: AuditAction,
    options: PaginationOptions = {},
    tx?: DbClient,
  ): Promise<AuditLog[]> {
    const { skip, take } = normalizePagination(options);
    return (tx ?? this.db).auditLog.findMany({
      where: { action },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async countByEntity(
    entityType: AuditEntityType,
    entityId: string,
    tx?: DbClient,
  ): Promise<number> {
    return (tx ?? this.db).auditLog.count({ where: { entityType, entityId } });
  }
}
