import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

const URGENCE = `
  CASE t.priorite
    WHEN 'urgente' THEN 300 WHEN 'haute' THEN 200 WHEN 'moyenne' THEN 100 ELSE 0
  END
  + CASE
      WHEN t.statut = 'livree' OR t.echeance IS NULL THEN 0
      WHEN t.echeance < CURRENT_DATE THEN 150
      WHEN t.echeance <= CURRENT_DATE + 3 THEN 100
      WHEN t.echeance <= CURRENT_DATE + 7 THEN 50
      ELSE 0
    END
`;

const COLONNES = `
  t.id, t.projet_id, t.titre, t.description, t.echeance, t.statut,
  t.competences_requises, t.priorite, t.benevoles_min, t.benevoles_max,
  -- L'urgence, calculee ici pour que tous les ecrans s'accordent : la
  -- priorite choisie, rehaussee par une date de fin proche ou passee.
  (${URGENCE})::int AS urgence,
  t.prise_le, t.livree_le, t.livree_par, t.validee_par, t.cree_le, t.commentaire_livraison,
  p.name      AS projet_nom,
  p.reference AS projet_reference,
  p.status    AS projet_statut,
  COALESCE((
    SELECT json_agg(
             json_build_object(
               'id', f.id, 'fileName', f.nom_fichier,
               'mimeType', f.type_mime, 'fileSize', f.taille
             ) ORDER BY f.position, f.id
           )
      FROM tache_fichier f
     WHERE f.tache_id = t.id
  ), '[]'::json) AS files
`;

function personnes(statut, champDate) {
  return `COALESCE((
    SELECT json_agg(
             json_build_object(
               'benevoleId', tb.benevole_id,
               'utilisateurId', u.id,
               'prenom', u.prenom,
               'nom', u.nom,
               'email', u.email,
               'photoUrl', u.photo_url,
               'origine', tb.origine,
               'le', tb.${champDate}
             ) ORDER BY tb.${champDate}, u.prenom, u.nom
           )
      FROM tache_benevole tb
      JOIN benevole b    ON b.id = tb.benevole_id
      JOIN utilisateur u ON u.id = b.utilisateur_id
     WHERE tb.tache_id = t.id AND tb.statut = '${statut}'
  ), '[]'::json)`;
}

const VUE_ADMIN = `
  ${personnes('affectee', 'affectee_le')} AS equipe,
  ${personnes('demandee', 'demandee_le')} AS demandes,
  NULLIF(TRIM(CONCAT_WS(' ', lu.prenom, lu.nom)), '') AS livree_par_nom
`;

const JOINTURES_ADMIN = `
  LEFT JOIN benevole lb    ON lb.id = t.livree_par
  LEFT JOIN utilisateur lu ON lu.id = lb.utilisateur_id
`;

const VUE_BENEVOLE = `
  COALESCE((
    SELECT json_agg(u.prenom ORDER BY tb.affectee_le, u.prenom)
      FROM tache_benevole tb
      JOIN benevole b    ON b.id = tb.benevole_id
      JOIN utilisateur u ON u.id = b.utilisateur_id
     WHERE tb.tache_id = t.id AND tb.statut = 'affectee'
  ), '[]'::json) AS equipe,
  (SELECT tb.statut FROM tache_benevole tb
    WHERE tb.tache_id = t.id AND tb.benevole_id = $1) AS ma_place,
  (t.livree_par = $1) AS livree_par_moi
`;

const ORDRE = `
  ${URGENCE} DESC,
  CASE t.statut WHEN 'en_cours' THEN 0 WHEN 'a_faire' THEN 1 ELSE 2 END,
  t.echeance ASC NULLS LAST,
  t.cree_le DESC
`;

