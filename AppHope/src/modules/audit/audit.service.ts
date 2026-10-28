import { Prisma, type AuditLog } from '@prisma/client';
import { AuditRepository } from './audit.repository.js';
import type { AuditAction, AuditEntityType, RecordAuditInput } from './audit.types.js';
import { logger } from '../../shared/logger.js';
import type { DbClient, PaginationOptions } from '../../shared/types.js';

/**
 * Journal d'audit financier.
 *
 * Les entrees sont ecrites DANS la meme transaction PostgreSQL que
 * l'operation auditee : si l'operation echoue, la trace n'existe pas ; si
 * elle reussit, la trace existe forcement.
 */
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository = new AuditRepository()) {}

  async record(input: RecordAuditInput, tx?: DbClient): Promise<AuditLog> {
    const entry = await this.auditRepository.create(
      {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        oldData: toJsonValue(input.oldData),
        newData: toJsonValue(input.newData),
        actorId: input.actorId ?? null,
      },
      tx,
    );

    logger.debug('Audit enregistre.', {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
    });

    return entry;
  }

  async getEntityHistory(
    entityType: AuditEntityType,
    entityId: string,
    options: PaginationOptions = {},
  ): Promise<AuditLog[]> {
    return this.auditRepository.findByEntity(entityType, entityId, options);
  }

  async getByAction(action: AuditAction, options: PaginationOptions = {}): Promise<AuditLog[]> {
    return this.auditRepository.findByAction(action, options);
  }
}

/**
 * Prepare une valeur pour une colonne JSON PostgreSQL.
 *
 * Les Decimal et les Date ne sont pas serialisables tels quels : on les
 * convertit en chaines pour que le journal reste lisible et fidele
 * (un montant reste "70000.00", jamais un flottant approxime).
 */
export function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return normalize(value) as Prisma.InputJsonValue;
}

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Prisma.Decimal) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested === undefined) continue;
      result[key] = normalize(nested);
    }
    return result;
  }
  return value;
}
