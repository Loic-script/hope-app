import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Configuration Prisma (remplace le champ deprecie `package.json#prisma`).
 *
 * `import 'dotenv/config'` est obligatoire ici : avec un fichier de config,
 * Prisma ne charge plus automatiquement le fichier .env.
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
