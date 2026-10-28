import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { isMainModule, runScript } from '../shared/run-script.js';

/**
 * Cree la base PostgreSQL indiquee dans DATABASE_URL si elle n'existe pas.
 *
 *   npm run db:create
 *
 * Le script se connecte a la base d'administration "postgres" puis cree la
 * base cible. Il est idempotent : le relancer ne casse rien.
 *
 * A NOTER : `prisma migrate dev` cree deja la base automatiquement si elle
 * manque. Ce script reste utile pour preparer une base sans lancer de
 * migration (par exemple la base de test).
 */

interface DatabaseTarget {
  adminUrl: string;
  databaseName: string;
}

export function parseDatabaseUrl(url: string): DatabaseTarget {
  const parsed = new URL(url);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));

  if (!databaseName) {
    throw new Error(`DATABASE_URL ne contient pas de nom de base : ${url}`);
  }

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  return { adminUrl: adminUrl.toString(), databaseName };
}

/**
 * Protege un identifiant SQL en doublant les guillemets, comme le fait
 * `quote_ident` cote PostgreSQL. Necessaire car un nom de base ne peut pas
 * etre passe en parametre lie dans CREATE DATABASE.
 */
export function quoteIdentifier(name: string): string {
  return `"${name.split('"').join('""')}"`;
}

export async function createDatabaseIfMissing(databaseUrl: string): Promise<boolean> {
  const { adminUrl, databaseName } = parseDatabaseUrl(databaseUrl);

  // Client connecte a la base d'administration : on ne s'en sert que pour du
  // SQL brut, aucun modele Prisma n'y est attendu.
  const admin = new PrismaClient({ datasourceUrl: adminUrl });

  try {
    const existing = await admin.$queryRaw<
      { datname: string }[]
    >`SELECT datname FROM pg_database WHERE datname = ${databaseName}`;

    if (existing.length > 0) {
      console.log(`La base "${databaseName}" existe deja.`);
      return false;
    }

    await admin.$executeRawUnsafe(
      `CREATE DATABASE ${quoteIdentifier(databaseName)} ENCODING 'UTF8'`,
    );
    console.log(`Base "${databaseName}" creee.`);
    return true;
  } finally {
    await admin.$disconnect();
  }
}

if (isMainModule(import.meta.url)) {
  await runScript('db:create', async () => {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) {
      throw new Error("DATABASE_URL est absent : copiez .env.example vers .env.");
    }
    await createDatabaseIfMissing(databaseUrl);
  });
}