export async function lister(filtres = {}, options = {}, client = null) {
  const benevole = options.vue === 'benevole';
  const valeurs = benevole ? [options.benevoleId] : [];
  const conditions = [];

  if (filtres.statut) {
    valeurs.push(filtres.statut);
    conditions.push(`t.statut = $${valeurs.length}`);
  }
  if (filtres.projetId) {
    valeurs.push(filtres.projetId);
    conditions.push(`t.projet_id = $${valeurs.length}`);
  }
  if (filtres.membre) {
    valeurs.push(filtres.membre);
    conditions.push(`EXISTS (SELECT 1 FROM tache_benevole m
                              WHERE m.tache_id = t.id AND m.benevole_id = $${valeurs.length}
                                AND m.statut = 'affectee')`);
  }
  if (filtres.aPrendrePour) {
    valeurs.push(filtres.aPrendrePour);
    conditions.push(`t.statut <> 'livree'
                     AND p.archived_at IS NULL
                     AND NOT EXISTS (SELECT 1 FROM tache_benevole m
                                      WHERE m.tache_id = t.id AND m.benevole_id = $${valeurs.length}
                                        AND m.statut = 'affectee')`);
  }
  if (filtres.avecDemandes) {
    conditions.push(`EXISTS (SELECT 1 FROM tache_benevole d
                              WHERE d.tache_id = t.id AND d.statut = 'demandee')`);
  }

  const resultat = await query(
    `SELECT ${COLONNES}, ${benevole ? VUE_BENEVOLE : VUE_ADMIN}
       FROM tache t
       LEFT JOIN projects p ON p.id = t.projet_id
       ${benevole ? '' : JOINTURES_ADMIN}
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY ${ORDRE}`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

export async function trouverParId(id, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES}, ${VUE_ADMIN}
       FROM tache t
       LEFT JOIN projects p ON p.id = t.projet_id
       ${JOINTURES_ADMIN}
      WHERE t.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function trouverPourBenevole(id, benevoleId, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES}, ${VUE_BENEVOLE}
       FROM tache t
       LEFT JOIN projects p ON p.id = t.projet_id
      WHERE t.id = $2`,
    [benevoleId, id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function creer(
  {
    projetId,
    titre,
    description = null,
    echeance = null,
    competencesRequises = [],
    priorite = 'moyenne',
    benevolesMin = null,
    benevolesMax = null,
  },
  client = null
) {
  const resultat = await query(
    `INSERT INTO tache
       (projet_id, titre, description, echeance, competences_requises,
        priorite, benevoles_min, benevoles_max)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      projetId,
      titre,
      description,
      echeance,
      competencesRequises,
      priorite,
      benevolesMin,
      benevolesMax,
    ],
    client
  );
  return trouverParId(resultat.rows[0].id, client);
}

export async function mettreAJour(
  id,
  { titre, description, echeance, competencesRequises, priorite, benevolesMin, benevolesMax },
  client = null
) {
  const resultat = await query(
    `UPDATE tache
        SET titre = $2, description = $3, echeance = $4, competences_requises = $5,
            priorite = $6, benevoles_min = $7, benevoles_max = $8
      WHERE id = $1
      RETURNING id`,
    [id, titre, description, echeance, competencesRequises, priorite, benevolesMin, benevolesMax],
    client
  );
  if (!resultat.rows[0]) return null;
  return trouverParId(id, client);
}

export async function supprimer(id, client = null) {
  const resultat = await query('DELETE FROM tache WHERE id = $1 RETURNING id', [id], client);
  return resultat.rowCount > 0;
}

