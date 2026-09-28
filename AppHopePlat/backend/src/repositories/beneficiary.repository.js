/**
 * Repository des beneficiaires et de leur rattachement aux projets.
 *
 * Rappel confidentialite : ces donnees personnelles ne sortent jamais de
 * l'espace administrateur (routes protegees par authenticateAdmin).
 */
import { query } from '../config/database.js';
import { construireSet, versListe, versObjet } from '../shared/mapping.js';

const COLONNES = `
  b.id, b.first_name, b.last_name, b.beneficiary_type, b.gender, b.birth_date,
  b.country, b.city, b.status, b.notes, b.created_at, b.updated_at,
  b.photo_fichier,
  TRIM(CONCAT_WS(' ', b.first_name, b.last_name)) AS full_name,
  rattache.nombre  AS projects_count,
  rattache.projets AS project_names,
  depense.total    AS spent_total,
  depense.nombre   AS expenses_count
`;

const AGREGATS = `
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS nombre,
           STRING_AGG(p.name, ', ' ORDER BY p.name) AS projets
      FROM project_beneficiaries pb
      JOIN projects p ON p.id = pb.project_id
     WHERE pb.beneficiary_id = b.id
  ) rattache ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(e.amount), 0) AS total, COUNT(*)::int AS nombre
      FROM expenses e
     WHERE e.beneficiary_id = b.id AND e.status <> 'CANCELLED'
  ) depense ON TRUE
`;

/**
 * @param {{ statut?: string, type?: string, projectId?: number, recherche?: string }} filtres
 */
export async function lister(filtres = {}, client = null) {
  const conditions = [];
  const valeurs = [];

  if (filtres.statut) {
    valeurs.push(filtres.statut);
    conditions.push(`b.status = $${valeurs.length}`);
  }
  if (filtres.type) {
    valeurs.push(filtres.type);
    conditions.push(`b.beneficiary_type = $${valeurs.length}`);
  }
  if (filtres.projectId) {
    valeurs.push(filtres.projectId);
    conditions.push(
      `EXISTS (SELECT 1 FROM project_beneficiaries pb
                WHERE pb.beneficiary_id = b.id AND pb.project_id = $${valeurs.length})`
    );
  }
  if (filtres.recherche) {
    valeurs.push(`%${filtres.recherche}%`);
    conditions.push(`(b.first_name ILIKE $${valeurs.length}
                      OR b.last_name ILIKE $${valeurs.length}
                      OR b.city ILIKE $${valeurs.length})`);
  }

  const ou = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const resultat = await query(
    `SELECT ${COLONNES} FROM beneficiaries b ${AGREGATS} ${ou}
      ORDER BY b.created_at DESC, b.id DESC LIMIT 300`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

export async function trouverParId(id, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES} FROM beneficiaries b ${AGREGATS} WHERE b.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function creer(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO beneficiaries (first_name, last_name, beneficiary_type, gender,
                                birth_date, country, city, status, notes, photo_fichier)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      donnees.firstName,
      donnees.lastName,
      donnees.beneficiaryType,
      donnees.gender,
      donnees.birthDate,
      donnees.country,
      donnees.city,
      donnees.status,
      donnees.notes,
      donnees.photoFichier ?? null,
    ],
    client
  );
  return trouverParId(resultat.rows[0].id, client);
}

/** La photo est-elle deja celle d'un autre beneficiaire ? */
export async function photoDejaPrise(fichier, saufId = null, client = null) {
  const resultat = await query(
    `SELECT EXISTS (SELECT 1 FROM beneficiaries
                     WHERE photo_fichier = $1 AND ($2::int IS NULL OR id <> $2)) AS prise`,
    [fichier, saufId],
    client
  );
  return resultat.rows[0].prise;
}

export async function mettreAJour(id, colonnes, client = null) {
  const { clause, valeurs, vide } = construireSet(colonnes, 2);
  if (vide) return trouverParId(id, client);
  await query(`UPDATE beneficiaries SET ${clause} WHERE id = $1`, [id, ...valeurs], client);
  return trouverParId(id, client);
}

// ------------------------------------------------------------------
// Rattachement projet <-> beneficiaire
// ------------------------------------------------------------------

/** Beneficiaires rattaches a un projet (onglet Beneficiaires). */
export async function listerParProjet(projectId, client = null) {
  const resultat = await query(
    `SELECT pb.id, pb.project_id, pb.beneficiary_id, pb.joined_at, pb.left_at,
            pb.status, pb.notes, pb.created_at, pb.updated_at,
            b.first_name, b.last_name, b.beneficiary_type, b.gender, b.city,
            b.birth_date, b.status AS beneficiary_status,
            TRIM(CONCAT_WS(' ', b.first_name, b.last_name)) AS full_name
       FROM project_beneficiaries pb
       JOIN beneficiaries b ON b.id = pb.beneficiary_id
      WHERE pb.project_id = $1
      ORDER BY pb.joined_at DESC, pb.id DESC`,
    [projectId],
    client
  );
  return versListe(resultat.rows);
}

/** Projets auxquels un beneficiaire participe. */
export async function listerProjetsDuBeneficiaire(beneficiaryId, client = null) {
  const resultat = await query(
    `SELECT pb.id, pb.project_id, pb.joined_at, pb.left_at, pb.status, pb.notes,
            p.name AS project_name, p.status AS project_status
       FROM project_beneficiaries pb
       JOIN projects p ON p.id = pb.project_id
      WHERE pb.beneficiary_id = $1
      ORDER BY pb.joined_at DESC`,
    [beneficiaryId],
    client
  );
  return versListe(resultat.rows);
}

export async function trouverRattachement(projectId, beneficiaryId, client = null) {
  const resultat = await query(
    'SELECT * FROM project_beneficiaries WHERE project_id = $1 AND beneficiary_id = $2',
    [projectId, beneficiaryId],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function rattacher(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO project_beneficiaries (project_id, beneficiary_id, joined_at, status, notes)
     VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5)
     RETURNING *`,
    [
      donnees.projectId,
      donnees.beneficiaryId,
      donnees.joinedAt,
      donnees.status,
      donnees.notes,
    ],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function mettreAJourRattachement(id, colonnes, client = null) {
  const { clause, valeurs, vide } = construireSet(colonnes, 2);
  if (vide) {
    const actuel = await query('SELECT * FROM project_beneficiaries WHERE id = $1', [id], client);
    return versObjet(actuel.rows[0]);
  }
  const resultat = await query(
    `UPDATE project_beneficiaries SET ${clause} WHERE id = $1 RETURNING *`,
    [id, ...valeurs],
    client
  );
  return versObjet(resultat.rows[0]);
}
