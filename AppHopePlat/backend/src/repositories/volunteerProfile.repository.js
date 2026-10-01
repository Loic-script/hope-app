/**
 * Repository de la fiche benevole et du journal d'heures.
 *
 * La fiche complete un compte "utilisateur" : elle porte ce qui ne sert
 * qu'au terrain. Les deux tables se lisent toujours ensemble, l'espace
 * benevole ayant besoin du nom autant que des competences.
 *
 * notes_internes ne sort jamais d'ici : elle est reservee a l'equipe
 * HOPE et n'a pas a etre exposee au benevole qu'elle decrit.
 */
import { query } from '../config/database.js';
import { construireSet, versObjet } from '../shared/mapping.js';

const COLONNES = `
  b.id, b.utilisateur_id, b.profession, b.pays, b.competences, b.langues,
  b.disponibilites, b.accepte_terrain, b.accepte_distance, b.masque_site,
  b.contact_urgence_nom, b.contact_urgence_tel,
  b.valide_par_hope, b.valide_le, b.benevole_depuis, b.cree_le,
  u.nom, u.prenom, u.email, u.telephone, u.adresse,
  u.date_de_naissance, u.photo_url, u.statut AS compte_statut
`;

/** Fiche d'un benevole, a partir de son compte utilisateur. */
export async function trouverParUtilisateur(utilisateurId, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES}
       FROM benevole b
       JOIN utilisateur u ON u.id = b.utilisateur_id
      WHERE b.utilisateur_id = $1`,
    [utilisateurId],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function trouverParId(id, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES}
       FROM benevole b
       JOIN utilisateur u ON u.id = b.utilisateur_id
      WHERE b.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

/**
 * Cree la fiche si elle manque, et la renvoie.
 *
 * Filet de securite pour les comptes crees avant l'existence de la
 * table : l'inscription pose deja la fiche.
 */
export async function garantir(utilisateurId, client = null) {
  await query(
    `INSERT INTO benevole (utilisateur_id)
     VALUES ($1)
     ON CONFLICT (utilisateur_id) DO NOTHING`,
    [utilisateurId],
    client
  );
  return trouverParUtilisateur(utilisateurId, client);
}

/**
 * Met a jour la fiche de terrain.
 *
 * @param {Record<string, unknown>} colonnes couples colonne SQL -> valeur
 */
export async function mettreAJour(id, colonnes, client = null) {
  const { clause, valeurs, vide } = construireSet(colonnes, 2);
  if (vide) return trouverParId(id, client);

  await query(`UPDATE benevole SET ${clause} WHERE id = $1`, [id, ...valeurs], client);
  return trouverParId(id, client);
}

/** Met a jour les champs qui vivent sur le compte utilisateur. */
export async function mettreAJourCompte(utilisateurId, colonnes, client = null) {
  const { clause, valeurs, vide } = construireSet(colonnes, 2);
  if (vide) return;

  await query(`UPDATE utilisateur SET ${clause} WHERE id = $1`, [utilisateurId, ...valeurs], client);
}

/**
 * Journal d'un benevole : ce qu'il a livre.
 *
 * L'espace ne propose plus que des taches. Le journal compte donc les
 * taches livrees, et non plus des heures : une tache ne porte pas de
 * duree, et en inventer une ferait mentir l'attestation qu'on en tire.
 *
 * Une tache est livree par son equipe entiere : elle compte pour chacun
 * de ses membres, pas seulement pour celui qui l'a declaree.
 */
export async function journal(benevoleId, client = null) {
  const resultat = await query(
    `SELECT COUNT(*) FILTER (WHERE t.statut = 'livree')::int                    AS taches_livrees,
            COUNT(*) FILTER (WHERE t.statut = 'en_cours')::int                  AS taches_en_cours,
            COUNT(DISTINCT t.projet_id) FILTER (WHERE t.statut = 'livree')::int AS projets_aides,
            MIN(t.livree_le) FILTER (WHERE t.statut = 'livree')                 AS premiere_livraison,
            MAX(t.livree_le) FILTER (WHERE t.statut = 'livree')                 AS derniere_livraison
       FROM tache t
       JOIN tache_benevole tb ON tb.tache_id = t.id AND tb.statut = 'affectee'
      WHERE tb.benevole_id = $1`,
    [benevoleId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Detail du journal : une ligne par tache livree, la plus recente en tete. */
export async function lignesDuJournal(benevoleId, client = null) {
  const resultat = await query(
    `SELECT t.id, t.titre, t.prise_le, t.livree_le,
            (t.validee_par IS NOT NULL) AS validee,
            p.id   AS projet_id,
            p.name AS projet_nom
       FROM tache t
       JOIN tache_benevole tb ON tb.tache_id = t.id AND tb.statut = 'affectee'
       LEFT JOIN projects p ON p.id = t.projet_id
      WHERE tb.benevole_id = $1 AND t.statut = 'livree'
      ORDER BY t.livree_le DESC NULLS LAST`,
    [benevoleId],
    client
  );
  return resultat.rows.map(versObjet);
}
