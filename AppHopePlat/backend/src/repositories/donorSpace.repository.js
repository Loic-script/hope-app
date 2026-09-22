/**
 * Acces aux donnees de l'espace donateur : sa fiche de don, ses dons, sa
 * photo, et les projets qu'il peut consulter.
 *
 * Un compte donateur (utilisateur) et ses dons ne se rejoignent que par
 * donors.utilisateur_id : la fiche de don rattachee au compte. Jamais par
 * l'adresse electronique -- voir schema.sql.
 */
import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

/** La fiche de don rattachee a ce compte, ou undefined. */
export async function ficheDuCompte(utilisateurId, client = null) {
  const resultat = await query('SELECT id FROM donors WHERE utilisateur_id = $1', [utilisateurId], client);
  return versObjet(resultat.rows[0]);
}

/** Cree la fiche de don d'un compte, rattachee a lui. */
export async function creerFicheDuCompte(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO donors (first_name, last_name, organization_name, email, phone,
                         country, city, origin, utilisateur_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      donnees.prenom,
      donnees.nom,
      donnees.organisation,
      donnees.email,
      donnees.telephone,
      donnees.pays,
      donnees.ville,
      donnees.origine,
      donnees.utilisateurId,
    ],
    client
  );
  return versObjet(resultat.rows[0]);
}

/**
 * Les dons du compte, du plus recent au plus ancien.
 *
 * La date d'un don est celle de sa reception quand il est recu, celle de
 * la promesse sinon.
 */
export async function mesDons(utilisateurId, client = null) {
  const resultat = await query(
    `SELECT d.id, d.reference, d.amount AS montant, d.currency AS devise,
            d.allocation AS affectation, d.project_id AS projet_id,
            p.name AS projet_nom,
            CASE WHEN p.media_type = 'PHOTO' THEN p.media_url END AS projet_image,
            d.frequency AS frequence, d.payment_method AS mode_paiement,
            d.status AS statut, d.received_at AS recu_le, d.created_at AS cree_le,
            d.message
       FROM donations d
       JOIN donors f ON f.id = d.donor_id
       LEFT JOIN projects p ON p.id = d.project_id
      WHERE f.utilisateur_id = $1
      ORDER BY d.created_at DESC, d.id DESC`,
    [utilisateurId],
    client
  );
  return versListe(resultat.rows);
}

/** Un don du compte, par son identifiant : undefined s'il n'est pas a lui. */
export async function unDeMesDons(utilisateurId, donId, client = null) {
  const liste = await mesDons(utilisateurId, client);
  return liste.find((don) => Number(don.id) === Number(donId));
}

/**
 * Le projet est-il lisible par ce donateur ?
 *
 * Les projets HOPE en cours ou termines -- ni archives, ni internes --, et
 * tout projet auquel il a donne, quel que soit son etat.
 */
export async function projetLisible(utilisateurId, projetId, client = null) {
  const resultat = await query(
    `SELECT p.id
       FROM projects p
      WHERE p.id = $1
        AND (
          (p.archived_at IS NULL AND p.project_type = 'HOPE'
             AND p.status IN ('IN_PROGRESS', 'COMPLETED'))
          OR EXISTS (
            SELECT 1 FROM donations d
              JOIN donors f ON f.id = d.donor_id
             WHERE d.project_id = p.id AND f.utilisateur_id = $2
          )
        )`,
    [projetId, utilisateurId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** La photo de profil du compte. */
export async function mettreAJourPhoto(utilisateurId, photoUrl, client = null) {
  await query('UPDATE utilisateur SET photo_url = $2 WHERE id = $1', [utilisateurId, photoUrl], client);
}
