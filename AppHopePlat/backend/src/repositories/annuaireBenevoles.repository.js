import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

const COLONNES = `
  u.id AS utilisateur_id, u.prenom, u.nom, u.photo_url,
  b.id AS benevole_id, b.profession, b.pays, b.competences, b.langues,
  b.accepte_terrain, b.accepte_distance, b.benevole_depuis, b.cree_le,
  (SELECT COUNT(*)::int FROM tache t
     JOIN tache_benevole tb ON tb.tache_id = t.id AND tb.statut = 'affectee'
    WHERE tb.benevole_id = b.id AND t.statut = 'livree') AS taches_livrees,
  (SELECT COUNT(DISTINCT t.projet_id)::int FROM tache t
     JOIN tache_benevole tb ON tb.tache_id = t.id AND tb.statut = 'affectee'
    WHERE tb.benevole_id = b.id) AS projets
`;

export async function lister(utilisateurId) {
  const resultat = await query(
    `SELECT ${COLONNES}
       FROM benevole b
       JOIN utilisateur u ON u.id = b.utilisateur_id
      WHERE u.statut = 'actif' AND u.id <> $1
        -- Un compte sans nom n'a pas encore rempli sa fiche : rien a montrer.
        AND TRIM(CONCAT(u.prenom, u.nom)) <> ''
      ORDER BY u.prenom, u.nom`,
    [utilisateurId]
  );
  return versListe(resultat.rows);
}

export async function trouver(utilisateurId) {
  const resultat = await query(
    `SELECT ${COLONNES}, b.disponibilites
       FROM benevole b
       JOIN utilisateur u ON u.id = b.utilisateur_id
      WHERE u.statut = 'actif' AND u.id = $1`,
    [utilisateurId]
  );
  return versObjet(resultat.rows[0]);
}

export async function projetsDe(benevoleId) {
  const resultat = await query(
    `SELECT p.id, p.name AS nom,
            COUNT(*) FILTER (WHERE t.statut = 'livree')::int AS taches_livrees,
            MAX(COALESCE(t.livree_le, t.prise_le, t.cree_le)) AS derniere_activite
       FROM tache t
       JOIN tache_benevole tb ON tb.tache_id = t.id AND tb.statut = 'affectee'
       JOIN projects p ON p.id = t.projet_id
      WHERE tb.benevole_id = $1
      GROUP BY p.id, p.name
      ORDER BY derniere_activite DESC NULLS LAST
      LIMIT 12`,
    [benevoleId]
  );
  return versListe(resultat.rows);
}
