import { defineConfig } from 'vitest/config';

/**
 * Configuration des tests.
 *
 * IMPORTANT : les tests d'integration utilisent une VRAIE base PostgreSQL,
 * distincte de la base de developpement (TEST_DATABASE_URL dans .env).
 * Elle est creee et migree automatiquement par src/tests/global-setup.ts.
 *
 * `fileParallelism: false` fait s'executer les fichiers de test l'un apres
 * l'autre dans un seul worker : ils partagent la meme base, deux fichiers ne
 * doivent donc jamais vider les tables en meme temps.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    globalSetup: ['src/tests/global-setup.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
