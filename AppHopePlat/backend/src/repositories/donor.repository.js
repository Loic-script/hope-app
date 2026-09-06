/**
 * Repository des donateurs et de leurs comptes.
 *
 * Deux populations, comme le demande l'ecran Donateurs :
 *   * le donateur SANS compte : il a donne ponctuellement, on ne connait
 *     de lui que son identite et la date de son don ;
 *   * le donateur AVEC compte (donateur regulier) : il dispose d'un espace
 *     personnel, on connait en plus son identifiant de compte.
 */
import { query } from '../config/database.js';
import { construireSet, versListe, versObjet } from '../shared/mapping.js';

const COLONNES = `
  o.id, o.first_name, o.last_name, o.organization_name, o.email, o.phone,
  o.country, o.city, o.origin, o.created_at, o.updated_at,
  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', o.first_name, o.last_name)), ''),
           o.organization_name, 'Donateur anonyme') AS display_name,
  a.id            AS account_id,
  a.email         AS account_email,
  a.status        AS account_status,
  a.last_login_at AS account_last_login_at,
  a.created_at    AS account_created_at,
  (a.id IS NOT NULL) AS has_account,
  don.nombre       AS donations_count,
  don.montant      AS donations_total,
  don.premier      AS first_donation_at,
  don.dernier      AS last_donation_at,
  don.mensuels     AS monthly_donations_count,
  don.projets      AS supported_projects_count
`;

const JOINTURES = `
  LEFT JOIN donor_accounts a ON a.donor_id = o.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int                          AS nombre,
           COALESCE(SUM(amount), 0)               AS montant,
           MIN(received_at)                       AS premier,
           MAX(received_at)                       AS dernier,
           COUNT(*) FILTER (WHERE frequency = 'MONTHLY')::int AS mensuels,
           COUNT(DISTINCT project_id)::int        AS projets
      FROM donations
     WHERE donor_id = o.id AND status = 'RECEIVED'
  ) don ON TRUE
`;

/**
 * @param {{ avecCompte?: boolean|null, origine?: string, recherche?: string }} filtres
 */
export async function lister(filtres = {}, client = null) {
  const conditions = [];
  const valeurs = [];

  if (filtres.avecCompte === true) conditions.push('a.id IS NOT NULL');
  if (filtres.avecCompte === false) conditions.push('a.id IS NULL');

  if (filtres.origine) {
    valeurs.push(filtres.origine);
    conditions.push(`o.origin = $${valeurs.length}`);
  }
  if (filtres.recherche) {
    valeurs.push(`%${filtres.recherche}%`);
    conditions.push(`(o.first_name ILIKE $${valeurs.length}
                      OR o.last_name ILIKE $${valeurs.length}
                      OR o.organization_name ILIKE $${valeurs.length}
                      OR o.email ILIKE $${valeurs.length}
                      OR o.city ILIKE $${valeurs.length})`);
  }

  const ou = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const resultat = await query(
    `SELECT ${COLONNES} FROM donors o ${JOINTURES} ${ou}
      ORDER BY don.dernier DESC NULLS LAST, o.id DESC LIMIT 300`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

export async function trouverParId(id, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES} FROM donors o ${JOINTURES} WHERE o.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function creer(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO donors (first_name, last_name, organization_name, email, phone,
                         country, city, origin)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      donnees.firstName,
      donnees.lastName,
      donnees.organizationName,
      donnees.email,
      donnees.phone,
      donnees.country,
      donnees.city,
      donnees.origin,
    ],
    client
  );
  return trouverParId(resultat.rows[0].id, client);
}

export async function mettreAJour(id, colonnes, client = null) {
  const { clause, valeurs, vide } = construireSet(colonnes, 2);
  if (vide) return trouverParId(id, client);
  await query(`UPDATE donors SET ${clause} WHERE id = $1`, [id, ...valeurs], client);
  return trouverParId(id, client);
}

/** Repartition affichee en tete de l'ecran Donateurs. */
export async function synthese(client = null) {
  const resultat = await query(
    `SELECT
       COUNT(*)::int                                              AS total,
       COUNT(*) FILTER (WHERE a.id IS NOT NULL)::int              AS avec_compte,
       COUNT(*) FILTER (WHERE a.id IS NULL)::int                  AS sans_compte,
       COUNT(*) FILTER (WHERE o.origin = 'INTERNATIONAL')::int    AS internationaux,
       COUNT(*) FILTER (WHERE o.origin = 'LOCAL')::int            AS locaux
     FROM donors o
     LEFT JOIN donor_accounts a ON a.donor_id = o.id`,
    [],
    client
  );
  return versObjet(resultat.rows[0]);
}

// ------------------------------------------------------------------
// Comptes donateurs
// ------------------------------------------------------------------

export async function trouverCompteParDonateur(donorId, client = null) {
  const resultat = await query(
    'SELECT id, donor_id, email, status, last_login_at, created_at FROM donor_accounts WHERE donor_id = $1',
    [donorId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/**
 * Cree le compte d'un donateur regulier.
 * Le mot de passe arrive deja hashe : le service en garde la responsabilite.
 */
export async function creerCompte({ donorId, email, passwordHash }, client = null) {
  const resultat = await query(
    `INSERT INTO donor_accounts (donor_id, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, donor_id, email, status, created_at`,
    [donorId, email, passwordHash],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function changerStatutCompte(id, statut, client = null) {
  const resultat = await query(
    `UPDATE donor_accounts SET status = $2 WHERE id = $1
     RETURNING id, donor_id, email, status, last_login_at, created_at`,
    [id, statut],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Comptes actifs, pour proposer un expediteur lors d'un message de test. */
export async function listerComptes(client = null) {
  const resultat = await query(
    `SELECT a.id, a.donor_id, a.email, a.status, a.last_login_at, a.created_at,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', o.first_name, o.last_name)), ''),
                     o.organization_name, 'Donateur') AS display_name
       FROM donor_accounts a
       JOIN donors o ON o.id = a.donor_id
      ORDER BY a.created_at DESC`,
    [],
    client
  );
  return versListe(resultat.rows);
}
