import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

const COLONNES = `
  n.id, n.type, n.label, n.donation_id, n.message_id, n.project_id,
  n.donor_id, n.utilisateur_id, n.tache_id, n.is_read, n.created_at,
  d.reference AS donation_reference,
  d.amount    AS donation_amount,
  d.currency  AS donation_currency,
  d.frequency AS donation_frequency,
  d.allocation,
  p.name      AS project_name,
  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', o.first_name, o.last_name)), ''),
           o.organization_name, 'Donateur anonyme') AS donor_name,
  -- La messagerie s'ouvre par compte donateur, pas par message : sans
  -- cette colonne, une notification de message ne saurait pas quelle
  -- conversation designer.
  m.donor_account_id,
  -- Le compte qui vient de s'ouvrir : de quoi le nommer et l'ouvrir.
  NULLIF(TRIM(CONCAT_WS(' ', u.prenom, u.nom)), '') AS compte_nom,
  u.email  AS compte_email,
  u.statut AS compte_statut,
  r.role   AS compte_role,
  -- La tache dont parle la notification : son intitule, et son projet.
  t.titre     AS tache_titre,
  t.projet_id AS tache_projet_id
`;

const JOINTURES = `
  LEFT JOIN donations d ON d.id = n.donation_id
  LEFT JOIN projects p  ON p.id = n.project_id
  LEFT JOIN donors o    ON o.id = n.donor_id
  LEFT JOIN messages m  ON m.id = n.message_id
  LEFT JOIN tache t ON t.id = n.tache_id
  LEFT JOIN utilisateur u ON u.id = n.utilisateur_id
  -- Un compte n'a qu'un role a l'inscription ; s'il en gagnait un
  -- second, le premier enregistre nomme toujours l'espace d'origine.
  LEFT JOIN LATERAL (
    SELECT role FROM utilisateur_role WHERE utilisateur_id = u.id ORDER BY role LIMIT 1
  ) r ON TRUE
`;

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

export async function creer(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO notifications
       (type, label, donation_id, message_id, project_id, donor_id, utilisateur_id, tache_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      donnees.type,
      donnees.label,
      donnees.donationId ?? null,
      donnees.messageId ?? null,
      donnees.projectId ?? null,
      donnees.donorId ?? null,
      donnees.utilisateurId ?? null,
      donnees.tacheId ?? null,
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