export async function verrouiller(id, client) {
  const resultat = await query(
    `SELECT t.id, t.titre, t.statut, t.projet_id, t.benevoles_min, t.benevoles_max,
            p.archived_at AS projet_archive_le,
            (SELECT COUNT(*)::int FROM tache_benevole tb
              WHERE tb.tache_id = t.id AND tb.statut = 'affectee') AS equipe_nombre
       FROM tache t
       LEFT JOIN projects p ON p.id = t.projet_id
      WHERE t.id = $1
      FOR UPDATE OF t`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function place(tacheId, benevoleId, client = null) {
  const resultat = await query(
    `SELECT tb.statut, tb.origine, b.utilisateur_id
       FROM tache_benevole tb
       JOIN benevole b ON b.id = tb.benevole_id
      WHERE tb.tache_id = $1 AND tb.benevole_id = $2`,
    [tacheId, benevoleId],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function affecter(tacheId, benevoleId, adminId, client = null) {
  await query(
    `INSERT INTO tache_benevole
       (tache_id, benevole_id, statut, origine, affectee_le, decidee_par, decidee_le)
     VALUES ($1, $2, 'affectee', 'equipe', NOW(), $3, NOW())
     ON CONFLICT (tache_id, benevole_id) DO UPDATE
       SET statut = 'affectee', affectee_le = NOW(),
           decidee_par = EXCLUDED.decidee_par, decidee_le = NOW()`,
    [tacheId, benevoleId, adminId],
    client
  );
}

export async function demander(tacheId, benevoleId, client = null) {
  await query(
    `INSERT INTO tache_benevole (tache_id, benevole_id, statut, origine, demandee_le)
     VALUES ($1, $2, 'demandee', 'benevole', NOW())
     ON CONFLICT (tache_id, benevole_id) DO UPDATE
       SET statut = 'demandee', origine = 'benevole', demandee_le = NOW(),
           decidee_par = NULL, decidee_le = NULL
     WHERE tache_benevole.statut = 'refusee'`,
    [tacheId, benevoleId],
    client
  );
}

export async function refuser(tacheId, benevoleId, adminId, client = null) {
  await query(
    `UPDATE tache_benevole
        SET statut = 'refusee', decidee_par = $3, decidee_le = NOW()
      WHERE tache_id = $1 AND benevole_id = $2 AND statut = 'demandee'`,
    [tacheId, benevoleId, adminId],
    client
  );
}

export async function retirer(tacheId, benevoleId, client = null) {
  const resultat = await query(
    `DELETE FROM tache_benevole WHERE tache_id = $1 AND benevole_id = $2 RETURNING statut`,
    [tacheId, benevoleId],
    client
  );
  return resultat.rows[0]?.statut ?? null;
}

export async function alignerStatut(tacheId, client = null) {
  await query(
    `UPDATE tache t
        SET statut = CASE WHEN e.nombre > 0 THEN 'en_cours' ELSE 'a_faire' END,
            prise_le = CASE WHEN e.nombre > 0 THEN COALESCE(t.prise_le, NOW()) ELSE NULL END
       FROM (SELECT COUNT(*)::int AS nombre FROM tache_benevole
              WHERE tache_id = $1 AND statut = 'affectee') e
      WHERE t.id = $1 AND t.statut <> 'livree'`,
    [tacheId],
    client
  );
}

export async function livrer(id, benevoleId, commentaire = null, client = null) {
  await query(
    `UPDATE tache
        SET statut = 'livree', livree_le = NOW(), livree_par = $2, commentaire_livraison = $3
      WHERE id = $1`,
    [id, benevoleId, commentaire],
    client
  );
}

export async function ajouterFichiers(tacheId, fichiers, client = null) {
  for (const [rang, fichier] of fichiers.entries()) {
    await query(
      `INSERT INTO tache_fichier (tache_id, nom_fichier, chemin, type_mime, taille, position)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tacheId, fichier.nomFichier, fichier.chemin, fichier.typeMime, fichier.taille, rang],
      client
    );
  }
}

export async function trouverFichier(tacheId, fichierId, client = null) {
  const resultat = await query(
    `SELECT f.id, f.tache_id, f.nom_fichier AS file_name, f.chemin AS file_path,
            f.type_mime AS mime_type,
            COALESCE((SELECT array_agg(tb.benevole_id) FROM tache_benevole tb
                       WHERE tb.tache_id = f.tache_id AND tb.statut = 'affectee'),
                     ARRAY[]::uuid[]) AS equipe
       FROM tache_fichier f
      WHERE f.tache_id = $1 AND f.id = $2`,
    [tacheId, fichierId],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function compterParStatut(benevoleId, client = null) {
  const resultat = await query(
    `SELECT t.statut, COUNT(*)::int AS nombre
       FROM tache t
       JOIN tache_benevole tb ON tb.tache_id = t.id
      WHERE tb.benevole_id = $1 AND tb.statut = 'affectee'
      GROUP BY t.statut`,
    [benevoleId],
    client
  );

  const compteurs = { a_faire: 0, en_cours: 0, livree: 0 };
  for (const ligne of resultat.rows) {
    compteurs[ligne.statut] = ligne.nombre;
  }
  return compteurs;
}

export async function compterPourAdmin(client = null) {
  const resultat = await query(
    `SELECT COUNT(*)::int                                          AS toutes,
            COUNT(*) FILTER (WHERE t.statut = 'a_faire')::int      AS a_faire,
            COUNT(*) FILTER (WHERE t.statut = 'en_cours')::int     AS en_cours,
            COUNT(*) FILTER (WHERE t.statut = 'livree')::int       AS livree,
            COUNT(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM tache_benevole d
               WHERE d.tache_id = t.id AND d.statut = 'demandee'))::int AS demandes
       FROM tache t`,
    [],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function compterDemandesEnAttente(client = null) {
  const resultat = await query(
    `SELECT COUNT(*)::int AS total FROM tache_benevole WHERE statut = 'demandee'`,
    [],
    client
  );
  return resultat.rows[0].total;
}

export async function apercu(client = null) {
  const resultat = await query(
    `SELECT COUNT(*) FILTER (WHERE t.statut = 'a_faire')::int                     AS taches_libres,
            COUNT(*) FILTER (WHERE t.statut = 'en_cours')::int                    AS taches_en_cours,
            COUNT(*) FILTER (WHERE t.statut = 'livree'
                               AND t.livree_le >= NOW() - INTERVAL '30 days')::int AS taches_livrees_mois,
            (SELECT COUNT(DISTINCT tb.benevole_id)::int
               FROM tache_benevole tb
               JOIN tache e ON e.id = tb.tache_id
              WHERE tb.statut = 'affectee' AND e.statut = 'en_cours')              AS benevoles_mobilises,
            COUNT(DISTINCT t.projet_id) FILTER (WHERE t.statut = 'a_faire')::int   AS projets_en_attente
       FROM tache t`,
    [],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function benevolesAffectables(client = null) {
  const resultat = await query(
    `SELECT b.id AS benevole_id, u.id AS utilisateur_id, u.prenom, u.nom, u.email, u.photo_url,
            b.competences
       FROM benevole b
       JOIN utilisateur u ON u.id = b.utilisateur_id
      WHERE u.statut = 'actif'
      ORDER BY u.prenom, u.nom`,
    [],
    client
  );
  return versListe(resultat.rows);
}

export async function comptesDes(benevoleIds, client = null) {
  if (benevoleIds.length === 0) return [];
  const resultat = await query(
    `SELECT id AS benevole_id, utilisateur_id FROM benevole WHERE id = ANY($1::uuid[])`,
    [benevoleIds],
    client
  );
  return versListe(resultat.rows);
}
