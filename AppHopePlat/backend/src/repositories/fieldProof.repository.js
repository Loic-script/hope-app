/**
 * Repository des preuves terrain (field_proofs).
 *
 * Une preuve montre qu'une action a eu lieu : "les fournitures ont ete
 * remises ce matin". Elle ne prouve pas une depense -- c'est le role des
 * justificatifs, dans document.repository.js.
 */
import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

/**
 * Nombre de jours de silence au-dela duquel un projet est signale.
 *
 * Quinze jours : c'est le seuil des maquettes, et il correspond a peu
 * pres au rythme ou un donateur revient voir ou en est son don.
 */
export const SEUIL_SILENCE_JOURS = 15;

const COLONNES = `
  f.id, f.project_id, f.admin_id, f.proof_type, f.description,
  f.file_name, f.file_path, f.mime_type, f.file_size, f.occurred_on,
  f.created_at, f.updated_at,
  p.name      AS project_name,
  p.reference AS project_reference,
  p.status    AS project_status,
  a.admin_log AS author_log
`;

const JOINTURES = `
  JOIN projects p ON p.id = f.project_id
  LEFT JOIN admins a ON a.id = f.admin_id
`;

/**
 * @param {{ projectId?: number, type?: string, recherche?: string,
 *           limite?: number }} filtres
 */
export async function lister(filtres = {}, client = null) {
  const conditions = [];
  const valeurs = [];

  if (filtres.projectId) {
    valeurs.push(filtres.projectId);
    conditions.push(`f.project_id = $${valeurs.length}`);
  }
  if (filtres.type) {
    valeurs.push(filtres.type);
    conditions.push(`f.proof_type = $${valeurs.length}`);
  }
  if (filtres.recherche) {
    valeurs.push(`%${filtres.recherche}%`);
    conditions.push(`(f.description ILIKE $${valeurs.length}
                      OR p.name ILIKE $${valeurs.length}
                      OR p.reference ILIKE $${valeurs.length})`);
  }

  const ou = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  valeurs.push(filtres.limite ?? 200);

  const resultat = await query(
    `SELECT ${COLONNES} FROM field_proofs f ${JOINTURES} ${ou}
      ORDER BY f.created_at DESC, f.id DESC
      LIMIT $${valeurs.length}`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

export async function trouverParId(id, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES} FROM field_proofs f ${JOINTURES} WHERE f.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function creer(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO field_proofs
       (project_id, admin_id, proof_type, description,
        file_name, file_path, mime_type, file_size, occurred_on)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_DATE))
     RETURNING id`,
    [
      donnees.projectId,
      donnees.adminId ?? null,
      donnees.proofType,
      donnees.description,
      donnees.fileName ?? null,
      donnees.filePath ?? null,
      donnees.mimeType ?? null,
      donnees.fileSize ?? null,
      donnees.occurredOn ?? null,
    ],
    client
  );
  return trouverParId(resultat.rows[0].id, client);
}

export async function supprimer(id, client = null) {
  await query('DELETE FROM field_proofs WHERE id = $1', [id], client);
}

/**
 * Les quatre chiffres du haut de l'ecran.
 *
 * "projetsSansPreuve" ne compte que les projets EN COURS : un projet
 * termine n'a plus a produire de nouvelles, et un projet archive est
 * fige. Un projet en cours qui n'a jamais eu de preuve compte aussi --
 * c'est meme le cas le plus important a faire remonter.
 */
export async function statistiques(client = null) {
  const resultat = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM field_proofs
         WHERE created_at >= date_trunc('month', NOW()))          AS preuves_ce_mois,
       (SELECT COUNT(*)::int FROM field_proofs)                   AS preuves_total,
       (SELECT COUNT(DISTINCT admin_id)::int FROM field_proofs
         WHERE admin_id IS NOT NULL
           AND created_at >= NOW() - INTERVAL '90 days')          AS contributeurs_actifs,
       (SELECT COUNT(*)::int FROM projects p
         WHERE p.status = 'IN_PROGRESS'
           AND COALESCE(
                 (SELECT MAX(f.created_at) FROM field_proofs f WHERE f.project_id = p.id),
                 p.created_at
               ) < NOW() - ($1 || ' days')::interval)             AS projets_sans_preuve,
       (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (created_at - occurred_on::timestamptz))
                         / 86400)::numeric, 1)
          FROM field_proofs
         WHERE created_at >= NOW() - INTERVAL '90 days')          AS delai_moyen_jours`,
    [SEUIL_SILENCE_JOURS],
    client
  );
  return versObjet(resultat.rows[0]);
}

/**
 * Les projets en cours dont on n'a plus de nouvelles.
 *
 * Seuls les projets EN COURS sont concernes : un projet termine n'a plus
 * a produire de nouvelles, un projet archive est fige. Le tri met en tete
 * le plus silencieux -- c'est celui par lequel commencer.
 */
export async function projetsSilencieux(client = null) {
  const resultat = await query(
    `SELECT p.id, p.reference, p.name, p.status,
            derniere.date AS last_proof_at,
            FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(derniere.date, p.created_at))) / 86400)::int
              AS days_since_proof
       FROM projects p
       LEFT JOIN LATERAL (
         SELECT MAX(created_at) AS date FROM field_proofs WHERE project_id = p.id
       ) derniere ON TRUE
      WHERE p.status = 'IN_PROGRESS'
        AND COALESCE(derniere.date, p.created_at) < NOW() - ($1 || ' days')::interval
      ORDER BY COALESCE(derniere.date, p.created_at) ASC`,
    [SEUIL_SILENCE_JOURS],
    client
  );
  return versListe(resultat.rows);
}

/**
 * Date de la derniere preuve de chaque projet.
 * Alimente la colonne "Derniere preuve" du tableau des projets.
 *
 * @returns {Promise<Map<number, string>>} projectId -> date ISO
 */
export async function dernierePreuveParProjet(client = null) {
  const resultat = await query(
    `SELECT project_id, MAX(created_at) AS derniere
       FROM field_proofs GROUP BY project_id`,
    [],
    client
  );
  return new Map(resultat.rows.map((l) => [l.project_id, l.derniere.toISOString()]));
}
