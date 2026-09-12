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
  b.id, b.utilisateur_id, b.profession, b.competences, b.langues,
  b.disponibilites, b.rayon_km, b.accepte_terrain, b.accepte_distance,
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
 * Journal d'heures d'un benevole.
 *
 * Seules les missions ou sa presence a ete constatee comptent : une
 * inscription ne vaut pas une participation.
 */
export async function journal(benevoleId, client = null) {
  const resultat = await query(
    `SELECT COALESCE(SUM(i.heures_validees), 0)                     AS heures_donnees,
            COUNT(*) FILTER (WHERE i.statut = 'present')::int        AS missions_realisees,
            COUNT(*) FILTER (WHERE i.statut = 'annule')::int         AS missions_annulees,
            COUNT(*)::int                                            AS inscriptions_total,
            MIN(m.date_debut) FILTER (WHERE i.statut = 'present')    AS premiere_mission,
            MAX(m.date_debut) FILTER (WHERE i.statut = 'present')    AS derniere_mission
       FROM inscription_mission i
       JOIN mission m ON m.id = i.mission_id
      WHERE i.benevole_id = $1`,
    [benevoleId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Detail du journal : une ligne par mission effectuee. */
export async function lignesDuJournal(benevoleId, client = null) {
  const resultat = await query(
    `SELECT m.id AS mission_id, m.titre, m.date_debut, m.format,
            i.heures_validees, i.statut,
            p.name AS projet_nom
       FROM inscription_mission i
       JOIN mission m ON m.id = i.mission_id
       LEFT JOIN projects p ON p.id = m.projet_id
      WHERE i.benevole_id = $1 AND i.statut = 'present'
      ORDER BY m.date_debut DESC`,
    [benevoleId],
    client
  );
  return resultat.rows.map(versObjet);
}
