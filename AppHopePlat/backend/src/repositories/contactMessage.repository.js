import { query } from '../config/database.js';
import { versObjet } from '../shared/mapping.js';

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
