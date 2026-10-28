import { createServer } from './server.js';
import { env } from '../config/env.js';
import { disconnectPrisma, prisma } from '../database/prisma.js';
import { logger } from '../shared/logger.js';

/**
 * Demarrage du serveur HTTP.
 *
 *   npm run api          (rechargement automatique)
 *   npm run api:start    (execution simple)
 */

const port = Number(process.env['PORT'] ?? 3000);

async function main(): Promise<void> {
  // On verifie la base AVANT d'ouvrir le port : mieux vaut ne pas demarrer du
  // tout que d'accepter des dons et de les perdre faute de base joignable.
  await prisma.$queryRaw`SELECT 1`;

  const app = createServer();

  const server = app.listen(port, () => {
    logger.info(`API HOPE demarree sur http://localhost:${port}/api`, {
      environment: env.nodeEnv,
    });
  });

  const shutdown = (signal: string): void => {
    logger.info(`Signal ${signal} recu : arret en cours.`);
    server.close(() => {
      void disconnectPrisma().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.error("L'API n'a pas pu demarrer.", {
    message: error instanceof Error ? error.message : String(error),
  });
  console.error(
    '\nVerifiez que PostgreSQL est demarre et que DATABASE_URL est correct dans .env.\n',
  );
  process.exit(1);
});
