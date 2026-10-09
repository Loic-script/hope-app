import { query } from '../config/database.js';
import { construireSet, versListe, versObjet } from '../shared/mapping.js';

const COLONNES = `
  i.id, i.project_id, i.objective_id, i.beneficiary_id, i.title, i.description,
  i.indicator, i.value, i.unit, i.measured_at, i.created_at, i.updated_at,
  p.name AS project_name,
  o.label AS objective_label,
  CASE WHEN b.id IS NULL THEN NULL
       ELSE TRIM(CONCAT_WS(' ', b.first_name, b.last_name)) END AS beneficiary_name
`;

const JOINTURES = `
  JOIN projects p ON p.id = i.project_id
  LEFT JOIN project_objectives o ON o.id = i.objective_id
  LEFT JOIN beneficiaries b ON b.id = i.beneficiary_id
`;

export async function lister(filtres = {}, client = null) {
  const conditions = [];
  const valeurs = [];

  if (filtres.projectId) {
    valeurs.push(filtres.projectId);
    conditions.push(`i.project_id = $${valeurs.length}`);
  }
  if (filtres.indicateur) {
    valeurs.push(filtres.indicateur);
    conditions.push(`i.indicator = $${valeurs.length}`);
  }
  if (filtres.recherche) {
    valeurs.push(`%${filtres.recherche}%`);
    conditions.push(`(i.title ILIKE $${valeurs.length}
                      OR i.indicator ILIKE $${valeurs.length}
                      OR p.name ILIKE $${valeurs.length})`);
  }

  const ou = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const resultat = await query(
    `SELECT ${COLONNES} FROM impacts i ${JOINTURES} ${ou}
      ORDER BY i.measured_at DESC, i.id DESC LIMIT 300`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

export async function listerPourBenevole(projectId, client = null) {
  const resultat = await query(
    `SELECT i.id, i.objective_id, i.title, i.description, i.indicator, i.value, i.unit,
            i.measured_at, o.label AS objective_label,
            (i.beneficiary_id IS NULL) AS collectif
       FROM impacts i
       LEFT JOIN project_objectives o ON o.id = i.objective_id
      WHERE i.project_id = $1
      ORDER BY i.measured_at DESC, i.id DESC`,
    [projectId],
    client
  );
  return versListe(resultat.rows);
}

export async function trouverParId(id, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES} FROM impacts i ${JOINTURES} WHERE i.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function creer(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO impacts (project_id, objective_id, beneficiary_id, title,
                          description, indicator, value, unit, measured_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_DATE))
     RETURNING id`,
    [
      donnees.projectId,
      donnees.objectiveId,
      donnees.beneficiaryId,
      donnees.title,
      donnees.description,
      donnees.indicator,
      donnees.value,
      donnees.unit,
      donnees.measuredAt,
    ],
    client
  );
  return trouverParId(resultat.rows[0].id, client);
}

export async function mettreAJour(id, colonnes, client = null) {
  const { clause, valeurs, vide } = construireSet(colonnes, 2);
  if (vide) return trouverParId(id, client);
  await query(`UPDATE impacts SET ${clause} WHERE id = $1`, [id, ...valeurs], client);
  return trouverParId(id, client);
}

export async function supprimer(id, client = null) {
  const resultat = await query('DELETE FROM impacts WHERE id = $1 RETURNING id', [id], client);
  return resultat.rowCount > 0;
}

export async function syntheseParProjet(projectId, client = null) {
  const resultat = await query(
    `SELECT indicator, unit,
            SUM(value)   AS total,
            COUNT(*)::int AS entries_count,
            MAX(measured_at) AS last_measured_at
       FROM impacts
      WHERE project_id = $1
      GROUP BY indicator, unit
      ORDER BY indicator`,
    [projectId],
    client
  );
  return versListe(resultat.rows);
}
