/**
 * Application du schema de la base HOPE.
 *
 *   npm run db:migrate
 *
 * Le script joue src/database/schema.sql, qui est idempotent : toutes les
 * tables sont creees en CREATE TABLE IF NOT EXISTS, les colonnes ajoutees
 * apres coup en ALTER TABLE ... ADD COLUMN IF NOT EXISTS, et les
 * declencheurs sont recrees a chaque passage. On peut donc le rejouer
 * autant de fois qu'on veut : il n'y a rien a versionner ni a defaire.
 *
 * Il ne touche pas a la table "admins", qui porte le mot de passe
 * administrateur et se cree a l'initialisation du projet.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pool, fermerPool } from '../config/database.js';
import { config } from '../config/env.js';

const dossierCourant = path.dirname(fileURLToPath(import.meta.url));
const CHEMIN_SCHEMA = path.resolve(dossierCourant, '..', 'database', 'schema.sql');

/**
 * Tables attendues apres migration, groupees par espace.
 *
 * La liste sert de filet : si une section du schema cesse de passer, on
 * le voit ici plutot que lors du premier appel d'API en echec.
 */
const TABLES_ATTENDUES = {
  'Espace administrateur': [
    'admins',
    'project_categories',
    'projects',
    'project_objectives',
    'project_quote_items',
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
    'field_proofs',
    'field_proof_files',
    'activity_log',
  ],
  'Comptes des espaces utilisateurs': ['utilisateur', 'utilisateur_role'],
  'Espace benevole': ['benevole', 'mission', 'inscription_mission', 'tache', 'tache_fichier', 'avis_mission'],
  'Espace donateur': ['donateur'],
  'Espace bailleur': [
    'bailleur',
    'bailleur_contact',
    'engagement',
    'versement',
    'affectation',
    'document_bailleur',
    'distinction',
    'bailleur_distinction',
  ],
  'Fil commun': ['publication', 'manifestation_interet'],
  'Notifications et messages des espaces': [
    'notification_utilisateur',
    'message_utilisateur',
    'message_entree',
  ],
  'Conversations': ['conversation', 'conversation_participant', 'conversation_message', 'conversation_piece'],
};

/**
 * Colonnes ajoutees apres la premiere version d'une table.
 *
 * CREATE TABLE IF NOT EXISTS ne voit pas une table qui existe deja : ces
 * colonnes n'arrivent que par ALTER TABLE. Une base plus ancienne que le
 * schema aurait donc toutes ses tables sans avoir toutes ses colonnes,
 * et le controle des tables seules ne dirait rien.
 */
const COLONNES_ATTENDUES = [
  ['supporting_documents', 'admin_id'],
  ['utilisateur', 'profil_complete'],
  ['admins', 'photo_url'],
  ['projects', 'description_titre'],
  ['projects', 'project_type'],
  ['conversation', 'type'],
  ['conversation', 'assistance'],
  ['conversation_message', 'supprime_le'],
  ['impacts', 'objective_id'],
  ['document_bailleur', 'contenu'],
  ['donateur', 'type_donateur'],
  ['donateur', 'fuseau_horaire'],
];

async function executer() {
  console.log('[HOPE] Migration du schema...');
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

  // ---------- Controle des tables ----------
  const presentes = await pool.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  const noms = new Set(presentes.rows.map((ligne) => ligne.table_name));

  const manquantes = [];
  let total = 0;

  for (const [espace, tables] of Object.entries(TABLES_ATTENDUES)) {
    console.log(`\n       ${espace}`);
    for (const table of tables) {
      total += 1;
      const presente = noms.has(table);
      if (!presente) manquantes.push(table);
      console.log(`       ${presente ? 'OK    ' : 'MANQUE'} ${table}`);
    }
  }

  // ---------- Controle des colonnes ajoutees apres coup ----------
  const colonnes = await pool.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'`
  );
  const clesColonnes = new Set(
    colonnes.rows.map((ligne) => `${ligne.table_name}.${ligne.column_name}`)
  );

  console.log('\n       Colonnes ajoutees apres coup');
  for (const [table, colonne] of COLONNES_ATTENDUES) {
    const presente = clesColonnes.has(`${table}.${colonne}`);
    if (!presente) manquantes.push(`${table}.${colonne}`);
    console.log(`       ${presente ? 'OK    ' : 'MANQUE'} ${table}.${colonne}`);
  }

  if (manquantes.length > 0) {
    throw new Error(`Manquant apres migration : ${manquantes.join(', ')}`);
  }

  console.log(`\n[HOPE] ${total} tables et ${COLONNES_ATTENDUES.length} colonnes verifiees.`);
}

executer()
  .catch((erreur) => {
    console.error('[HOPE] Echec de la migration :', erreur.message);
    process.exitCode = 1;
  })
  .finally(() => fermerPool());
