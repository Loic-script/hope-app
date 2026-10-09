import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

const COLONNES_DON = `
  d.id, d.reference, d.amount AS montant, d.currency AS devise,
  d.allocation AS affectation, d.project_id AS projet_id,
  p.name AS projet_nom,
  CASE WHEN p.media_type = 'PHOTO' THEN p.media_url END AS projet_image,
  d.frequency AS frequence, d.payment_method AS mode_paiement,
  d.status AS statut, d.received_at AS recu_le, d.created_at AS cree_le,
  d.message
`;

export async function ficheDuCompte(utilisateurId, client = null) {
  const resultat = await query('SELECT id FROM donors WHERE utilisateur_id = $1', [utilisateurId], client);
  return versObjet(resultat.rows[0]);
}

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

export async function mesDons(utilisateurId, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES_DON}
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

export async function ficheSansCompte(email, client = null) {
  const resultat = await query(
    `SELECT f.id
       FROM donors f
      WHERE lower(f.email) = lower($1)
        AND f.utilisateur_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM donor_accounts a WHERE a.donor_id = f.id)
      ORDER BY f.created_at DESC, f.id DESC
      LIMIT 1`,
    [email],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function donsDeLaFiche(donorId, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES_DON}
       FROM donations d
       JOIN donors f ON f.id = d.donor_id
       LEFT JOIN projects p ON p.id = d.project_id
      WHERE f.id = $1
      ORDER BY d.created_at DESC, d.id DESC`,
    [donorId],
    client
  );
  return versListe(resultat.rows);
}

export async function unDonDeLaFiche(donorId, donId, client = null) {
  if (!donorId) return undefined;
  const liste = await donsDeLaFiche(donorId, client);
  return liste.find((don) => Number(don.id) === Number(donId));
}

export async function unDeMesDons(utilisateurId, donId, client = null) {
  const liste = await mesDons(utilisateurId, client);
  return liste.find((don) => Number(don.id) === Number(donId));
}

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

export async function mettreAJourPhoto(utilisateurId, photoUrl, client = null) {
  await query('UPDATE utilisateur SET photo_url = $2 WHERE id = $1', [utilisateurId, photoUrl], client);
}
