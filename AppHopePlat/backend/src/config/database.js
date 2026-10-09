import pg from 'pg';
import { config } from './env.js';

const { Pool } = pg;

pg.types.setTypeParser(1082, (valeur) => valeur);

const connexion = config.database.url
  ? { connectionString: config.database.url }
  : {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
    };

export const pool = new Pool({
  ...connexion,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (erreur) => {
  console.error('[HOPE] Erreur inattendue sur le pool PostgreSQL :', erreur.message);
});

export function query(texte, parametres = [], client = null) {
  return (client ?? pool).query(texte, parametres);
}

export async function transaction(travail) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultat = await travail(client);
    await client.query('COMMIT');
    return resultat;
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }
}

export async function verifierConnexion() {
  const resultat = await pool.query('SELECT current_database() AS base, version() AS version');
  return resultat.rows[0];
}

export function fermerPool() {
  return pool.end();
}
