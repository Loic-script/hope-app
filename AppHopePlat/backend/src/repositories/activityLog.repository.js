/**
 * Repository du journal d'activite.
 *
 * Le journal repond a "qui a fait quoi", la ou le fil de l'accueil,
 * reconstruit par lecture des tables metier, ne repond qu'a "que s'est-il
 * passe". Les deux coexistent : le fil couvre l'historique anterieur au
 * journal, le journal porte l'auteur.
 *
 * Une ligne ecrite n'est jamais modifiee ni supprimee : c'est une trace.
 */
import { query } from '../config/database.js';
import { versListe } from '../shared/mapping.js';

/**
 * Depose une entree.
 *
 * Le nom de l'auteur est recopie dans author_label plutot que d'etre lu
 * par jointure : si le compte est renomme ou supprime, le journal doit
 * continuer de dire qui a agi, avec le nom porte ce jour-la.
 *
 * @param {{ id: number, fullName?: string, adminLog?: string }|null} admin
 * @param {{ action: string, entityType: string, entityId?: number|null, label: string }} evenement
 */
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

/**
 * @param {{ adminId?: number, entityType?: string, limite?: number }} filtres
 */
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
