import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

const COLONNES = `
  m.id, m.donor_account_id, m.subject, m.body, m.status, m.reply,
  m.replied_at, m.created_at, m.updated_at,
  a.email    AS account_email,
  o.id       AS donor_id,
  o.country  AS donor_country,
  o.origin   AS donor_origin,
  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', o.first_name, o.last_name)), ''),
           o.organization_name, 'Donateur') AS donor_name,
  don.nombre AS donor_donations_count
`;

const JOINTURES = `
  JOIN donor_accounts a ON a.id = m.donor_account_id
  JOIN donors o         ON o.id = a.donor_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS nombre
      FROM donations WHERE donor_id = o.id AND status = 'RECEIVED'
  ) don ON TRUE
`;

export async function lister(filtres = {}, client = null) {
  const conditions = [];
  const valeurs = [];

  if (filtres.statut) {
    valeurs.push(filtres.statut);
    conditions.push(`m.status = $${valeurs.length}`);
  }
  if (filtres.recherche) {
    valeurs.push(`%${filtres.recherche}%`);
    conditions.push(`(m.subject ILIKE $${valeurs.length}
                      OR m.body ILIKE $${valeurs.length}
                      OR o.first_name ILIKE $${valeurs.length}
                      OR o.last_name ILIKE $${valeurs.length}
                      OR o.organization_name ILIKE $${valeurs.length})`);
  }

  const ou = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const resultat = await query(
    `SELECT ${COLONNES} FROM messages m ${JOINTURES} ${ou}
      ORDER BY m.created_at DESC, m.id DESC LIMIT 200`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

export async function trouverParId(id, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES} FROM messages m ${JOINTURES} WHERE m.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function creer({ donorAccountId, subject, body }, client = null) {
  const resultat = await query(
    `INSERT INTO messages (donor_account_id, subject, body)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [donorAccountId, subject, body],
    client
  );
  return trouverParId(resultat.rows[0].id, client);
}

export async function marquerLu(id, client = null) {
  await query(
    "UPDATE messages SET status = 'READ' WHERE id = $1 AND status = 'NEW'",
    [id],
    client
  );
  return trouverParId(id, client);
}

export async function repondre(id, reponse, client = null) {
  await query(
    `UPDATE messages
        SET reply = $2, replied_at = NOW(), status = 'ANSWERED'
      WHERE id = $1`,
    [id, reponse],
    client
  );
  return trouverParId(id, client);
}

export async function compterNonLus(client = null) {
  const resultat = await query(
    "SELECT COUNT(*)::int AS total FROM messages WHERE status = 'NEW'",
    [],
    client
  );
  return resultat.rows[0].total;
}
