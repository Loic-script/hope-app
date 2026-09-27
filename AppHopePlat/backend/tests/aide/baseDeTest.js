/*
 * Une base PostgreSQL jetable pour les tests d'integration.
 *
 * Chaque fichier de test qui en a besoin cree sa propre base
 * (hope_test_<pid>), y joue les scripts du projet -- initialisation,
 * schema, compte administrateur, categories -- puis la supprime a la fin.
 * La base de developpement n'est jamais touchee.
 *
 * Le serveur PostgreSQL est celui de DATABASE_URL (la CI) ou, a defaut,
 * celui des variables DB_* du fichier backend/.env (un poste de
 * developpement). Il faut le droit de creer une base.
 *
 * A appeler AVANT d'importer l'application : la configuration lit
 * DATABASE_URL a son premier chargement.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(ICI, '..', '..');
dotenv.config({ path: path.join(BACKEND, '.env'), quiet: true });

export const ADMIN_TEST = { adminLog: 'AdminTest', password: 'mot-de-passe-de-test-2026' };

/** L'adresse d'une base du serveur de test. */
function adresse(base, origine) {
  if (origine) {
    const url = new URL(origine);
    url.pathname = `/${base}`;
    return url.toString();
  }
  const e = encodeURIComponent;
  return `postgres://${e(process.env.DB_USER ?? '')}:${e(process.env.DB_PASSWORD ?? '')}@${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? 5432}/${base}`;
}

/** Joue un script du projet contre la base de test. */
function jouer(script, env) {
  execFileSync(process.execPath, [path.join(BACKEND, 'src', 'scripts', script)], {
    cwd: BACKEND,
    env,
    stdio: 'pipe',
  });
}

/**
 * Cree la base, la prepare, et bascule DATABASE_URL dessus.
 * @returns {Promise<{ url: string, sql: (texte: string, valeurs?: unknown[]) => Promise<object[]>, detruire: () => Promise<void> }>}
 */
export async function preparerBaseDeTest() {
  const origine = process.env.DATABASE_URL || null;
  const nom = `hope_test_${process.pid}_${Date.now().toString(36)}`;
  const maintenance = new pg.Client({ connectionString: adresse('postgres', origine) });
  await maintenance.connect();
  await maintenance.query(`CREATE DATABASE "${nom}"`);
  await maintenance.end();

  const url = adresse(nom, origine);
  const env = {
    ...process.env,
    DATABASE_URL: url,
    DB_SSL: '',
    NODE_ENV: 'test',
    ADMIN_LOG: ADMIN_TEST.adminLog,
    ADMIN_PASSWORD: ADMIN_TEST.password,
  };
  for (const script of ['initDatabase.js', 'migrate.js', 'seedAdmin.js', 'seedCategories.js']) jouer(script, env);

  process.env.DATABASE_URL = url;
  process.env.DB_SSL = '';
  // Les tests verifient aussi la limitation des tentatives : jamais desactivee ici.
  delete process.env.DESACTIVER_LIMITEUR;

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  return {
    url,
    sql: async (texte, valeurs = []) => (await client.query(texte, valeurs)).rows,
    detruire: async () => {
      await client.end();
      const m = new pg.Client({ connectionString: adresse('postgres', origine) });
      await m.connect();
      await m.query(`DROP DATABASE IF EXISTS "${nom}" WITH (FORCE)`);
      await m.end();
    },
  };
}
