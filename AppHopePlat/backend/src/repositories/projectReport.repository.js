/**
 * Acces aux donnees de l'onglet Rapport d'un projet.
 *
 * Le contenu du rapport se construit a partir de la vue complete du
 * projet (project.service) ; ce fichier ne porte que ce qu'elle ignore :
 * les partenaires qui financent le projet, et les rapports deja publies.
 */
import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

/**
 * Les bailleurs dont un engagement est affecte au projet.
 *
 * Un meme bailleur peut y affecter plusieurs engagements : on les
 * additionne, il ne recevra qu'un rapport.
 */
export async function bailleursDuProjet(projetId, client = null) {
  const resultat = await query(
    `SELECT b.id, b.raison_sociale,
            SUM(a.montant)::text AS montant_affecte,
            COUNT(a.id)::int     AS engagements
       FROM affectation a
       JOIN engagement e ON e.id = a.engagement_id
       JOIN bailleur   b ON b.id = e.bailleur_id
      WHERE a.projet_id = $1
      GROUP BY b.id, b.raison_sociale
      ORDER BY b.raison_sociale`,
    [projetId],
    client
  );
  return versListe(resultat.rows);
}

/** Les rapports d'impact deja publies sur ce projet, du plus recent au plus ancien. */
export async function rapportsPublies(projetId, client = null) {
  const resultat = await query(
    `SELECT d.id, d.titre, d.type, d.publie_le, d.nb_pages,
            d.nb_telechargements, d.telecharge_le,
            b.raison_sociale AS bailleur,
            ad.full_name     AS publie_par_nom
       FROM document_bailleur d
       JOIN bailleur b     ON b.id = d.bailleur_id
       LEFT JOIN admins ad ON ad.id = d.publie_par
      WHERE d.projet_id = $1 AND d.type = 'rapport_impact'
      ORDER BY d.publie_le DESC, b.raison_sociale`,
    [projetId],
    client
  );
  return versListe(resultat.rows);
}

/** Le contenu d'un rapport publie, cherche AVEC le projet. */
export async function contenuPublie(projetId, documentId, client = null) {
  const resultat = await query(
    `SELECT d.id, d.titre, d.publie_le, d.contenu, b.raison_sociale AS bailleur
       FROM document_bailleur d
       JOIN bailleur b ON b.id = d.bailleur_id
      WHERE d.id = $1 AND d.projet_id = $2`,
    [documentId, projetId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Depose le rapport chez un bailleur. */
export async function publier(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO document_bailleur
       (bailleur_id, projet_id, type, titre, periode_debut, periode_fin,
        fichier_url, nb_pages, genere_auto, publie_par, contenu)
     VALUES ($1, $2, 'rapport_impact', $3, $4, $5, $6, $7, TRUE, $8, $9)
     RETURNING id, bailleur_id, titre, publie_le`,
    [
      donnees.bailleurId,
      donnees.projetId,
      donnees.titre,
      donnees.periodeDebut ?? null,
      donnees.periodeFin ?? null,
      donnees.fichierUrl,
      donnees.nbPages,
      donnees.publiePar ?? null,
      JSON.stringify(donnees.contenu),
    ],
    client
  );
  return versObjet(resultat.rows[0]);
}
