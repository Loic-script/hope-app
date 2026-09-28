/**
 * Repository des investissements du fonds HOPE.
 *
 * Un investissement, c'est l'action "Investir" de l'ecran Budget :
 * l'administrateur prend sur les dons non affectes et les engage sur un
 * projet precis, en justifiant sa decision.
 */
import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

const COLONNES = `
  i.id, i.reference, i.project_id, i.amount, i.currency, i.justification,
  i.invested_at, i.created_at, i.updated_at,
  p.name      AS project_name,
  p.reference AS project_reference,
  p.status    AS project_status,
  c.name      AS category_name
`;

const JOINTURES = `
  JOIN projects p ON p.id = i.project_id
  LEFT JOIN project_categories c ON c.id = p.category_id
`;

/** @param {{ projectId?: number, recherche?: string, limite?: number }} filtres */
export async function lister(filtres = {}, client = null) {
  const conditions = [];
  const valeurs = [];

  if (filtres.projectId) {
    valeurs.push(filtres.projectId);
    conditions.push(`i.project_id = $${valeurs.length}`);
  }
  if (filtres.recherche) {
    valeurs.push(`%${filtres.recherche}%`);
    conditions.push(`(i.reference ILIKE $${valeurs.length}
                      OR i.justification ILIKE $${valeurs.length}
                      OR p.name ILIKE $${valeurs.length})`);
  }

  const ou = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  valeurs.push(filtres.limite ?? 200);

  const resultat = await query(
    `SELECT ${COLONNES} FROM investments i ${JOINTURES} ${ou}
      ORDER BY i.invested_at DESC, i.id DESC LIMIT $${valeurs.length}`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

export async function listerParProjet(projectId, client = null) {
  return lister({ projectId }, client);
}

export async function trouverParId(id, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES} FROM investments i ${JOINTURES} WHERE i.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function creer(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO investments (reference, project_id, amount, currency,
                              justification, invested_at)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE))
     RETURNING id`,
    [
      donnees.reference,
      donnees.projectId,
      donnees.amount,
      donnees.currency,
      donnees.justification,
      donnees.investedAt,
    ],
    client
  );
  return trouverParId(resultat.rows[0].id, client);
}

/** Genere une reference lisible : INV-2026-0007. */
export async function genererReference(client = null) {
  const annee = new Date().getFullYear();
  // Le plus grand numero + 1 : apres une suppression, le compte + 1
  // retomberait sur une reference deja prise (voir donation.repository).
  if (client) await query("SELECT pg_advisory_xact_lock(hashtext('investments.reference'))", [], client);
  const resultat = await query(
    `SELECT COALESCE(MAX(SUBSTRING(reference FROM '[0-9]+$')::int), 0) AS dernier
       FROM investments WHERE reference LIKE $1`,
    [`INV-${annee}-%`],
    client
  );
  return `INV-${annee}-${String(resultat.rows[0].dernier + 1).padStart(4, '0')}`;
}

export async function totalParProjet(projectId, client = null) {
  const resultat = await query(
    'SELECT COALESCE(SUM(amount), 0) AS montant FROM investments WHERE project_id = $1',
    [projectId],
    client
  );
  return resultat.rows[0].montant;
}
