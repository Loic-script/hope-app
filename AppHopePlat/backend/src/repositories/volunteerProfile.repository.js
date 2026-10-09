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

export async function mettreAJour(id, colonnes, client = null) {
  const { clause, valeurs, vide } = construireSet(colonnes, 2);
  if (vide) return trouverParId(id, client);

  await query(`UPDATE benevole SET ${clause} WHERE id = $1`, [id, ...valeurs], client);
  return trouverParId(id, client);
}

export async function mettreAJourCompte(utilisateurId, colonnes, client = null) {
  const { clause, valeurs, vide } = construireSet(colonnes, 2);
  if (vide) return;

  await query(`UPDATE utilisateur SET ${clause} WHERE id = $1`, [utilisateurId, ...valeurs], client);
}

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
