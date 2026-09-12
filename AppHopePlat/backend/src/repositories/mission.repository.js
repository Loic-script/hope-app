/**
 * Repository des missions de benevolat.
 *
 * Trois tables tournent autour de la meme idee : la mission, les
 * inscriptions qui la remplissent, les avis qu'elle laisse ensuite.
 *
 * Les places restantes ne sont jamais stockees : elles se comptent
 * depuis les inscriptions actives. Une colonne "places_prises" se
 * desynchroniserait au premier desistement traite a la main.
 */
import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

/** Une inscription qui occupe reellement une place. */
const STATUTS_OCCUPANTS = ['inscrit', 'confirme', 'present'];

const COLONNES = `
  m.id, m.projet_id, m.titre, m.description, m.lieu_nom,
  m.latitude, m.longitude, m.format, m.date_debut, m.date_fin,
  m.recurrence, m.places_total, m.encadreur_id, m.besoins_a_apporter,
  m.statut, m.cree_le,
  p.name           AS projet_nom,
  p.reference      AS projet_reference,
  a.full_name      AS encadreur_nom,
  occupees.nombre  AS places_prises,
  (m.places_total - occupees.nombre) AS places_restantes,
  notes.moyenne    AS note_moyenne,
  notes.nombre     AS avis_nombre
`;

const JOINTURES = `
  LEFT JOIN projects p ON p.id = m.projet_id
  LEFT JOIN admins   a ON a.id = m.encadreur_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS nombre
      FROM inscription_mission
     WHERE mission_id = m.id AND statut = ANY($1::TEXT[])
  ) occupees ON TRUE
  LEFT JOIN LATERAL (
    SELECT ROUND(AVG(note)::NUMERIC, 1) AS moyenne, COUNT(*)::int AS nombre
      FROM avis_mission
     WHERE mission_id = m.id AND publie = TRUE
  ) notes ON TRUE
`;

/* ================================================================
   Missions
   ================================================================ */

/**
 * Liste les missions visibles par un benevole.
 *
 * Les brouillons n'apparaissent jamais : ils appartiennent a l'equipe
 * HOPE tant qu'elle ne les a pas ouverts.
 *
 * @param {{ statut?: string, format?: string, projetId?: number,
 *           aVenir?: boolean, recherche?: string, limite?: number }} filtres
 * @param {string|null} benevoleId si fourni, marque les missions ou il est inscrit
 */
