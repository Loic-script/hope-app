/**
 * Les messages du formulaire de contact du site vitrine (contact_messages).
 *
 * Chaque message est garde tel quel : l'equipe le lit dans sa cloche et
 * par courriel, la table en est la trace durable.
 */
import { query } from '../config/database.js';
import { versObjet } from '../shared/mapping.js';

/**
 * @param {{ nom: string, email: string, telephone: string|null, sujet: string, message: string }} donnees
 */
export async function creer(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO contact_messages (nom, email, telephone, sujet, message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [donnees.nom, donnees.email, donnees.telephone, donnees.sujet, donnees.message],
    client
  );
  return versObjet(resultat.rows[0]);
}
