import { randomInt } from 'node:crypto';

/**
 * Generation des references lisibles HOPE.
 *
 * Format : HOPE-<PREFIXE>-<AAAAMMJJ>-<6 CARACTERES>
 * Exemple : HOPE-TXN-20260903-A7K3M9
 *
 * L'alphabet exclut les caracteres ambigus (0/O, 1/I/L) afin que la reference
 * puisse etre dictee au telephone ou recopiee depuis un recu papier.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RANDOM_LENGTH = 6;

export const REFERENCE_PREFIXES = {
  DONATION: 'DON',
  TRANSACTION: 'TXN',
  PROJECT: 'PRJ',
  EXPENSE: 'EXP',
  BENEFICIARY: 'BEN',
} as const;

export type ReferencePrefix = (typeof REFERENCE_PREFIXES)[keyof typeof REFERENCE_PREFIXES];

function randomSuffix(): string {
  let suffix = '';
  for (let index = 0; index < RANDOM_LENGTH; index += 1) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }
  return suffix;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function generateReference(prefix: ReferencePrefix, date: Date = new Date()): string {
  return `HOPE-${prefix}-${formatDate(date)}-${randomSuffix()}`;
}

/**
 * Cree une entite dont la reference doit etre unique, en reessayant si la
 * base rejette un doublon (contrainte UNIQUE, code Prisma P2002).
 *
 * La collision est extremement improbable (31^6 combinaisons par jour et par
 * prefixe) mais on ne laisse jamais une contrainte d'unicite faire echouer
 * une operation financiere sans avoir reessaye.
 */
export async function createWithUniqueReference<T>(
  prefix: ReferencePrefix,
  create: (reference: string) => Promise<T>,
  maxAttempts = 5,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await create(generateReference(prefix));
    } catch (error) {
      if (!isUniqueReferenceViolation(error)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

function isUniqueReferenceViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; meta?: { target?: unknown } };
  if (candidate.code !== 'P2002') return false;
  const target = candidate.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? '')];
  return fields.some((field) => field.includes('reference'));
}
