/**
 * Acces aux publications -- actualites et appels a financement lus par
 * les bailleurs, actualites seules lues par les benevoles -- et aux
 * interets qu'elles recoivent.
 */
import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

/**
 * Le projet lie et son financement.
 *
 * Le financement est la "somme investie" de la fiche projet, du rapport
 * et de la page Projets du bailleur : dons recus et investissements de
 * HOPE. Un appel dit donc le meme chiffre que tout le reste.
 *
 * "pu" designe la publication.
 */
export const PROJET_ET_FINANCEMENT = `
  LEFT JOIN projects p ON p.id = pu.projet_id
  LEFT JOIN LATERAL (
    SELECT COALESCE((SELECT SUM(amount) FROM donations
                      WHERE project_id = pu.projet_id AND status = 'RECEIVED'), 0)
         + COALESCE((SELECT SUM(amount) FROM investments
                      WHERE project_id = pu.projet_id), 0) AS montant
  ) finance ON TRUE
`;

/**
 * Ce que toute lecture d'une publication rend.
 *
 * media_url est la photo affichee : la sienne, sinon celle du projet --
 * si le media du projet est bien une photo.
 */
export const COLONNES_PUBLICATION = `
  pu.id, pu.type, pu.titre, pu.corps, pu.projet_id, pu.publie_le,
  pu.media_url                                         AS photo_propre,
  CASE WHEN p.media_type = 'PHOTO' THEN p.media_url END AS photo_projet,
  COALESCE(pu.media_url,
           CASE WHEN p.media_type = 'PHOTO' THEN p.media_url END) AS media_url,
  p.name            AS projet_nom,
  p.reference       AS projet_reference,
  p.status          AS projet_statut,
  p.required_budget AS budget_projet,
  p.currency        AS devise,
  finance.montant   AS montant_finance
`;

/** Toutes les publications, avec les interets recus par chacune. */
export async function lister(client = null) {
  const resultat = await query(
    `SELECT ${COLONNES_PUBLICATION},
            COALESCE(ad.full_name, ad.admin_log) AS publie_par_nom,
            COALESCE(interets.liste, '[]'::json) AS interets
       FROM publication pu
       ${PROJET_ET_FINANCEMENT}
       LEFT JOIN admins ad ON ad.id = pu.publie_par
       LEFT JOIN LATERAL (
         SELECT json_agg(
                  json_build_object(
                    'id', mi.id,
                    'statut', mi.statut,
                    'message', mi.message,
                    'creeLe', mi.cree_le,
                    'bailleurId', b.id,
                    'organisation', b.raison_sociale,
                    'contactNom', NULLIF(TRIM(CONCAT_WS(' ', u.prenom, u.nom)), ''),
                    'contactFonction', bc.fonction,
                    'contactEmail', u.email,
                    'contactUtilisateurId', u.id,
                    'contactJoignable', COALESCE(bc.actif AND u.statut IN ('actif', 'en_attente'), FALSE)
                  ) ORDER BY mi.cree_le DESC
                ) AS liste
           FROM manifestation_interet mi
           JOIN bailleur b                ON b.id = mi.bailleur_id
           LEFT JOIN bailleur_contact bc  ON bc.id = mi.contact_id
           LEFT JOIN utilisateur u        ON u.id = bc.utilisateur_id
          WHERE mi.publication_id = pu.id
       ) interets ON TRUE
      ORDER BY pu.publie_le DESC`,
    [],
    client
  );
  return versListe(resultat.rows);
}

/**
 * Le fil de l'espace benevole : les actualites, jamais les appels a
 * financement.
 *
 * Un benevole ne voit aucun montant. La requete ne lit donc ni budget,
 * ni somme investie, ni interets : pas de PROJET_ET_FINANCEMENT ici, et
 * rien a oublier de retirer ensuite.
 *
 * La photo suit la meme regle que chez le bailleur : la sienne, sinon
 * celle du projet. Le projet lie, lui, n'est rendu que s'il est visible
 * dans l'espace -- non archive --, pour que son lien mene a une page qui
 * existe.
 */
export async function listerPourBenevole(client = null) {
  const resultat = await query(
    `SELECT pu.id, pu.titre, pu.corps, pu.publie_le,
            COALESCE(pu.media_url,
                     CASE WHEN p.media_type = 'PHOTO' THEN p.media_url END) AS media_url,
            CASE WHEN p.archived_at IS NULL THEN p.id   END AS projet_id,
            CASE WHEN p.archived_at IS NULL THEN p.name END AS projet_nom
       FROM publication pu
       LEFT JOIN projects p ON p.id = pu.projet_id
      WHERE pu.type = 'actualite'
      ORDER BY pu.publie_le DESC
      LIMIT 30`,
    [],
    client
  );
  return versListe(resultat.rows);
}

/** Une publication, pour la modifier ou la supprimer. */
export async function trouver(id, client = null) {
  const resultat = await query(
    `SELECT pu.id, pu.type, pu.titre, pu.projet_id, pu.media_url,
            (SELECT COUNT(*)::int FROM manifestation_interet
              WHERE publication_id = pu.id) AS interets
       FROM publication pu
      WHERE pu.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function creer(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO publication (type, titre, corps, projet_id, media_url, publie_par)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      donnees.type,
      donnees.titre,
      donnees.corps,
      donnees.projetId,
      donnees.mediaUrl,
      donnees.publiePar ?? null,
    ],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Remplace le contenu d'une publication. La date de publication ne bouge pas. */
export async function modifier(id, donnees, client = null) {
  const resultat = await query(
    `UPDATE publication
        SET type = $2, titre = $3, corps = $4, projet_id = $5, media_url = $6
      WHERE id = $1
      RETURNING id`,
    [id, donnees.type, donnees.titre, donnees.corps, donnees.projetId, donnees.mediaUrl],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function supprimer(id, client = null) {
  const resultat = await query(
    `DELETE FROM publication WHERE id = $1 RETURNING id, media_url`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Change l'etat du suivi d'un interet : contacte, converti, classe. */
export async function changerStatutInteret(id, statut, client = null) {
  const resultat = await query(
    `UPDATE manifestation_interet SET statut = $2 WHERE id = $1 RETURNING id, statut`,
    [id, statut],
    client
  );
  return versObjet(resultat.rows[0]);
}

/**
 * Le fichier sert-il encore ailleurs ?
 *
 * Tous les medias televerses partagent le meme dossier. Avant d'effacer
 * la photo d'une publication, on s'assure qu'aucune autre ligne ne pointe
 * dessus -- une adresse recopiee depuis un projet ou un profil ferait
 * sinon disparaitre leur image avec elle.
 */
export async function mediaEncoreUtilise(adresse, client = null) {
  const resultat = await query(
    `SELECT EXISTS (SELECT 1 FROM publication       WHERE media_url = $1)
         OR EXISTS (SELECT 1 FROM projects          WHERE media_url = $1)
         OR EXISTS (SELECT 1 FROM utilisateur       WHERE photo_url = $1)
         OR EXISTS (SELECT 1 FROM admins            WHERE photo_url = $1)
         OR EXISTS (SELECT 1 FROM bailleur          WHERE logo_url = $1)
         OR EXISTS (SELECT 1 FROM engagement        WHERE convention_url = $1)
         OR EXISTS (SELECT 1 FROM versement         WHERE justificatif_url = $1)
         OR EXISTS (SELECT 1 FROM document_bailleur WHERE fichier_url = $1) AS utilise`,
    [adresse],
    client
  );
  return resultat.rows[0].utilise;
}
