import type { Prisma } from '@prisma/client';

/**
 * Client de base de donnees accepte par les repositories.
 *
 * `Prisma.TransactionClient` est le sous-ensemble de PrismaClient disponible a
 * l'interieur d'un `$transaction`. Comme PrismaClient lui-meme est assignable
 * a ce type, un repository peut travailler indifferemment hors transaction ou
 * dans une transaction PostgreSQL.
 */
export type DbClient = Prisma.TransactionClient;

/** Options de pagination communes a tous les repositories de listing. */
export interface PaginationOptions {
  skip?: number;
  take?: number;
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export function normalizePagination(options: PaginationOptions = {}): Required<PaginationOptions> {
  const take = Math.min(Math.max(options.take ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const skip = Math.max(options.skip ?? 0, 0);
  return { skip, take };
}
