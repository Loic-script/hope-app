import fs from 'node:fs/promises';

import { fermerPool, pool, query } from '../config/database.js';
import { fichiersDesDocuments, installerDocumentsDemo } from './documentsBailleurDemo.js';

const FONDATION = 'Fondation Avenir Océan Indien';
const TELMA = 'Telma Entreprise Citoyenne';

async function exiger(sql, valeurs, description) {
  const resultat = await query(sql, valeurs);
  if (resultat.rowCount === 0) {
    throw new Error(
      `${description} introuvable. Installez d abord : npm run db:seed-funders -- --force`
    );
  }
  return resultat.rows[0].id;
}

async function executer() {
  const bailleur = (nom) =>
    exiger('SELECT id FROM bailleur WHERE raison_sociale = $1', [nom], `Le bailleur « ${nom} »`);
  const engagement = (reference) =>
    exiger(
      'SELECT id FROM engagement WHERE reference_convention = $1',
      [reference],
      `L engagement ${reference}`
    );

  const fondationId = await bailleur(FONDATION);
  const telmaId = await bailleur(TELMA);

  const contexte = {
    fondation: {
      id: fondationId,
      education: await engagement('CONV-AOI-2026-01'),
      sante: await engagement('CONV-AOI-2026-02'),
      formation: await engagement('CONV-AOI-2026-03'),
    },
    telma: {
      id: telmaId,
      eau: await engagement('RSE-TLM-2025-14'),
      materiel: await engagement('RSE-TLM-2026-03'),
    },
    adminId: (await query('SELECT id FROM admins ORDER BY id LIMIT 1')).rows[0]?.id ?? null,
  };

  const projets = new Map(
    (await query('SELECT id, name FROM projects')).rows.map((p) => [p.name, p.id])
  );
  contexte.projet = (nom) => {
    const id = projets.get(nom);
    if (id === undefined) throw new Error(`Projet introuvable : « ${nom} »`);
    return id;
  };

  const anciens = await fichiersDesDocuments(query, [fondationId, telmaId]);
  const ecrits = [];

  const client = await pool.connect();
  let nombre = 0;
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM document_bailleur WHERE bailleur_id = ANY($1::UUID[])', [
      [fondationId, telmaId],
    ]);
    nombre = await installerDocumentsDemo(
      (sql, valeurs) => client.query(sql, valeurs),
      contexte,
      ecrits
    );
    await client.query('COMMIT');
  } catch (erreur) {
    await client.query('ROLLBACK');
    await Promise.all(ecrits.map((chemin) => fs.rm(chemin, { force: true })));
    throw erreur;
  } finally {
    client.release();
  }

  await Promise.all(anciens.map((chemin) => fs.rm(chemin, { force: true })));

  const resume = await query(
    `SELECT b.raison_sociale, COUNT(*)::int AS n, SUM(d.nb_pages)::int AS pages
       FROM document_bailleur d JOIN bailleur b ON b.id = d.bailleur_id
      WHERE d.bailleur_id = ANY($1::UUID[])
      GROUP BY b.raison_sociale ORDER BY b.raison_sociale`,
    [[fondationId, telmaId]]
  );

  console.log(`[HOPE] Rapports bailleur : ${nombre} documents installes, avec leur PDF.`);
  for (const ligne of resume.rows) {
    console.log(`       ${ligne.raison_sociale} : ${ligne.n} documents, ${ligne.pages} pages`);
  }
  console.log(`       ${anciens.length} ancien(s) fichier(s) retire(s).`);
}

executer()
  .catch((erreur) => {
    console.error('[HOPE] Echec des rapports bailleur :', erreur.message);
    process.exitCode = 1;
  })
  .finally(() => fermerPool());
