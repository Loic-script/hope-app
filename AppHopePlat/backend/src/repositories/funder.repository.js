/**
 * Repository de l'espace bailleur.
 *
 * Regle de securite qui gouverne tout ce fichier : l'espace se filtre
 * sur bailleur_id, jamais sur utilisateur_id. Un bailleur peut avoir
 * plusieurs contacts avec un compte ; filtrer par personne cacherait a
 * l'un ce que l'autre voit.
 *
 * notes_internes ne sort jamais d'ici : elle est reservee a HOPE.
 */
import { query, transaction } from '../config/database.js';
import { construireSet, versListe, versObjet } from '../shared/mapping.js';
import { COLONNES_PUBLICATION, PROJET_ET_FINANCEMENT } from './publication.repository.js';

/* ================================================================
   Organisation et contacts
   ================================================================ */

const COLONNES_BAILLEUR = `
  b.id, b.raison_sociale, b.type_organisation, b.secteur, b.pays,
  b.adresse, b.site_web, b.logo_url, b.nif, b.partenaire_depuis,
  b.statut, b.niveau, b.cree_le
`;

/**
 * Cree l'organisation, son contact principal et le compte associe.
 *
 * Les trois vont ensemble : un bailleur sans contact ne pourrait pas se
 * connecter, et un contact sans organisation ne menerait a rien.
 */
