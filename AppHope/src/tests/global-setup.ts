import 'dotenv/config';
import { execSync } from 'node:child_process';
import { createDatabaseIfMissing } from '../scripts/create-database.js';

/**
 * Prepare la base de test UNE SEULE FOIS avant toute la suite :
 *   1. cree la base si elle n'existe pas ;
 *   2. applique toutes les migrations Prisma.
 *
 * On ne touche jamais a la base de developpement : tout se passe sur
 * TEST_DATABASE_URL.
 */
export default async function globalSetup(): Promise<void> {
  const testDatabaseUrl = process.env['TEST_DATABASE_URL'];

  if (!testDatabaseUrl) {
    throw new Error(
      'TEST_DATABASE_URL est absent de .env. ' +
        'Ajoutez par exemple : ' +
        'TEST_DATABASE_URL="postgresql://postgres:MOT_DE_PASSE@localhost:5432/hope_donations_test"',
    );
  }

  await createDatabaseIfMissing(testDatabaseUrl);

  // Commande passee en une seule chaine : evite l'avertissement Node lie a
  // la combinaison d'arguments separes et de `shell: true`.
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'pipe',
  });

  console.log('Base de test prete.');
}
