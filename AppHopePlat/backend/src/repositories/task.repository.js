/**
 * Repository des taches de projet.
 *
 * Une tache est soit libre (personne ne l'a prise), soit portee par un
 * benevole. Le passage de l'une a l'autre est verrouille : deux
 * benevoles qui cliquent en meme temps ne doivent pas se retrouver
 * tous les deux dessus.
 */
import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

const COLONNES = `
  t.id, t.projet_id, t.titre, t.description, t.echeance, t.statut,
  t.benevole_id, t.prise_le, t.livree_le, t.validee_par, t.cree_le,
  p.name      AS projet_nom,
  p.reference AS projet_reference,
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

/**
 * Liste les taches.
 *
 * @param {{ statut?: string, benevoleId?: string, libres?: boolean,
 *           projetId?: number }} filtres
 */
export async function lister(filtres = {}, client = null) {
  const valeurs = [];
  const conditions = [];

  if (filtres.libres) {
    conditions.push(`t.statut = 'a_faire' AND t.benevole_id IS NULL`);
  }
  if (filtres.benevoleId) {
    valeurs.push(filtres.benevoleId);
    conditions.push(`t.benevole_id = $${valeurs.length}`);
  }
  if (filtres.statut) {
    valeurs.push(filtres.statut);
    conditions.push(`t.statut = $${valeurs.length}`);
  }
  if (filtres.projetId) {
    valeurs.push(filtres.projetId);
    conditions.push(`t.projet_id = $${valeurs.length}`);
  }

  const resultat = await query(
    `SELECT ${COLONNES}
       FROM tache t
       LEFT JOIN projects p ON p.id = t.projet_id
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY
        -- Ce qui est en cours d'abord, puis a faire, puis livre.
        CASE t.statut WHEN 'en_cours' THEN 0 WHEN 'a_faire' THEN 1 ELSE 2 END,
        -- Une echeance proche passe devant ; sans echeance, en dernier.
        t.echeance ASC NULLS LAST,
        t.cree_le DESC`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

/**
 * Cree une tache, libre par defaut.
 *
 * Aucun benevole n'est attribue a la creation : la base l'impose pour le
 * statut "a_faire", et c'est ce qui rend la tache visible a tous dans
 * l'espace benevole. C'est celui qui la prend qui s'y inscrit.
 */
export async function creer({ projetId, titre, description = null, echeance = null }, client = null) {
  const resultat = await query(
    `INSERT INTO tache (projet_id, titre, description, echeance)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [projetId, titre, description, echeance],
    client
  );
  return trouverParId(resultat.rows[0].id, client);
}

/**
 * Supprime une tache.
 *
 * Refuse si quelqu'un l'a prise : effacer sous les pieds d'un benevole
 * qui travaille dessus lui ferait perdre son travail sans un mot. La
 * regle est appliquee par le service, qui sait dire pourquoi.
 */
export async function supprimer(id, client = null) {
  const resultat = await query('DELETE FROM tache WHERE id = $1 RETURNING id', [id], client);
  return resultat.rowCount > 0;
}

export async function trouverParId(id, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES}
       FROM tache t
       LEFT JOIN projects p ON p.id = t.projet_id
      WHERE t.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Verrouille une tache avant de decider si elle peut etre prise. */
export async function verrouiller(id, client) {
  const resultat = await query(
    'SELECT id, statut, benevole_id FROM tache WHERE id = $1 FOR UPDATE',
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Un benevole prend une tache libre. */
export async function prendre(id, benevoleId, client = null) {
  await query(
    `UPDATE tache
        SET benevole_id = $2, statut = 'en_cours', prise_le = NOW(), livree_le = NULL
      WHERE id = $1`,
    [id, benevoleId],
    client
  );
  return trouverParId(id, client);
}

/** Le benevole rend la tache : elle redevient libre. */
export async function relacher(id, client = null) {
  await query(
    `UPDATE tache
        SET benevole_id = NULL, statut = 'a_faire', prise_le = NULL, livree_le = NULL
      WHERE id = $1`,
    [id],
    client
  );
  return trouverParId(id, client);
}

/** Le benevole declare la tache livree. */
export async function livrer(id, client = null) {
  await query(
    `UPDATE tache
        SET statut = 'livree', livree_le = NOW()
      WHERE id = $1`,
    [id],
    client
  );
  return trouverParId(id, client);
}

/**
 * Joint les fichiers de la livraison a la tache.
 *
 * Appelee dans la meme transaction que la livraison : une tache ne doit
 * pas passer "livree" sans sa preuve, ni une preuve rester sans tache.
 */
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

/** Un fichier de livraison, avec de quoi le servir. */
export async function trouverFichier(tacheId, fichierId, client = null) {
  const resultat = await query(
    `SELECT f.id, f.tache_id, f.nom_fichier AS file_name, f.chemin AS file_path,
            f.type_mime AS mime_type, t.benevole_id
       FROM tache_fichier f
       JOIN tache t ON t.id = f.tache_id
      WHERE f.tache_id = $1 AND f.id = $2`,
    [tacheId, fichierId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Compteurs des trois colonnes de "Mes taches". */
export async function compterParStatut(benevoleId, client = null) {
  const resultat = await query(
    `SELECT statut, COUNT(*)::int AS nombre
       FROM tache
      WHERE benevole_id = $1
      GROUP BY statut`,
    [benevoleId],
    client
  );

  const compteurs = { a_faire: 0, en_cours: 0, livree: 0 };
  for (const ligne of resultat.rows) {
    compteurs[ligne.statut] = ligne.nombre;
  }
  return compteurs;
}

/**
 * Les chiffres de la vue d'ensemble benevole.
 *
 * L'espace ne proposant plus que des taches, ce sont elles qui disent ce
 * qui se passe : ce qui attend quelqu'un, ce qui avance, ce qui a abouti
 * ce mois-ci, et combien de benevoles y prennent part.
 */
export async function apercu(client = null) {
  const resultat = await query(
    `SELECT COUNT(*) FILTER (WHERE statut = 'a_faire')::int                     AS taches_libres,
            COUNT(*) FILTER (WHERE statut = 'en_cours')::int                    AS taches_en_cours,
            COUNT(*) FILTER (WHERE statut = 'livree'
                               AND livree_le >= NOW() - INTERVAL '30 days')::int AS taches_livrees_mois,
            COUNT(DISTINCT benevole_id) FILTER (WHERE statut = 'en_cours')::int  AS benevoles_mobilises,
            COUNT(DISTINCT projet_id) FILTER (WHERE statut = 'a_faire')::int     AS projets_en_attente
       FROM tache`,
    [],
    client
  );
  return versObjet(resultat.rows[0]);
}