export async function lister(filtres = {}, benevoleId = null, client = null) {
  const valeurs = [STATUTS_OCCUPANTS];
  const conditions = [`m.statut <> 'brouillon'`];

  if (filtres.statut) {
    valeurs.push(filtres.statut);
    conditions.push(`m.statut = $${valeurs.length}`);
  }
  if (filtres.format) {
    valeurs.push(filtres.format);
    conditions.push(`m.format = $${valeurs.length}`);
  }
  if (filtres.projetId) {
    valeurs.push(filtres.projetId);
    conditions.push(`m.projet_id = $${valeurs.length}`);
  }
  if (filtres.aVenir) {
    conditions.push('m.date_debut >= NOW()');
  }
  if (filtres.recherche) {
    valeurs.push(`%${filtres.recherche}%`);
    conditions.push(
      `(m.titre ILIKE $${valeurs.length} OR m.lieu_nom ILIKE $${valeurs.length}
        OR p.name ILIKE $${valeurs.length})`
    );
  }

  // L'inscription du benevole courant, s'il y en a une.
  let jointureMoi = '';
  let colonneMoi = 'NULL::TEXT AS mon_inscription_statut, NULL::UUID AS mon_inscription_id';
  if (benevoleId) {
    valeurs.push(benevoleId);
    jointureMoi = `
      LEFT JOIN inscription_mission moi
             ON moi.mission_id = m.id AND moi.benevole_id = $${valeurs.length}
    `;
    colonneMoi = 'moi.statut AS mon_inscription_statut, moi.id AS mon_inscription_id';
  }

  const limite = Number.isInteger(filtres.limite) ? filtres.limite : 50;
  valeurs.push(limite);

  const resultat = await query(
    `SELECT ${COLONNES}, ${colonneMoi}
       FROM mission m
       ${JOINTURES}
       ${jointureMoi}
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        -- Les missions ouvertes et proches d'abord ; le passe en dernier.
        CASE WHEN m.date_debut >= NOW() THEN 0 ELSE 1 END,
        CASE WHEN m.date_debut >= NOW() THEN m.date_debut END ASC,
        m.date_debut DESC
      LIMIT $${valeurs.length}`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

export async function trouverParId(id, benevoleId = null, client = null) {
  const valeurs = [STATUTS_OCCUPANTS, id];

  let jointureMoi = '';
  let colonneMoi = 'NULL::TEXT AS mon_inscription_statut, NULL::UUID AS mon_inscription_id';
  if (benevoleId) {
    valeurs.push(benevoleId);
    jointureMoi = `
      LEFT JOIN inscription_mission moi
             ON moi.mission_id = m.id AND moi.benevole_id = $3
    `;
    colonneMoi = 'moi.statut AS mon_inscription_statut, moi.id AS mon_inscription_id';
  }

  const resultat = await query(
    `SELECT ${COLONNES}, ${colonneMoi}
       FROM mission m
       ${JOINTURES}
       ${jointureMoi}
      WHERE m.id = $2`,
    valeurs,
    client
  );
  return versObjet(resultat.rows[0]);
}

/**
 * Verrouille une mission pour la duree de la transaction.
 *
 * Appele avant de compter les places : sans ce verrou, deux
 * inscriptions simultanees liraient toutes deux "une place libre" et
 * la mission finirait en surnombre.
 */
export async function verrouiller(id, client) {
  const resultat = await query(
    `SELECT m.id, m.statut, m.format, m.places_total, m.date_debut,
            (SELECT COUNT(*)::int FROM inscription_mission
              WHERE mission_id = m.id AND statut = ANY($2::TEXT[])) AS places_prises
       FROM mission m
      WHERE m.id = $1
      FOR UPDATE`,
    [id, STATUTS_OCCUPANTS],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Passe une mission a "complete" ou la rouvre selon les places. */
export async function ajusterCompletude(id, client) {
  await query(
    `UPDATE mission m
        SET statut = CASE
              WHEN occupees.nombre >= m.places_total THEN 'complete'
              ELSE 'ouverte'
            END
       FROM (
         SELECT COUNT(*)::int AS nombre
           FROM inscription_mission
          WHERE mission_id = $1 AND statut = ANY($2::TEXT[])
       ) occupees
      WHERE m.id = $1
        -- On ne touche ni aux brouillons, ni au passe, ni aux annulees.
        AND m.statut IN ('ouverte', 'complete')`,
    [id, STATUTS_OCCUPANTS],
    client
  );
}

/** Chiffres de la vue d'ensemble de l'espace benevole. */
export async function apercu(client = null) {
  const resultat = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM mission
         WHERE statut = 'ouverte' AND date_debut >= NOW())        AS missions_ouvertes,
       (SELECT COUNT(*)::int FROM mission
         WHERE statut IN ('ouverte', 'complete')
           AND date_debut >= NOW()
           AND date_debut < NOW() + INTERVAL '7 days')            AS missions_cette_semaine,
       (SELECT COUNT(DISTINCT benevole_id)::int FROM inscription_mission
         WHERE statut = ANY($1::TEXT[]))                          AS benevoles_mobilises,
       (SELECT COUNT(*)::int FROM tache WHERE statut = 'a_faire') AS taches_libres`,
    [STATUTS_OCCUPANTS],
    client
  );
  return versObjet(resultat.rows[0]);
}

/* ================================================================
   Inscriptions
   ================================================================ */

export async function creerInscription(missionId, benevoleId, client = null) {
  const resultat = await query(
    `INSERT INTO inscription_mission (mission_id, benevole_id)
     VALUES ($1, $2)
     RETURNING id`,
    [missionId, benevoleId],
    client
  );
  return resultat.rows[0].id;
}

export async function trouverInscription(missionId, benevoleId, client = null) {
  const resultat = await query(
    `SELECT id, mission_id, benevole_id, statut, inscrit_le, annule_le,
            motif_annulation, heures_validees
       FROM inscription_mission
      WHERE mission_id = $1 AND benevole_id = $2
      FOR UPDATE`,
    [missionId, benevoleId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Annule une inscription. Elle n'est pas supprimee : la trace reste. */
export async function annulerInscription(id, motif, client = null) {
  const resultat = await query(
    `UPDATE inscription_mission
        SET statut = 'annule', annule_le = NOW(), motif_annulation = $2
      WHERE id = $1
      RETURNING id`,
    [id, motif ?? null],
    client
  );
  return resultat.rowCount > 0;
}

/** Reactive une inscription annulee plutot que d'en creer une seconde. */
export async function reactiverInscription(id, client = null) {
  await query(
    `UPDATE inscription_mission
        SET statut = 'inscrit', inscrit_le = NOW(),
            annule_le = NULL, motif_annulation = NULL
      WHERE id = $1`,
    [id],
    client
  );
}

/** Les missions d'un benevole, inscription comprise. */
export async function listerMesMissions(benevoleId, client = null) {
  const resultat = await query(
    `SELECT i.id AS inscription_id, i.statut AS inscription_statut,
            i.inscrit_le, i.annule_le, i.motif_annulation, i.heures_validees,
            m.id, m.titre, m.lieu_nom, m.format, m.date_debut, m.date_fin,
            m.statut, p.name AS projet_nom,
            (avis.id IS NOT NULL) AS avis_donne
       FROM inscription_mission i
       JOIN mission m  ON m.id = i.mission_id
       LEFT JOIN projects p ON p.id = m.projet_id
       LEFT JOIN avis_mission avis
              ON avis.mission_id = m.id AND avis.benevole_id = i.benevole_id
      WHERE i.benevole_id = $1
      ORDER BY m.date_debut DESC`,
    [benevoleId],
    client
  );
  return versListe(resultat.rows);
}

/* ================================================================
   Avis
   ================================================================ */

export async function creerAvis(missionId, benevoleId, { note, commentaire }, client = null) {
  const resultat = await query(
    `INSERT INTO avis_mission (mission_id, benevole_id, note, commentaire)
     VALUES ($1, $2, $3, $4)
     RETURNING id, mission_id, benevole_id, note, commentaire, publie, cree_le`,
    [missionId, benevoleId, note, commentaire ?? null],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Avis publies d'une mission. Le prenom suffit a signer un avis. */
export async function listerAvis(missionId, client = null) {
  const resultat = await query(
    `SELECT a.id, a.note, a.commentaire, a.cree_le, u.prenom AS auteur_prenom
       FROM avis_mission a
       JOIN benevole b    ON b.id = a.benevole_id
       JOIN utilisateur u ON u.id = b.utilisateur_id
      WHERE a.mission_id = $1 AND a.publie = TRUE
      ORDER BY a.cree_le DESC`,
    [missionId],
    client
  );
  return versListe(resultat.rows);
}

export async function avisExiste(missionId, benevoleId, client = null) {
  const resultat = await query(
    'SELECT 1 FROM avis_mission WHERE mission_id = $1 AND benevole_id = $2 LIMIT 1',
    [missionId, benevoleId],
    client
  );
  return resultat.rowCount > 0;
}
