import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

/**
 * Instance unique du client Prisma.
 *
 * L'URL provient exclusivement de .env : aucun identifiant n'est ecrit dans
 * le code. En mode test, src/config/env.ts bascule automatiquement sur
 * TEST_DATABASE_URL.
 */
export const prisma = new PrismaClient({
  datasourceUrl: env.databaseUrl,
  log: env.logLevel === 'debug' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

/** A appeler a la fin des scripts et des tests pour liberer le pool. */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
