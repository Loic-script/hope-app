import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pool, fermerPool } from '../config/database.js';
import { config } from '../config/env.js';

const dossierCourant = path.dirname(fileURLToPath(import.meta.url));
const CHEMIN_SCHEMA = path.resolve(dossierCourant, '..', 'database', 'schema.sql');

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
  'Comptes des espaces utilisateurs': ['utilisateur', 'utilisateur_role', 'reinitialisation_mot_de_passe',
    'verification_courriel',
    'journal_audit', 'publication_jaime', 'publication_commentaire'],
  'Espace benevole': [
    'benevole',
    'mission',
    'inscription_mission',
    'tache',
    'tache_fichier',
    'tache_benevole',
    'avis_mission',
  ],
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
    'contact_messages',
  ],
  'Conversations': ['conversation', 'conversation_participant', 'conversation_message', 'conversation_piece'],
};

const COLONNES_ATTENDUES = [
  ['supporting_documents', 'admin_id'],
  ['utilisateur', 'profil_complete'],
  ['utilisateur', 'conditions_acceptees_le'],
  ['utilisateur', 'sessions_valides_depuis'],
  ['utilisateur', 'email_verifie_le'],
  ['expenses', 'beneficiary_id'],
  ['admins', 'sessions_valides_depuis'],
  ['admins', 'email'],
  ['admins', 'photo_url'],
  ['beneficiaries', 'photo_fichier'],
  ['tache', 'livree_par'],
  ['tache', 'commentaire_livraison'],
  ['field_proofs', 'benevole_id'],
  ['projects', 'description_titre'],
  ['projects', 'project_type'],
  ['conversation', 'type'],
  ['conversation', 'assistance'],
  ['conversation_message', 'supprime_le'],
  ['impacts', 'objective_id'],
  ['document_bailleur', 'contenu'],
  ['donateur', 'type_donateur'],
  ['donateur', 'fuseau_horaire'],
  ['donateur', 'affectation'],
  ['donateur', 'mode_paiement'],
  ['donateur', 'frequence'],
  ['donations', 'provider_session_id'],
];

async function executer() {
  console.log('[HOPE] Migration du schema...');
  console.log(`[HOPE] Cible : ${config.database.user}@${config.database.host}/${config.database.name}`);

  const sql = await fs.readFile(CHEMIN_SCHEMA, 'utf8');

  const client = await pool.connect();
  try {
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
