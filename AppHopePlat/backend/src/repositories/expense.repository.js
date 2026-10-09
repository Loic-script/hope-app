import { query } from '../config/database.js';
import { construireSet, versListe, versObjet } from '../shared/mapping.js';

const COLONNES = `
  e.id, e.project_id, e.amount, e.currency, e.description, e.category,
  e.supplier, e.expense_date, e.status, e.created_at, e.updated_at,
  p.name      AS project_name,
  p.reference AS project_reference,
  doc.nombre  AS documents_count,
  e.beneficiary_id,
  NULLIF(TRIM(CONCAT_WS(' ', bf.first_name, bf.last_name)), '') AS beneficiary_name
`;

const JOINTURES = `
  JOIN projects p ON p.id = e.project_id
  LEFT JOIN beneficiaries bf ON bf.id = e.beneficiary_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS nombre FROM supporting_documents WHERE expense_id = e.id
  ) doc ON TRUE
`;

export async function lister(filtres = {}, client = null) {
  const conditions = [];
  const valeurs = [];

  if (filtres.projectId) {
    valeurs.push(filtres.projectId);
    conditions.push(`e.project_id = $${valeurs.length}`);
  }
  if (filtres.statut) {
    valeurs.push(filtres.statut);
    conditions.push(`e.status = $${valeurs.length}`);
  }
  if (filtres.recherche) {
    valeurs.push(`%${filtres.recherche}%`);
    conditions.push(`(e.description ILIKE $${valeurs.length}
                      OR e.supplier ILIKE $${valeurs.length}
                      OR e.category ILIKE $${valeurs.length}
                      OR p.name ILIKE $${valeurs.length})`);
  }
  if (filtres.sansJustificatif) conditions.push('doc.nombre = 0');
  if (filtres.beneficiaryId) {
    valeurs.push(filtres.beneficiaryId);
    conditions.push(`e.beneficiary_id = $${valeurs.length}`);
  }

  const ou = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  valeurs.push(filtres.limite ?? 200);
  const limite = `LIMIT $${valeurs.length}`;
  valeurs.push(filtres.decalage ?? 0);
  const decalage = `OFFSET $${valeurs.length}`;

  const resultat = await query(
    `SELECT ${COLONNES} FROM expenses e ${JOINTURES} ${ou}
      ORDER BY e.expense_date DESC, e.id DESC ${limite} ${decalage}`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

export async function trouverParId(id, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES} FROM expenses e ${JOINTURES} WHERE e.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function trouverPourMiseAJour(id, client) {
  const resultat = await query('SELECT * FROM expenses WHERE id = $1 FOR UPDATE', [id], client);
  return versObjet(resultat.rows[0]);
}

export async function creer(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO expenses (project_id, amount, currency, description, category,
                           supplier, expense_date, status, beneficiary_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'RECORDED', $8)
     RETURNING id`,
    [
      donnees.projectId,
      donnees.amount,
      donnees.currency,
      donnees.description,
      donnees.category,
      donnees.supplier,
      donnees.expenseDate,
      donnees.beneficiaryId ?? null,
    ],
    client
  );
  return trouverParId(resultat.rows[0].id, client);
}

export async function mettreAJour(id, colonnes, client = null) {
  const { clause, valeurs, vide } = construireSet(colonnes, 2);
  if (vide) return trouverParId(id, client);
  await query(`UPDATE expenses SET ${clause} WHERE id = $1`, [id, ...valeurs], client);
  return trouverParId(id, client);
}

export async function totalParProjet(projectId, { saufDepenseId = null } = {}, client = null) {
  const resultat = await query(
    `SELECT COALESCE(SUM(amount), 0) AS montant
       FROM expenses
      WHERE project_id = $1 AND status <> 'CANCELLED'
        AND ($2::int IS NULL OR id <> $2)`,
    [projectId, saufDepenseId],
    client
  );
  return resultat.rows[0].montant;
}

export async function repartitionParCategorie(client = null) {
  const resultat = await query(
    `SELECT COALESCE(NULLIF(TRIM(category), ''), 'Non classé') AS category,
            COALESCE(SUM(amount), 0) AS montant,
            COUNT(*)::int            AS nombre
       FROM expenses
      WHERE status <> 'CANCELLED'
      GROUP BY 1
      ORDER BY montant DESC`,
    [],
    client
  );
  return versListe(resultat.rows);
}
