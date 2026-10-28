import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { logger } from '../shared/logger.js';
import type { DbClient } from '../shared/types.js';

/**
 * Unite de travail : execute plusieurs ecritures liees dans une seule
 * transaction PostgreSQL (regle financiere n.10).
 *
 * Le niveau d'isolation par defaut est Serializable : c'est le seul qui
 * empeche reellement deux affectations concurrentes de depasser ensemble les
 * fonds disponibles (le classique "lire le solde puis ecrire"). PostgreSQL
 * peut alors rejeter une transaction avec une erreur de serialisation
 * (SQLSTATE 40001) : on la rejoue automatiquement.
 */

export interface TransactionOptions {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxRetries?: number;
  /** Delai maximal d'attente d'une connexion, en millisecondes. */
  maxWait?: number;
  /** Duree maximale de la transaction, en millisecondes. */
  timeout?: number;
}

const SERIALIZATION_FAILURE_CODES = new Set(['P2034', '40001', '40P01']);

function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return SERIALIZATION_FAILURE_CODES.has(error.code);
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return SERIALIZATION_FAILURE_CODES.has(String((error as { code: unknown }).code));
  }
  return false;
}

export async function runInTransaction<T>(
  work: (tx: DbClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const {
    isolationLevel = Prisma.TransactionIsolationLevel.Serializable,
    maxRetries = 3,
    maxWait = 5_000,
    timeout = 15_000,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await prisma.$transaction((tx) => work(tx), { isolationLevel, maxWait, timeout });
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === maxRetries) {
        throw error;
      }
      logger.warn('Conflit de serialisation PostgreSQL : nouvelle tentative.', {
        attempt,
        maxRetries,
      });
    }
  }

  throw lastError;
}
