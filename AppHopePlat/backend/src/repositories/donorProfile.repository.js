/**
 * Acces aux donnees de la fiche donateur.
 *
 * Deux tables pour une personne : "utilisateur" porte l'identite (nom,
 * prenom, adresse, telephone), "donateur" le reste. Les lectures les
 * reunissent ; les ecritures touchent les deux dans une transaction.
 */
import { query } from '../config/database.js';
import { versObjet } from '../shared/mapping.js';

/** La fiche d'un compte, creee vide si elle n'existe pas encore. */
export async function garantir(utilisateurId, client = null) {
  await query(
    `INSERT INTO donateur (utilisateur_id) VALUES ($1)
     ON CONFLICT (utilisateur_id) DO NOTHING`,
    [utilisateurId],
    client
  );
}

/** L'identite et la fiche, reunies. */
export async function trouver(utilisateurId, client = null) {
  const resultat = await query(
    `SELECT u.nom, u.prenom, u.adresse, u.telephone, u.email,
            d.ville, d.pays, d.profession, d.source_connaissance,
            d.etape_suivante
       FROM utilisateur u
       JOIN donateur d ON d.utilisateur_id = u.id
      WHERE u.id = $1`,
    [utilisateurId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/**
 * L'etape 1 : informations personnelles.
 *
 * L'etape suivante ne recule jamais : revenir corriger son nom ne doit
 * pas faire repasser par les etapes deja franchies.
 */
export async function enregistrerEtape1(utilisateurId, donnees, client = null) {
  await query(
    `UPDATE utilisateur
        SET nom = $2, prenom = $3, adresse = $4, telephone = $5
      WHERE id = $1`,
    [utilisateurId, donnees.nom, donnees.prenom, donnees.adresse, donnees.telephone],
    client
  );
  await query(
    `UPDATE donateur
        SET ville = $2, pays = $3, profession = $4, source_connaissance = $5,
            etape_suivante = GREATEST(etape_suivante, 2),
            mis_a_jour_le = NOW()
      WHERE utilisateur_id = $1`,
    [utilisateurId, donnees.ville, donnees.pays, donnees.profession, donnees.source],
    client
  );
}
