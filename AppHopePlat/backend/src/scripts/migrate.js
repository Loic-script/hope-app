/**
 * Application du schema de l'espace administrateur.
 *
 *   npm run db:migrate
 *
 * Le script joue src/database/schema.sql, qui est idempotent : toutes les
 * tables sont creees en CREATE TABLE IF NOT EXISTS et les declencheurs sont
 * recrees a chaque passage. Il ne touche pas a la table "admins".
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pool, fermerPool } from '../config/database.js';
import { config } from '../config/env.js';

const dossierCourant = path.dirname(fileURLToPath(import.meta.url));
const CHEMIN_SCHEMA = path.resolve(dossierCourant, '..', 'database', 'schema.sql');

/** Tables attendues apres migration, dans l'ordre du modele metier. */
const TABLES_ATTENDUES = [
  'admins',
  'project_categories',
  'projects',
  'donors',
  'donor_accounts',
  'donations',
  'investments',
  'expenses',
  'supporting_documents',
  'beneficiaries',
  'project_beneficiaries',
  'impacts',
  'messages',
  'notifications',
];

async function executer() {
  console.log('[HOPE] Migration du schema administrateur...');
  console.log(`[HOPE] Cible : ${config.database.user}@${config.database.host}/${config.database.name}`);

  const sql = await fs.readFile(CHEMIN_SCHEMA, 'utf8');

  const client = await pool.connect();
  try {
    // Tout le schema passe dans une seule transaction : en cas d'erreur,
    // la base reste dans son etat initial.
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[HOPE] Schema applique.');
  } catch (erreur) {
    await client.query('ROLLBACK');
    throw erreur;
  } finally {
    client.release();
  }

  // Controle : toutes les tables du modele sont-elles presentes ?
  const presentes = await pool.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  const noms = new Set(presentes.rows.map((ligne) => ligne.table_name));
  const manquantes = TABLES_ATTENDUES.filter((table) => !noms.has(table));

  for (const table of TABLES_ATTENDUES) {
    console.log(`       ${noms.has(table) ? 'OK  ' : 'MANQUE'} ${table}`);
  }

  if (manquantes.length > 0) {
    throw new Error(`Tables manquantes apres migration : ${manquantes.join(', ')}`);
  }

  console.log(`[HOPE] ${TABLES_ATTENDUES.length} tables verifiees.`);
}

executer()
  .catch((erreur) => {
    console.error('[HOPE] Echec de la migration :', erreur.message);
    process.exitCode = 1;
  })
  .finally(() => fermerPool());
