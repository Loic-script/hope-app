import { query } from '../config/database.js';
import { construireSet, versListe, versObjet } from '../shared/mapping.js';

const AGREGATS = `
  LEFT JOIN project_categories c ON c.id = p.category_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(amount), 0) AS montant, COUNT(*)::int AS nombre
      FROM donations
     WHERE project_id = p.id AND status = 'RECEIVED'
  ) don ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(amount), 0) AS montant, COUNT(*)::int AS nombre
      FROM investments WHERE project_id = p.id
  ) inv ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(amount), 0) AS montant, COUNT(*)::int AS nombre
      FROM expenses WHERE project_id = p.id AND status <> 'CANCELLED'
  ) dep ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS nombre
      FROM project_beneficiaries WHERE project_id = p.id
  ) ben ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT d.donor_id)::int AS nombre,
           STRING_AGG(DISTINCT COALESCE(
             NULLIF(TRIM(CONCAT_WS(' ', o.first_name, o.last_name)), ''),
             o.organization_name, 'Donateur anonyme'), ', ') AS noms
      FROM donations d
      JOIN donors o ON o.id = d.donor_id
     WHERE d.project_id = p.id AND d.status = 'RECEIVED'
  ) donateur ON TRUE
  LEFT JOIN LATERAL (
    SELECT MAX(created_at) AS derniere
      FROM field_proofs WHERE project_id = p.id
  ) preuve ON TRUE
  LEFT JOIN LATERAL (
    SELECT json_agg(
             json_build_object('id', o.id, 'label', o.label, 'position', o.position)
             ORDER BY o.position, o.id
           ) AS liste
      FROM project_objectives o
     WHERE o.project_id = p.id
  ) objectifs ON TRUE
  LEFT JOIN LATERAL (
    SELECT json_agg(
             json_build_object(
               'id', q.id, 'label', q.label, 'category', q.category,
               'amount', q.amount, 'position', q.position
             ) ORDER BY q.position, q.id
           ) AS liste
      FROM project_quote_items q
     WHERE q.project_id = p.id
  ) devis ON TRUE
  /*
   * Ce qui a reellement ete depense, categorie par categorie.
   *
   * Agrege a part du devis, et non greffe sur chaque poste : une depense
   * faite dans une categorie que le budget n'avait pas prevue doit
   * apparaitre elle aussi. Greffee sur les postes, elle serait restee
   * invisible, et la colonne des reels n'aurait pas totalise le compte
   * du projet.
   *
   * Meme filtre que le total du projet : une depense annulee n'a pas eu
   * lieu.
   */
  LEFT JOIN LATERAL (
    SELECT json_agg(
             json_build_object('category', d.category, 'amount', d.total)
             ORDER BY d.category
           ) AS liste
      FROM (
        SELECT e.category, SUM(e.amount) AS total
          FROM expenses e
         WHERE e.project_id = p.id AND e.status <> 'CANCELLED'
         GROUP BY e.category
      ) d
  ) depenses ON TRUE
`;

const COLONNES = `
  p.id, p.reference, p.category_id, p.name, p.project_type,
  p.description_titre, p.description, p.location,
  p.manager_name, p.start_date, p.required_budget, p.currency,
  p.beneficiary_profile, p.beneficiary_target, p.status, p.media_url,
  p.media_type, p.outcome, p.completed_at, p.archived_at,
  p.created_at, p.updated_at,
  c.name          AS category_name,
  don.montant     AS designated_total,
  don.nombre      AS donations_count,
  inv.montant     AS invested_hope_total,
  inv.nombre      AS investments_count,
  (don.montant + inv.montant) AS funded_total,
  dep.montant     AS spent_total,
  dep.nombre      AS expenses_count,
  ben.nombre      AS beneficiaries_count,
  donateur.nombre AS donors_count,
  donateur.noms   AS donor_names,
  preuve.derniere AS last_proof_at,
  -- Depuis combien de jours ce projet est-il muet ? On repart de sa date
  -- de creation quand il n'a jamais eu de preuve : reprocher un silence
  -- a un projet cree hier n'aurait pas de sens.
  FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(preuve.derniere, p.created_at))) / 86400)::int
    AS days_since_proof,
  -- Les objectifs specifiques et le devis, agreges plutot que joints :
  -- une seconde requete par projet ferait vingt allers-retours sur la
  -- liste.
  COALESCE(objectifs.liste, '[]'::json) AS objectives,
  COALESCE(devis.liste, '[]'::json)     AS quote_items,
  COALESCE(depenses.liste, '[]'::json)  AS spend_by_category
`;

