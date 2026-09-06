/**
 * Remise a zero des donnees metier.
 *
 *   npm run db:reset           affiche ce qui serait supprime (aucune ecriture)
 *   npm run db:reset -- --force supprime reellement
 *
 * CE QUI EST SUPPRIME : projets, donateurs et leurs comptes, dons,
 * investissements, depenses, justificatifs (lignes et fichiers),
 * beneficiaires, impacts, messages, notifications.
 *
 * CE QUI EST CONSERVE :
 *   * la table "admins" — le compte AdminHope et son mot de passe hashe ;
 *   * les categories de projet — ce sont des donnees de reference, pas des
 *     exemples ; elles alimentent le formulaire de creation de projet et
 *     restent modifiables depuis l'ecran Parametres.
 *
 * Les sequences sont remises a 1 : les references repartent de
 * PRJ-2026-0001, DON-2026-0001, INV-2026-0001.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { fermerPool, query } from '../config/database.js';
import { config } from '../config/env.js';
import { DOSSIER_JUSTIFICATIFS } from '../middleware/upload.middleware.js';
import * as catalogService from '../services/catalog.service.js';

const FORCER = process.argv.includes('--force');

/**
 * Tables videes, dans l'ordre des dependances.
 * "admins" et "project_categories" n'y figurent volontairement pas.
 */
const TABLES_METIER = [
  'notifications',
  'messages',
  'supporting_documents',
  'expenses',
  'investments',
  'impacts',
  'project_beneficiaries',
  'beneficiaries',
  'donations',
  'donor_accounts',
  'donors',
  'projects',
];

/** Compte les lignes de chaque table metier. */
async function inventaire() {
  const lignes = await Promise.all(
    TABLES_METIER.map(async (table) => {
      const resultat = await query(`SELECT COUNT(*)::int AS total FROM ${table}`);
      return { table, total: resultat.rows[0].total };
    })
  );
  return lignes;
}

/** Supprime les justificatifs televerses sur le disque. */
async function viderFichiers() {
  try {
    const fichiers = await fs.readdir(DOSSIER_JUSTIFICATIFS);
    const cibles = fichiers.filter((nom) => nom.startsWith('justificatif-'));
    await Promise.all(
      cibles.map((nom) => fs.unlink(path.join(DOSSIER_JUSTIFICATIFS, nom)))
    );
    return cibles.length;
  } catch (erreur) {
    if (erreur.code === 'ENOENT') return 0;
    throw erreur;
  }
}

async function executer() {
  console.log(`\n[HOPE] Base ciblee : ${config.database.user}@${config.database.host}/${config.database.name}\n`);

  const avant = await inventaire();
  const total = avant.reduce((somme, ligne) => somme + ligne.total, 0);

  console.log('DONNEES METIER PRESENTES');
  for (const { table, total: nombre } of avant) {
    console.log(`  ${String(nombre).padStart(5)}  ${table}`);
  }
  console.log(`  ${String(total).padStart(5)}  au total\n`);

  const admins = await query('SELECT COUNT(*)::int AS total FROM admins');
  const categories = await query('SELECT COUNT(*)::int AS total FROM project_categories');
  console.log('CONSERVE DANS TOUS LES CAS');
  console.log(`  ${String(admins.rows[0].total).padStart(5)}  admins (compte et mot de passe)`);
  console.log(`  ${String(categories.rows[0].total).padStart(5)}  project_categories (donnees de reference)\n`);

  if (!FORCER) {
    console.log('[HOPE] Aucune suppression effectuee.');
    console.log('[HOPE] Relancez avec : npm run db:reset -- --force\n');
    return;
  }

  // TRUNCATE ... RESTART IDENTITY remet aussi les sequences a 1, pour que
  // les references repartent de PRJ-2026-0001.
  await query(`TRUNCATE ${TABLES_METIER.join(', ')} RESTART IDENTITY CASCADE`);
  const fichiersSupprimes = await viderFichiers();

  // Les categories de reference sont recreees si elles avaient disparu.
  const installees = await catalogService.installerCategoriesParDefaut();

  const apres = await inventaire();
  const restant = apres.reduce((somme, ligne) => somme + ligne.total, 0);

  console.log('[HOPE] Donnees metier supprimees.');
  console.log(`       ${total} ligne(s) effacee(s), ${restant} restante(s).`);
  console.log(`       ${fichiersSupprimes} justificatif(s) retire(s) du disque.`);
  console.log(`       ${installees.length} categorie(s) de projet conservee(s).`);

  const adminsApres = await query('SELECT admin_log, LENGTH(password_hash) AS taille FROM admins');
  for (const ligne of adminsApres.rows) {
    console.log(`       Compte conserve : ${ligne.admin_log} (hash de ${ligne.taille} caracteres).`);
  }
  console.log('');
}

executer()
  .catch((erreur) => {
    console.error('[HOPE] Echec de la remise a zero :', erreur.message);
    process.exitCode = 1;
  })
  .finally(() => fermerPool());
