import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(ICI, '..', '..');
dotenv.config({ path: path.join(BACKEND, '.env'), quiet: true });

export const ADMIN_TEST = { adminLog: 'AdminTest', password: 'mot-de-passe-de-test-2026' };

function adresse(base, origine) {
  if (origine) {
    const url = new URL(origine);
    url.pathname = `/${base}`;
    return url.toString();
  }
  const e = encodeURIComponent;
  return `postgres://${e(process.env.DB_USER ?? '')}:${e(process.env.DB_PASSWORD ?? '')}@${process.env.DB_HOST ?? 'localhost'}:${process.env.DB_PORT ?? 5432}/${base}`;
}

function jouer(script, env) {
  execFileSync(process.execPath, [path.join(BACKEND, 'src', 'scripts', script)], {
    cwd: BACKEND,
    env,
    stdio: 'pipe',
  });
}

export async function preparerBaseDeTest({ prefixe = 'hope_test' } = {}) {
  const origine = process.env.DATABASE_URL || null;
  const nom = `${prefixe}_${process.pid}_${Date.now().toString(36)}`;
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
  process.env.SMTP_HOST = '';
  process.env.EQUIPE_EMAIL = '';
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

export async function nettoyerBasesOrphelines(prefixe) {
  const origine = process.env.DATABASE_URL || null;
  const m = new pg.Client({ connectionString: adresse('postgres', origine) });
  await m.connect();
  try {
    const motif = `${prefixe.replace(/_/g, '!_')}!_%`;
    const { rows } = await m.query("SELECT datname FROM pg_database WHERE datname LIKE $1 ESCAPE '!'", [motif]);
    for (const { datname } of rows) await m.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
  } finally {
    await m.end();
  }
}
