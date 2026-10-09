import { query } from '../config/database.js';
import { versListe } from '../shared/mapping.js';

export async function deposer(admin, evenement, client = null) {
  await query(
    `INSERT INTO activity_log (admin_id, author_label, action, entity_type, entity_id, label)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      admin?.id ?? null,
      admin?.fullName ?? admin?.adminLog ?? 'Système',
      evenement.action,
      evenement.entityType,
      evenement.entityId ?? null,
      evenement.label,
    ],
    client
  );
}

export async function lister(filtres = {}, client = null) {
  const conditions = [];
  const valeurs = [];

  if (filtres.adminId) {
    valeurs.push(filtres.adminId);
    conditions.push(`admin_id = $${valeurs.length}`);
  }
  if (filtres.entityType) {
    valeurs.push(filtres.entityType);
    conditions.push(`entity_type = $${valeurs.length}`);
  }

  const ou = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  valeurs.push(filtres.limite ?? 50);

  const resultat = await query(
    `SELECT id, admin_id, author_label, action, entity_type, entity_id, label, created_at
       FROM activity_log ${ou}
      ORDER BY created_at DESC, id DESC
      LIMIT $${valeurs.length}`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}
