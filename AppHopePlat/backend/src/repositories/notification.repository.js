/**
 * Repository des notifications de l'administrateur.
 *
 * Chaque evenement marquant depose une ligne ici : un don recu, un message
 * d'un donateur, un projet termine, un investissement du fonds HOPE.
 */
import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

const COLONNES = `
  n.id, n.type, n.label, n.donation_id, n.message_id, n.project_id,
  n.donor_id, n.is_read, n.created_at,
  d.reference AS donation_reference,
  d.amount    AS donation_amount,
  d.currency  AS donation_currency,
  d.frequency AS donation_frequency,
  d.allocation,
  p.name      AS project_name,
  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', o.first_name, o.last_name)), ''),
           o.organization_name, 'Donateur anonyme') AS donor_name
`;

const JOINTURES = `
  LEFT JOIN donations d ON d.id = n.donation_id
  LEFT JOIN projects p  ON p.id = n.project_id
  LEFT JOIN donors o    ON o.id = n.donor_id
`;

/** @param {{ type?: string, nonLues?: boolean, limite?: number }} filtres */
export async function lister(filtres = {}, client = null) {
  const conditions = [];
  const valeurs = [];

  if (filtres.type) {
    valeurs.push(filtres.type);
    conditions.push(`n.type = $${valeurs.length}`);
  }
  if (filtres.nonLues) conditions.push('n.is_read = FALSE');

  const ou = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  valeurs.push(filtres.limite ?? 100);

  const resultat = await query(
    `SELECT ${COLONNES} FROM notifications n ${JOINTURES} ${ou}
      ORDER BY n.created_at DESC, n.id DESC LIMIT $${valeurs.length}`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

/**
 * Depose une notification.
 * Appele par les services au moment ou l'evenement se produit.
 */
export async function creer(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO notifications (type, label, donation_id, message_id, project_id, donor_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      donnees.type,
      donnees.label,
      donnees.donationId ?? null,
      donnees.messageId ?? null,
      donnees.projectId ?? null,
      donnees.donorId ?? null,
    ],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function marquerLue(id, client = null) {
  const resultat = await query(
    'UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *',
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function toutMarquerLu(client = null) {
  const resultat = await query(
    'UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE RETURNING id',
    [],
    client
  );
  return resultat.rowCount;
}

export async function compterNonLues(client = null) {
  const resultat = await query(
    'SELECT COUNT(*)::int AS total FROM notifications WHERE is_read = FALSE',
    [],
    client
  );
  return resultat.rows[0].total;
}
