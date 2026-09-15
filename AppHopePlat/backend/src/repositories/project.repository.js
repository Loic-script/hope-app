/**
 * Repository des projets.
 *
 * Chaque projet remonte ses agregats financiers calcules en SQL :
 *
 *   investi = dons affectes a ce projet + investissements du fonds HOPE
 *   depense = utilisations enregistrees, hors depenses annulees
 *
 * Les calculer ici evite une cascade de requetes par projet cote service.
 */
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
  p.id, p.reference, p.category_id, p.name, p.description, p.location,
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

/**
 * @param {{ statut?: string, categorieId?: number, recherche?: string,
 *           inclureArchives?: boolean, limite?: number, decalage?: number }} filtres
 */
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
  if (filtres.recherche) {
    valeurs.push(`%${filtres.recherche}%`);
    conditions.push(`(name ILIKE $${valeurs.length} OR location ILIKE $${valeurs.length}
                      OR manager_name ILIKE $${valeurs.length} OR reference ILIKE $${valeurs.length})`);
  }

  const ou = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const resultat = await query(`SELECT COUNT(*)::int AS total FROM projects ${ou}`, valeurs, client);
  return resultat.rows[0].total;
}

/**
 * Les projets tels que l'espace benevole les montre.
 *
 * Une selection etroite, et voulue : ni budget, ni dons, ni depenses. Un
 * benevole vient voir ou il peut aider, pas ce que le projet coute --
 * et ces montants ne lui sont pas destines.
 *
 * Les deux comptes disent ce qu'il y a a prendre : des taches libres,
 * des missions ouvertes a venir. Un projet sans ni l'une ni l'autre
 * reste dans la liste, mais il le dit.
 */
export async function listerPourBenevole(client = null) {
  const resultat = await query(
    `SELECT p.id, p.reference, p.name, p.description, p.location,
            p.media_url, p.media_type, p.status, p.created_at,
            c.name AS category_name,
            COALESCE(t.libres, 0)      AS taches_libres,
            COALESCE(t.total, 0)       AS taches_total,
            COALESCE(m.ouvertes, 0)    AS missions_ouvertes
       FROM projects p
       LEFT JOIN project_categories c ON c.id = p.category_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*) FILTER (WHERE statut = 'a_faire' AND benevole_id IS NULL)::int AS libres,
                COUNT(*)::int AS total
           FROM tache WHERE projet_id = p.id
       ) t ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS ouvertes
           FROM mission
          WHERE projet_id = p.id AND statut = 'ouverte' AND date_debut >= NOW()
       ) m ON TRUE
      WHERE p.archived_at IS NULL
      ORDER BY
        -- Ce qui attend quelqu'un d'abord : un projet ou il y a a faire
        -- doit se voir avant celui qui n'a rien a proposer.
        (COALESCE(t.libres, 0) + COALESCE(m.ouvertes, 0)) DESC,
        p.created_at DESC`,
    [],
    client
  );
  return versListe(resultat.rows);
}

/** Un projet, pour l'espace benevole : les memes champs que la liste. */
export async function trouverPourBenevole(id, client = null) {
  const resultat = await query(
    `SELECT p.id, p.reference, p.name, p.description, p.location,
            p.media_url, p.media_type, p.status, p.created_at,
            c.name AS category_name,
            COALESCE(o.liste, '[]'::json) AS objectives
       FROM projects p
       LEFT JOIN project_categories c ON c.id = p.category_id
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object('id', o.id, 'label', o.label)
                ORDER BY o.position, o.id) AS liste
           FROM project_objectives o WHERE o.project_id = p.id
       ) o ON TRUE
      WHERE p.id = $1 AND p.archived_at IS NULL`,
    [id],
    client
  );
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

/**
 * Verrouille le projet et calcule ses totaux dans la meme transaction.
 * Indispensable avant tout controle de solde suivi d'une ecriture.
 */
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

/** Genere une reference lisible : PRJ-2026-0007. */
export async function genererReference(client = null) {
  const annee = new Date().getFullYear();
  const resultat = await query(
    'SELECT COUNT(*)::int AS total FROM projects WHERE reference LIKE $1',
    [`PRJ-${annee}-%`],
    client
  );
  return `PRJ-${annee}-${String(resultat.rows[0].total + 1).padStart(4, '0')}`;
}

export async function creer(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO projects
       (reference, category_id, name, description, location, manager_name,
        start_date, required_budget, currency, beneficiary_profile,
        beneficiary_target, status, media_url, media_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'IN_PROGRESS', $12, $13)
     RETURNING id`,
    [
      donnees.reference,
      donnees.categoryId,
      donnees.name,
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

/**
 * Reecrit le devis d'un projet.
 *
 * Meme principe que les objectifs : la liste arrive entiere du
 * formulaire, l'ordre en fait partie, et une poignee de postes ne
 * justifie pas de comparer les anciens aux nouveaux.
 *
 * @param {{ label: string, category: string|null, amount: string }[]} lignes
 *        montants deja normalises en texte NUMERIC par le service
 */
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

/**
 * Reecrit la liste des objectifs d'un projet.
 *
 * Effacer puis reinserer plutot que reconcilier ligne a ligne : la liste
 * arrive entiere du formulaire, l'ordre en fait partie, et une poignee
 * d'objectifs ne justifie pas de comparer les anciens aux nouveaux.
 */
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

/** Termine le projet : statut TERMINE, date de fin, resultat obtenu. */
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

/** Repasse un projet termine en cours (correction d'une cloture hative). */
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

/** Archive un projet deja termine : il sort des listes courantes. */
export async function archiver(id, client = null) {
  await query(
    "UPDATE projects SET status = 'ARCHIVED', archived_at = NOW() WHERE id = $1",
    [id],
    client
  );
  return trouverParId(id, client);
}

/**
 * Supprime un projet. N'aboutit que s'il ne porte aucune ecriture :
 * les cles etrangeres en RESTRICT protegent l'historique financier.
 */
export async function supprimer(id, client = null) {
  const resultat = await query('DELETE FROM projects WHERE id = $1 RETURNING id', [id], client);
  return resultat.rowCount > 0;
}

/** Compte les ecritures rattachees, pour expliquer un refus de suppression. */
export async function compterEcritures(id, client = null) {
  const resultat = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM donations   WHERE project_id = $1) AS dons,
       (SELECT COUNT(*)::int FROM investments WHERE project_id = $1) AS investissements,
       (SELECT COUNT(*)::int FROM expenses    WHERE project_id = $1) AS depenses`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Projets termines ou archives, pour l'ecran Impact. */
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