export async function creerAvecContact(organisation, utilisateurId, fonction, client = null) {
  const executer = async (transaction_) => {
    const bailleur = await query(
      `INSERT INTO bailleur (raison_sociale, type_organisation, secteur, pays, site_web)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        organisation.raisonSociale,
        organisation.typeOrganisation,
        organisation.secteur ?? null,
        organisation.pays ?? 'Madagascar',
        organisation.siteWeb ?? null,
      ],
      transaction_
    );

    const bailleurId = bailleur.rows[0].id;

    await query(
      `INSERT INTO bailleur_contact
         (bailleur_id, utilisateur_id, fonction, contact_principal)
       VALUES ($1, $2, $3, TRUE)`,
      [bailleurId, utilisateurId, fonction ?? null],
      transaction_
    );

    return bailleurId;
  };

  return client ? executer(client) : transaction(executer);
}

/**
 * Resout le bailleur d'un compte connecte.
 *
 * C'est le point d'entree de tout l'espace : sans lui, aucune requete
 * ne sait de quelle organisation elle parle.
 */
export async function trouverParUtilisateur(utilisateurId, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES_BAILLEUR},
            c.id               AS contact_id,
            c.fonction,
            c.contact_principal,
            c.peut_consulter,
            c.peut_telecharger,
            c.actif             AS contact_actif,
            u.nom, u.prenom, u.email, u.telephone, u.photo_url
       FROM bailleur_contact c
       JOIN bailleur    b ON b.id = c.bailleur_id
       JOIN utilisateur u ON u.id = c.utilisateur_id
      WHERE c.utilisateur_id = $1`,
    [utilisateurId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Met a jour les champs facultatifs de l'organisation d'un contact. */
/**
 * Met a jour la fiche d'une organisation.
 *
 * Les colonnes arrivent deja nommees comme en base : la liste de ce qui
 * est modifiable est arretee par le service, pas ici.
 */
export async function mettreAJourOrganisation(bailleurId, colonnes, client = null) {
  const { clause, valeurs, vide } = construireSet(colonnes, 2);
  if (vide) return;

  await query(`UPDATE bailleur SET ${clause} WHERE id = $1`, [bailleurId, ...valeurs], client);
}

export async function mettreAJourOrganisationParUtilisateur(
  utilisateurId,
  colonnes,
  client = null
) {
  const { clause, valeurs, vide } = construireSet(colonnes, 2);
  if (vide) return;

  await query(
    `UPDATE bailleur b SET ${clause}
       FROM bailleur_contact c
      WHERE c.bailleur_id = b.id AND c.utilisateur_id = $1`,
    [utilisateurId, ...valeurs],
    client
  );
}

/** Met a jour la fiche de contact d'une personne. */
/**
 * Pose la photo sur le compte rattache a ce contact.
 *
 * On passe par le contact plutot que par l'utilisateur : c'est son
 * identifiant que porte le jeton du bailleur.
 */
export async function mettreAJourPhoto(contactId, photoUrl, client = null) {
  await query(
    `UPDATE utilisateur u
        SET photo_url = $2
       FROM bailleur_contact c
      WHERE c.id = $1 AND u.id = c.utilisateur_id`,
    [contactId, photoUrl],
    client
  );
}

/**
 * Le nom, le prenom et le telephone de la personne derriere un contact.
 *
 * Ils vivent sur le compte, comme la photo : c'est la personne, et non
 * son role dans l'organisation.
 */
export async function mettreAJourIdentite(contactId, colonnes, client = null) {
  const { clause, valeurs, vide } = construireSet(colonnes, 2);
  if (vide) return;

  await query(
    `UPDATE utilisateur u
        SET ${clause}
       FROM bailleur_contact c
      WHERE c.id = $1 AND u.id = c.utilisateur_id`,
    [contactId, ...valeurs],
    client
  );
}

export async function mettreAJourContact(contactId, colonnes, client = null) {
  const { clause, valeurs, vide } = construireSet(colonnes, 2);
  if (vide) return;

  await query(
    `UPDATE bailleur_contact SET ${clause} WHERE id = $1`,
    [contactId, ...valeurs],
    client
  );
}

/** Les autres personnes de l'organisation, pour le profil. */
export async function listerContacts(bailleurId, client = null) {
  const resultat = await query(
    `SELECT c.id, c.fonction, c.contact_principal, c.actif,
            u.nom, u.prenom, u.email, u.photo_url
       FROM bailleur_contact c
       LEFT JOIN utilisateur u ON u.id = c.utilisateur_id
      WHERE c.bailleur_id = $1
      ORDER BY c.contact_principal DESC, u.nom NULLS LAST`,
    [bailleurId],
    client
  );
  return versListe(resultat.rows);
}

/** Les distinctions obtenues : le badge "Partenaire Or" et les autres. */
export async function listerDistinctions(bailleurId, client = null) {
  const resultat = await query(
    `SELECT d.code, d.libelle, d.regle, bd.obtenue_le
       FROM bailleur_distinction bd
       JOIN distinction d ON d.code = bd.distinction_code
      WHERE bd.bailleur_id = $1
      ORDER BY bd.obtenue_le`,
    [bailleurId],
    client
  );
  return versListe(resultat.rows);
}

/* ================================================================
   Indicateurs du tableau de bord
   ================================================================ */

/**
 * Les quatre chiffres du haut de page.
 *
 * Aucun n'est stocke : ce sont des agregats. Une colonne figee se
 * desynchroniserait des la saisie du versement suivant.
 *
 * Les trois sous-requetes sont separees a dessein. Reunies en une
 * seule jointure, versements et affectations se multiplieraient l'un
 * par l'autre et gonfleraient les sommes -- c'est precisement le
 * double comptage a eviter.
 */
export async function indicateurs(bailleurId, client = null) {
  const resultat = await query(
    `WITH engage AS (
       SELECT COALESCE(SUM(montant_engage), 0) AS total
         FROM engagement
        WHERE bailleur_id = $1 AND statut <> 'annule'
     ),
     recu AS (
       SELECT COALESCE(SUM(v.montant), 0) AS total
         FROM versement v
         JOIN engagement e ON e.id = v.engagement_id
        WHERE e.bailleur_id = $1 AND v.statut = 'recu'
     ),
     attendu AS (
       SELECT COALESCE(SUM(v.montant), 0) AS total
         FROM versement v
         JOIN engagement e ON e.id = v.engagement_id
        WHERE e.bailleur_id = $1 AND v.statut IN ('attendu', 'en_retard')
     ),
     projets AS (
       SELECT COUNT(DISTINCT a.projet_id)::int AS nombre,
              -- Les beneficiaires des projets finances, comptes une
              -- seule fois meme si deux engagements les financent.
              COALESCE(SUM(p.beneficiary_target), 0)::int AS beneficiaires
         FROM (
           SELECT DISTINCT a.projet_id
             FROM affectation a
             JOIN engagement e ON e.id = a.engagement_id
            WHERE e.bailleur_id = $1
         ) a
         JOIN projects p ON p.id = a.projet_id
     )
     SELECT engage.total   AS montant_engage,
            recu.total     AS montant_recu,
            attendu.total  AS montant_attendu,
            ROUND(100.0 * recu.total / NULLIF(engage.total, 0), 0) AS taux_execution,
            projets.nombre        AS projets_finances,
            projets.beneficiaires AS beneficiaires_touches
       FROM engage, recu, attendu, projets`,
    [bailleurId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/**
 * Repartition des montants affectes par domaine.
 *
 * Le domaine se lit dans project_categories : le modele annoncait une
 * colonne "domaine" sur le projet, elle n'existe pas ici.
 */
export async function repartitionParDomaine(bailleurId, client = null) {
  const resultat = await query(
    `SELECT COALESCE(c.name, 'Sans domaine') AS domaine,
            SUM(a.montant)                   AS montant,
            COUNT(DISTINCT a.projet_id)::int AS projets
       FROM affectation a
       JOIN engagement e ON e.id = a.engagement_id
       JOIN projects   p ON p.id = a.projet_id
       LEFT JOIN project_categories c ON c.id = p.category_id
      WHERE e.bailleur_id = $1
      GROUP BY COALESCE(c.name, 'Sans domaine')
      ORDER BY montant DESC`,
    [bailleurId],
    client
  );
  return versListe(resultat.rows);
}

/** Zones d'intervention, deduites de projects.location. */
export async function zonesDIntervention(bailleurId, client = null) {
  const resultat = await query(
    `SELECT COALESCE(p.location, 'Non precisee') AS zone,
            COUNT(DISTINCT p.id)::int           AS projets,
            SUM(a.montant)                      AS montant
       FROM affectation a
       JOIN engagement e ON e.id = a.engagement_id
       JOIN projects   p ON p.id = a.projet_id
      WHERE e.bailleur_id = $1
      GROUP BY COALESCE(p.location, 'Non precisee')
      ORDER BY projets DESC, montant DESC`,
    [bailleurId],
    client
  );
  return versListe(resultat.rows);
}

/**
 * Ce qu'un bailleur voit des projets.
 *
 * Tous les projets HOPE en cours ou termines : les projets internes
 * font evoluer l'association elle-meme et restent a l'equipe, les
 * archives sont retires. S'y ajoutent, quels qu'ils soient, les projets
 * que CE bailleur finance -- un partenaire ne perd pas de vue un projet
 * ou son argent est affecte parce que l'equipe l'a archive.
 *
 * $1 est le bailleur_id ; "p" designe le projet.
 */
const PROJET_VISIBLE = `
  (
    (p.project_type = 'HOPE' AND p.status IN ('IN_PROGRESS', 'COMPLETED'))
    OR EXISTS (
      SELECT 1
        FROM affectation a
        JOIN engagement e ON e.id = a.engagement_id
       WHERE a.projet_id = p.id AND e.bailleur_id = $1
    )
  )
`;

/**
 * Les projets visibles par ce bailleur, avec ce qu'il y a affecte.
 *
 * Le montant affecte est celui de CE bailleur, pas le budget total du
 * projet : sinon il croirait avoir finance plus qu'en realite. Il vaut 0
 * sur un projet qu'il ne finance pas.
 *
 * Le financement du projet reprend la "somme investie" de la fiche et
 * du rapport -- dons recus et investissements de HOPE -- pour que la
 * carte et le rapport disent le meme chiffre.
 *
 * Rien d'identifiant : ni nom de donateur, ni beneficiaire. La photo
 * n'est rendue que si le media du projet en est une.
 */
export async function projetsVisibles(bailleurId, client = null) {
  const resultat = await query(
    `SELECT p.id, p.reference, p.name, p.status, p.project_type,
            p.description_titre, p.description, p.location,
            p.start_date, p.completed_at,
            p.beneficiary_target, p.required_budget, p.currency,
            CASE WHEN p.media_type = 'PHOTO' THEN p.media_url END AS photo_url,
            c.name                         AS categorie,
            (don.montant + inv.montant)    AS montant_finance,
            COALESCE(moi.montant, 0)       AS montant_affecte,
            moi.engagements,
            moi.derniere                   AS derniere_affectation
       FROM projects p
       LEFT JOIN project_categories c ON c.id = p.category_id
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(amount), 0) AS montant
           FROM donations
          WHERE project_id = p.id AND status = 'RECEIVED'
       ) don ON TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(amount), 0) AS montant
           FROM investments WHERE project_id = p.id
       ) inv ON TRUE
       LEFT JOIN LATERAL (
         SELECT SUM(a.montant)          AS montant,
                COUNT(*)::int           AS engagements,
                MAX(a.date_affectation) AS derniere
           FROM affectation a
           JOIN engagement e ON e.id = a.engagement_id
          WHERE a.projet_id = p.id AND e.bailleur_id = $1
       ) moi ON TRUE
      WHERE ${PROJET_VISIBLE}
      -- Ceux qu'il finance d'abord, puis les projets en cours, les plus
      -- recents en tete.
      ORDER BY COALESCE(moi.montant, 0) DESC,
               (p.status = 'IN_PROGRESS') DESC,
               p.start_date DESC, p.id DESC`,
    [bailleurId],
    client
  );
  return versListe(resultat.rows);
}

/**
 * Le projet est-il visible par ce bailleur ?
 *
 * La meme regle que la liste : un identifiant devine ne donne pas a lire
 * le rapport d'un projet interne.
 */
export async function projetVisible(bailleurId, projetId, client = null) {
  const resultat = await query(
    `SELECT p.id, p.reference, p.name
       FROM projects p
      WHERE p.id = $2 AND ${PROJET_VISIBLE}`,
    [bailleurId, projetId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/**
 * Part de l'institutionnel face a l'individuel, tous financeurs
 * confondus. C'est le 71 % / 29 % de la maquette.
 */
export async function origineDesFonds(client = null) {
  const resultat = await query(
    `SELECT
       (SELECT COALESCE(SUM(montant), 0) FROM affectation)          AS institutionnel,
       (SELECT COALESCE(SUM(amount), 0) FROM donations
         WHERE status = 'RECEIVED')                                 AS individuel`,
    [],
    client
  );
  return versObjet(resultat.rows[0]);
}

/* ================================================================
   Engagements et versements
   ================================================================ */

/**
 * Les engagements du bailleur, avec ce qui a ete verse et affecte.
 *
 * Les deux sous-requetes laterales restent separees pour la meme
 * raison que dans indicateurs() : jointes a plat, elles se
 * multiplieraient.
 */
export async function listerEngagements(bailleurId, client = null) {
  const resultat = await query(
    `SELECT e.id, e.intitule, e.type_soutien, e.montant_engage, e.devise,
            e.unite, e.quantite_engagee, e.quantite_realisee, e.valorisation,
            e.date_signature, e.date_debut, e.date_fin,
            e.reference_convention, e.convention_url,
            e.affectation_libre, e.statut, e.cree_le,
            COALESCE(v.recu, 0)      AS montant_recu,
            COALESCE(v.attendu, 0)   AS montant_attendu,
            COALESCE(v.nombre, 0)    AS versements_nombre,
            COALESCE(a.affecte, 0)   AS montant_affecte,
            COALESCE(a.projets, 0)   AS projets_nombre
       FROM engagement e
       LEFT JOIN LATERAL (
         SELECT SUM(montant) FILTER (WHERE statut = 'recu')                AS recu,
                SUM(montant) FILTER (WHERE statut IN ('attendu','en_retard')) AS attendu,
                COUNT(*)::int                                              AS nombre
           FROM versement WHERE engagement_id = e.id
       ) v ON TRUE
       LEFT JOIN LATERAL (
         SELECT SUM(montant) AS affecte, COUNT(*)::int AS projets
           FROM affectation WHERE engagement_id = e.id
       ) a ON TRUE
      WHERE e.bailleur_id = $1
      ORDER BY e.date_debut DESC`,
    [bailleurId],
    client
  );
  return versListe(resultat.rows);
}

/**
 * Historique des versements.
 *
 * @param {{ recusSeulement?: boolean }} filtres
 */
export async function listerVersements(bailleurId, filtres = {}, client = null) {
  const valeurs = [bailleurId];
  let condition = '';

  if (filtres.recusSeulement) {
    condition = `AND v.statut = 'recu'`;
  }

  const resultat = await query(
    `SELECT v.id, v.numero_tranche, v.montant, v.devise, v.date_prevue,
            v.date_recue, v.moyen, v.reference_bancaire, v.justificatif_url,
            v.statut, e.id AS engagement_id, e.intitule AS engagement_intitule
       FROM versement v
       JOIN engagement e ON e.id = v.engagement_id
      WHERE e.bailleur_id = $1 ${condition}
      ORDER BY
        -- Les versements recus d'abord, du plus recent au plus ancien ;
        -- les attendus ensuite, par echeance.
        CASE WHEN v.statut = 'recu' THEN 0 ELSE 1 END,
        v.date_recue DESC NULLS LAST,
        v.date_prevue ASC NULLS LAST`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

/** Les affectations d'un engagement, projet par projet. */
export async function listerAffectations(bailleurId, engagementId = null, client = null) {
  const valeurs = [bailleurId];
  let condition = '';
  if (engagementId) {
    valeurs.push(engagementId);
    condition = `AND a.engagement_id = $${valeurs.length}`;
  }

  const resultat = await query(
    `SELECT a.id, a.engagement_id, a.projet_id, a.montant,
            a.date_affectation, a.commentaire,
            p.name AS projet_nom, p.reference AS projet_reference,
            e.intitule AS engagement_intitule
       FROM affectation a
       JOIN engagement e ON e.id = a.engagement_id
       JOIN projects   p ON p.id = a.projet_id
      WHERE e.bailleur_id = $1 ${condition}
      ORDER BY a.date_affectation DESC`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

/* ================================================================
   Documents
   ================================================================ */

/**
 * Les documents du bailleur.
 *
 * @param {{ type?: string }} filtres
 */
export async function listerDocuments(bailleurId, filtres = {}, client = null) {
  const valeurs = [bailleurId];
  let condition = '';
  if (filtres.type) {
    valeurs.push(filtres.type);
    condition = `AND d.type = $${valeurs.length}`;
  }

  const resultat = await query(
    `SELECT d.id, d.type, d.titre, d.periode_debut, d.periode_fin,
            d.fichier_url, d.nb_pages, d.genere_auto, d.publie_le,
            d.telecharge_le, d.nb_telechargements,
            e.intitule AS engagement_intitule,
            p.name     AS projet_nom
       FROM document_bailleur d
       LEFT JOIN engagement e ON e.id = d.engagement_id
       LEFT JOIN projects   p ON p.id = d.projet_id
      WHERE d.bailleur_id = $1 ${condition}
      ORDER BY d.publie_le DESC`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

/** Nombre de documents par type, pour les onglets. */
export async function compterDocuments(bailleurId, client = null) {
  const resultat = await query(
    `SELECT type, COUNT(*)::int AS nombre
       FROM document_bailleur
      WHERE bailleur_id = $1
      GROUP BY type`,
    [bailleurId],
    client
  );

  const compteurs = {
    rapport_impact: 0,
    justificatif_financier: 0,
    certificat: 0,
    convention: 0,
  };
  for (const ligne of resultat.rows) compteurs[ligne.type] = ligne.nombre;
  return compteurs;
}

/**
 * Retrouve un document en verifiant qu'il appartient bien au bailleur.
 *
 * Le controle est ici et pas seulement dans le service : c'est la
 * seule barriere entre un identifiant devine et le rapport d'un autre
 * partenaire.
 */
export async function trouverDocument(bailleurId, documentId, client = null) {
  const resultat = await query(
    `SELECT id, bailleur_id, type, titre, fichier_url, nb_telechargements
       FROM document_bailleur
      WHERE id = $1 AND bailleur_id = $2`,
    [documentId, bailleurId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/**
 * Le contenu d'un document, pour le lire dans l'espace.
 *
 * Cherche AVEC le bailleur_id, comme le telechargement : un identifiant
 * devine ne donne pas a lire le rapport d'un autre partenaire.
 *
 * L'adresse du fichier n'est pas renvoyee : l'apercu ne doit donner lieu
 * a aucune requete vers le PDF.
 */
export async function apercuDocument(bailleurId, documentId, client = null) {
  const resultat = await query(
    `SELECT d.id, d.type, d.titre, d.periode_debut, d.periode_fin,
            d.nb_pages, d.publie_le, d.contenu,
            e.intitule AS engagement_intitule,
            p.name     AS projet_nom
       FROM document_bailleur d
       LEFT JOIN engagement e ON e.id = d.engagement_id
       LEFT JOIN projects   p ON p.id = d.projet_id
      WHERE d.id = $1 AND d.bailleur_id = $2`,
    [documentId, bailleurId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Enregistre un telechargement : HOPE saura si le rapport est lu. */
export async function marquerTelechargement(documentId, client = null) {
  const resultat = await query(
    `UPDATE document_bailleur
        SET nb_telechargements = nb_telechargements + 1,
            telecharge_le = NOW()
      WHERE id = $1
      RETURNING nb_telechargements, telecharge_le`,
    [documentId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Depose un document genere par la plateforme. */
export async function creerDocument(bailleurId, donnees, client = null) {
  const resultat = await query(
    `INSERT INTO document_bailleur
       (bailleur_id, type, titre, periode_debut, periode_fin,
        fichier_url, nb_pages, genere_auto, contenu)
     VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)
     RETURNING id, type, titre, fichier_url, publie_le`,
    [
      bailleurId,
      donnees.type,
      donnees.titre,
      donnees.periodeDebut ?? null,
      donnees.periodeFin ?? null,
      donnees.fichierUrl,
      donnees.nbPages ?? null,
      donnees.contenu ? JSON.stringify(donnees.contenu) : null,
    ],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Numero d'ordre du prochain certificat, pour HFBL-PART-000112. */
export async function prochainNumeroCertificat(client = null) {
  const resultat = await query(
    `SELECT COUNT(*)::int + 112 AS numero
       FROM document_bailleur WHERE type = 'certificat'`,
    [],
    client
  );
  return resultat.rows[0].numero;
}

/* ================================================================
   Fil d'actualite
   ================================================================ */

/**
 * Les publications diffusees aux bailleurs.
 *
 * La photo et le financement viennent du projet lie, comme dans
 * l'administration : voir publication.repository.
 */
export async function listerPublications(bailleurId, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES_PUBLICATION},
            (mi.id IS NOT NULL) AS interet_manifeste,
            mi.statut           AS interet_statut
       FROM publication pu
       ${PROJET_ET_FINANCEMENT}
       LEFT JOIN manifestation_interet mi
              ON mi.publication_id = pu.id AND mi.bailleur_id = $1
      WHERE 'bailleurs' = ANY(pu.cibles)
      ORDER BY pu.publie_le DESC
      LIMIT 30`,
    [bailleurId],
    client
  );
  return versListe(resultat.rows);
}

/** Enregistre une manifestation d'interet. Rien n'est debite. */
export async function creerManifestation(bailleurId, donnees, client = null) {
  const resultat = await query(
    `INSERT INTO manifestation_interet
       (bailleur_id, publication_id, projet_id, message, contact_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (bailleur_id, publication_id) DO UPDATE
       SET message = EXCLUDED.message, cree_le = NOW(), statut = 'nouvelle'
     RETURNING id, statut, cree_le`,
    [
      bailleurId,
      donnees.publicationId ?? null,
      donnees.projetId ?? null,
      donnees.message ?? null,
      donnees.contactId ?? null,
    ],
    client
  );
  return versObjet(resultat.rows[0]);
}
