import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

export const SEUIL_SILENCE_JOURS = 15;

const COLONNES = `
  f.id, f.project_id, f.admin_id, f.benevole_id, f.proof_type, f.description,
  f.occurred_on, f.created_at, f.updated_at,
  p.name      AS project_name,
  p.reference AS project_reference,
  p.status    AS project_status,
  a.admin_log AS author_log,
  -- Une preuve deposee par un benevole : son nom, et son compte.
  NULLIF(TRIM(COALESCE(ub.prenom, '') || ' ' || COALESCE(ub.nom, '')), '') AS author_volunteer,
  ub.id       AS author_volunteer_account,
  COALESCE(fichiers.liste, '[]'::json) AS files
`;

const JOINTURES = `
  JOIN projects p ON p.id = f.project_id
  LEFT JOIN admins a ON a.id = f.admin_id
  LEFT JOIN benevole bv ON bv.id = f.benevole_id
  LEFT JOIN utilisateur ub ON ub.id = bv.utilisateur_id
  LEFT JOIN LATERAL (
    SELECT json_agg(
             json_build_object(
               'id',       x.id,
               'fileName', x.file_name,
               'filePath', x.file_path,
               'mimeType', x.mime_type,
               'fileSize', x.file_size,
               'position', x.position
             ) ORDER BY x.position, x.id
           ) AS liste
      FROM field_proof_files x
     WHERE x.proof_id = f.id
  ) fichiers ON TRUE
`;

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
       (project_id, admin_id, benevole_id, proof_type, description, occurred_on)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE))
     RETURNING id`,
    [
      donnees.projectId,
      donnees.adminId ?? null,
      donnees.benevoleId ?? null,
      donnees.proofType,
      donnees.description,
      donnees.occurredOn ?? null,
    ],
    client
  );

  const preuveId = resultat.rows[0].id;
  await ajouterFichiers(preuveId, donnees.files ?? [], client);
  return trouverParId(preuveId, client);
}

export async function ajouterFichiers(preuveId, fichiers, client = null) {
  for (const [rang, fichier] of fichiers.entries()) {
    await query(
      `INSERT INTO field_proof_files
         (proof_id, file_name, file_path, mime_type, file_size, position)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        preuveId,
        fichier.fileName,
        fichier.filePath,
        fichier.mimeType ?? null,
        fichier.fileSize ?? null,
        rang,
      ],
      client
    );
  }
}

export async function listerPourBenevole(projectId, utilisateurId = null, client = null) {
  const resultat = await query(
    `SELECT f.id, f.proof_type, f.description, f.occurred_on::text AS occurred_on,
            f.created_at,
            NULLIF(TRIM(ub.prenom), '') AS auteur_benevole,
            (f.benevole_id IS NOT NULL AND ub.id = $2) AS mienne,
            COALESCE((
              SELECT json_agg(
                       json_build_object(
                         'id', x.id, 'fileName', x.file_name,
                         'mimeType', x.mime_type, 'fileSize', x.file_size,
                         'position', x.position
                       ) ORDER BY x.position, x.id
                     )
                FROM field_proof_files x WHERE x.proof_id = f.id
            ), '[]'::json) AS files
       FROM field_proofs f
       LEFT JOIN benevole bv ON bv.id = f.benevole_id
       LEFT JOIN utilisateur ub ON ub.id = bv.utilisateur_id
      WHERE f.project_id = $1
      ORDER BY f.occurred_on DESC, f.id DESC`,
    [projectId, utilisateurId],
    client
  );
  return versListe(resultat.rows);
}

export async function trouverFichierDuProjet(projectId, preuveId, fichierId, client = null) {
  const resultat = await query(
    `SELECT x.id, x.file_name, x.file_path, x.mime_type
       FROM field_proof_files x
       JOIN field_proofs f ON f.id = x.proof_id
      WHERE x.id = $1 AND x.proof_id = $2 AND f.project_id = $3`,
    [fichierId, preuveId, projectId],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function trouverFichier(preuveId, fichierId, client = null) {
  const resultat = await query(
    `SELECT id, proof_id, file_name, file_path, mime_type, file_size, position
       FROM field_proof_files WHERE id = $1 AND proof_id = $2`,
    [fichierId, preuveId],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function supprimer(id, client = null) {
  const fichiers = await query(
    'SELECT file_path FROM field_proof_files WHERE proof_id = $1',
    [id],
    client
  );
  await query('DELETE FROM field_proofs WHERE id = $1', [id], client);
  return fichiers.rows.map((ligne) => ligne.file_path);
}

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

export async function dernierePreuveParProjet(client = null) {
  const resultat = await query(
    `SELECT project_id, MAX(created_at) AS derniere
       FROM field_proofs GROUP BY project_id`,
    [],
    client
  );
  return new Map(resultat.rows.map((l) => [l.project_id, l.derniere.toISOString()]));
}
