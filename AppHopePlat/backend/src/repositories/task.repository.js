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
  p.reference AS projet_reference
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