export async function lister(filtres = {}, client = null) {
  const conditions = [];
  const valeurs = [];

  if (filtres.statut) {
    valeurs.push(filtres.statut);
    conditions.push(`p.status = $${valeurs.length}`);
  } else if (!filtres.inclureArchives) {
    conditions.push(`p.status <> 'ARCHIVED'`);
  }
  if (filtres.categorieId) {
    valeurs.push(filtres.categorieId);
    conditions.push(`p.category_id = $${valeurs.length}`);
  }
  if (filtres.type) {
    valeurs.push(filtres.type);
    conditions.push(`p.project_type = $${valeurs.length}`);
  }
  if (filtres.recherche) {
    valeurs.push(`%${filtres.recherche}%`);
    conditions.push(`(p.name ILIKE $${valeurs.length} OR p.location ILIKE $${valeurs.length}
                      OR p.manager_name ILIKE $${valeurs.length}
                      OR p.reference ILIKE $${valeurs.length})`);
  }

  const ou = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  valeurs.push(filtres.limite ?? 100);
  const limite = `LIMIT $${valeurs.length}`;
  valeurs.push(filtres.decalage ?? 0);
  const decalage = `OFFSET $${valeurs.length}`;

  const resultat = await query(
    `SELECT ${COLONNES} FROM projects p ${AGREGATS} ${ou}
      ORDER BY p.created_at DESC, p.id DESC ${limite} ${decalage}`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

export async function compter(filtres = {}, client = null) {
  const conditions = [];
  const valeurs = [];

  if (filtres.statut) {
    valeurs.push(filtres.statut);
    conditions.push(`status = $${valeurs.length}`);
  } else if (!filtres.inclureArchives) {
    conditions.push(`status <> 'ARCHIVED'`);
  }
  if (filtres.categorieId) {
    valeurs.push(filtres.categorieId);
    conditions.push(`category_id = $${valeurs.length}`);
  }
  if (filtres.type) {
    valeurs.push(filtres.type);
    conditions.push(`project_type = $${valeurs.length}`);
  }
  if (filtres.recherche) {
    valeurs.push(`%${filtres.recherche}%`);
    conditions.push(`(name ILIKE $${valeurs.length} OR location ILIKE $${valeurs.length}
                      OR manager_name ILIKE $${valeurs.length} OR reference ILIKE $${valeurs.length})`);
  }

  const ou = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const resultat = await query(`SELECT COUNT(*)::int AS total FROM projects ${ou}`, valeurs, client);
  return resultat.rows[0].total;
}

export async function listerPourBenevole(client = null) {
  const resultat = await query(
    `SELECT p.id, p.reference, p.name, p.description_titre, p.description, p.location,
            p.media_url, p.media_type, p.status, p.created_at,
            c.name AS category_name,
            COALESCE(t.libres, 0)      AS taches_libres,
            COALESCE(t.total, 0)       AS taches_total
       FROM projects p
       LEFT JOIN project_categories c ON c.id = p.category_id
       LEFT JOIN LATERAL (
         -- Libre : personne encore dans l'equipe.
         SELECT COUNT(*) FILTER (WHERE statut = 'a_faire')::int AS libres,
                COUNT(*)::int AS total
           FROM tache WHERE projet_id = p.id
       ) t ON TRUE
      WHERE p.archived_at IS NULL
      ORDER BY
        -- Ce qui attend quelqu'un d'abord : un projet ou il y a a faire
        -- doit se voir avant celui qui n'a rien a proposer.
        COALESCE(t.libres, 0) DESC,
        p.created_at DESC`,
    [],
    client
  );
  return versListe(resultat.rows);
}

const FICHE_HORS_ADMIN = `
  SELECT p.id, p.reference, p.name, p.description_titre, p.description, p.location,
         p.media_url, p.media_type, p.status, p.created_at,
         p.manager_name, p.start_date::text AS start_date, p.completed_at,
         p.beneficiary_profile, p.beneficiary_target, p.outcome,
         c.name AS category_name,
         COALESCE(ben.nombre, 0) AS beneficiaries_count,
         COALESCE(o.liste, '[]'::json) AS objectives
    FROM projects p
    LEFT JOIN project_categories c ON c.id = p.category_id
    LEFT JOIN LATERAL (
      SELECT json_agg(json_build_object('id', o.id, 'label', o.label)
             ORDER BY o.position, o.id) AS liste
        FROM project_objectives o WHERE o.project_id = p.id
    ) o ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS nombre
        FROM project_beneficiaries WHERE project_id = p.id
    ) ben ON TRUE
`;

export async function trouverPourBenevole(id, client = null) {
  const resultat = await query(
    `${FICHE_HORS_ADMIN} WHERE p.id = $1 AND p.archived_at IS NULL`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function trouverPourBailleur(id, client = null) {
  const resultat = await query(`${FICHE_HORS_ADMIN} WHERE p.id = $1`, [id], client);
  return versObjet(resultat.rows[0]);
}

export async function trouverParId(id, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES} FROM projects p ${AGREGATS} WHERE p.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function trouverPourMiseAJour(id, client) {
  const projet = await query('SELECT * FROM projects WHERE id = $1 FOR UPDATE', [id], client);
  if (!projet.rows[0]) return null;

  const totaux = await query(
    `SELECT
       (SELECT COALESCE(SUM(amount), 0) FROM donations
         WHERE project_id = $1 AND status = 'RECEIVED')   AS designated_total,
       (SELECT COALESCE(SUM(amount), 0) FROM investments
         WHERE project_id = $1)                           AS invested_hope_total,
       (SELECT COALESCE(SUM(amount), 0) FROM expenses
         WHERE project_id = $1 AND status <> 'CANCELLED') AS spent_total`,
    [id],
    client
  );

  return versObjet({ ...projet.rows[0], ...totaux.rows[0] });
}

export async function genererReference(client = null) {
  const annee = new Date().getFullYear();
  if (client) await query("SELECT pg_advisory_xact_lock(hashtext('projects.reference'))", [], client);
  const resultat = await query(
    `SELECT COALESCE(MAX(SUBSTRING(reference FROM '[0-9]+$')::int), 0) AS dernier
       FROM projects WHERE reference LIKE $1`,
    [`PRJ-${annee}-%`],
    client
  );
  return `PRJ-${annee}-${String(resultat.rows[0].dernier + 1).padStart(4, '0')}`;
}

export async function creer(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO projects
       (reference, category_id, name, project_type, description_titre, description,
        location, manager_name, start_date, required_budget, currency,
        beneficiary_profile, beneficiary_target, status, media_url, media_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'IN_PROGRESS', $14, $15)
     RETURNING id`,
    [
      donnees.reference,
      donnees.categoryId,
      donnees.name,
      donnees.projectType,
      donnees.descriptionTitre,
      donnees.description,
      donnees.location,
      donnees.managerName,
      donnees.startDate,
      donnees.requiredBudget,
      donnees.currency,
      donnees.beneficiaryProfile,
      donnees.beneficiaryTarget,
      donnees.mediaUrl,
      donnees.mediaType,
    ],
    client
  );
  const projetId = resultat.rows[0].id;
  await remplacerObjectifs(projetId, donnees.objectives ?? [], client);
  await remplacerDevis(projetId, donnees.quoteItems ?? [], client);
  return trouverParId(projetId, client);
}

export async function remplacerDevis(projetId, lignes, client = null) {
  await query('DELETE FROM project_quote_items WHERE project_id = $1', [projetId], client);

  for (const [rang, ligne] of lignes.entries()) {
    await query(
      `INSERT INTO project_quote_items (project_id, label, category, amount, position)
       VALUES ($1, $2, $3, $4, $5)`,
      [projetId, ligne.label, ligne.category ?? null, ligne.amount, rang],
      client
    );
  }
}

export async function remplacerObjectifs(projetId, objectifs, client = null) {
  await query('DELETE FROM project_objectives WHERE project_id = $1', [projetId], client);

  for (const [rang, libelle] of objectifs.entries()) {
    await query(
      'INSERT INTO project_objectives (project_id, label, position) VALUES ($1, $2, $3)',
      [projetId, libelle, rang],
      client
    );
  }
}

export async function mettreAJour(id, colonnes, client = null) {
  const { clause, valeurs, vide } = construireSet(colonnes, 2);
  if (vide) return trouverParId(id, client);

  await query(`UPDATE projects SET ${clause} WHERE id = $1`, [id, ...valeurs], client);
  return trouverParId(id, client);
}

export async function terminer(id, resultatObtenu, client = null) {
  await query(
    `UPDATE projects
        SET status = 'COMPLETED', completed_at = NOW(), outcome = $2
      WHERE id = $1`,
    [id, resultatObtenu],
    client
  );
  return trouverParId(id, client);
}

export async function rouvrir(id, client = null) {
  await query(
    `UPDATE projects
        SET status = 'IN_PROGRESS', completed_at = NULL, archived_at = NULL
      WHERE id = $1`,
    [id],
    client
  );
  return trouverParId(id, client);
}

export async function archiver(id, client = null) {
  await query(
    "UPDATE projects SET status = 'ARCHIVED', archived_at = NOW() WHERE id = $1",
    [id],
    client
  );
  return trouverParId(id, client);
}

export async function supprimer(id, client = null) {
  const resultat = await query('DELETE FROM projects WHERE id = $1 RETURNING id', [id], client);
  return resultat.rowCount > 0;
}

export async function detacherEcritures(id, client) {
  const dons = await query(
    `UPDATE donations SET project_id = NULL, allocation = 'HOPE'
      WHERE project_id = $1
      RETURNING id`,
    [id],
    client
  );
  const investissements = await query(
    'DELETE FROM investments WHERE project_id = $1 RETURNING id',
    [id],
    client
  );
  const depenses = await query(
    'DELETE FROM expenses WHERE project_id = $1 RETURNING id',
    [id],
    client
  );
  const affectations = await query(
    'DELETE FROM affectation WHERE projet_id = $1 RETURNING id',
    [id],
    client
  );
  const missions = await query(
    'DELETE FROM mission WHERE projet_id = $1 RETURNING id',
    [id],
    client
  );

  return {
    donsDetaches: dons.rowCount,
    investissements: investissements.rowCount,
    depenses: depenses.rowCount,
    affectations: affectations.rowCount,
    missions: missions.rowCount,
  };
}

export async function compterEcritures(id, client = null) {
  const resultat = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM donations   WHERE project_id = $1) AS dons,
       (SELECT COUNT(*)::int FROM investments WHERE project_id = $1) AS investissements,
       (SELECT COUNT(*)::int FROM expenses    WHERE project_id = $1) AS depenses,
       (SELECT COUNT(*)::int FROM affectation WHERE projet_id = $1) AS affectations,
       (SELECT COUNT(*)::int FROM mission     WHERE projet_id = $1) AS missions`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function listerTermines(client = null) {
  const resultat = await query(
    `SELECT ${COLONNES}, impact.nombre AS impacts_count
       FROM projects p
       ${AGREGATS}
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS nombre FROM impacts WHERE project_id = p.id
       ) impact ON TRUE
      WHERE p.status IN ('COMPLETED', 'ARCHIVED')
      ORDER BY p.completed_at DESC NULLS LAST, p.id DESC`,
    [],
    client
  );
  return versListe(resultat.rows);
}
