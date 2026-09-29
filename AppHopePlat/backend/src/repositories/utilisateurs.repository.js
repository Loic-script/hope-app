/**
 * Repository de l'ecran "Utilisateurs" de l'administration.
 *
 * Trois publics, deux origines :
 *   - les comptes (table "utilisateur") : donateurs inscrits en ligne,
 *     benevoles, contacts des bailleurs ;
 *   - les fiches donateurs (table "donors") : les donateurs enregistres
 *     par l'equipe, a qui les dons sont rattaches.
 *
 * Aucune requete ne renvoie mot_de_passe. Les montants sont additionnes
 * en base, en NUMERIC, et rendus en texte : ils ne passent jamais par un
 * nombre a virgule flottante. Les dates sans heure sont rendues en texte,
 * pour ne pas glisser d'un jour selon le fuseau.
 */
import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

/* ================================================================
   Listes
   ================================================================ */

/**
 * Les comptes d'un role, hors comptes supprimes.
 *
 * Les jointures donateur et bailleur valent pour tous les roles : elles
 * apportent le nom de structure d'un donateur, la raison sociale d'un
 * bailleur, et restent vides ailleurs.
 */
export async function listerComptes(role, recherche = null, client = null) {
  const valeurs = [role];
  let condition = '';
  if (recherche) {
    valeurs.push(`%${recherche}%`);
    const n = valeurs.length;
    condition = `AND (u.email ILIKE $${n} OR u.nom ILIKE $${n} OR u.prenom ILIKE $${n}
                  OR d.nom_structure ILIKE $${n} OR b.raison_sociale ILIKE $${n}
                  OR (u.prenom || ' ' || u.nom) ILIKE $${n})`;
  }

  const resultat = await query(
    `SELECT u.id, u.nom, u.prenom, u.email, u.telephone, u.statut,
            u.cree_le, u.derniere_connexion,
            d.type_donateur, d.nom_structure, d.etape_suivante,
            b.id AS bailleur_id, b.raison_sociale, b.type_organisation,
            c.fonction
       FROM utilisateur u
       JOIN utilisateur_role r ON r.utilisateur_id = u.id AND r.role = $1
       LEFT JOIN donateur         d ON d.utilisateur_id = u.id
       LEFT JOIN bailleur_contact c ON c.utilisateur_id = u.id
       LEFT JOIN bailleur         b ON b.id = c.bailleur_id
      WHERE u.statut <> 'supprime' ${condition}
      ORDER BY CASE u.statut WHEN 'en_attente' THEN 0 ELSE 1 END, u.cree_le DESC`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

/** Les fiches donateurs, avec leur nombre de dons et l'etat de leur compte. */
export async function listerFiches(recherche = null, client = null) {
  const valeurs = [];
  let condition = '';
  if (recherche) {
    valeurs.push(`%${recherche}%`);
    condition = `WHERE o.first_name ILIKE $1 OR o.last_name ILIKE $1
                    OR o.organization_name ILIKE $1 OR o.email ILIKE $1
                    OR (o.first_name || ' ' || o.last_name) ILIKE $1`;
  }

  const resultat = await query(
    `SELECT o.id, o.first_name, o.last_name, o.organization_name, o.email,
            o.phone, o.city, o.country, o.origin, o.created_at,
            a.status AS compte_statut,
            COALESCE(dn.nombre, 0) AS dons_nombre
       FROM donors o
       LEFT JOIN donor_accounts a ON a.donor_id = o.id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS nombre FROM donations WHERE donor_id = o.id
       ) dn ON TRUE
       ${condition}
      ORDER BY o.created_at DESC`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

/* ================================================================
   Un compte
   ================================================================ */

/** Le compte, ses roles, et qui l'a active. */
export async function trouverCompte(id, client = null) {
  const resultat = await query(
    `SELECT u.id, u.nom, u.prenom, u.email, u.telephone, u.adresse,
            u.date_de_naissance::text AS date_de_naissance, u.photo_url,
            u.statut, u.cree_le, u.derniere_connexion, u.active_le, u.email_verifie_le,
            a.admin_log AS active_par_log,
            COALESCE(r.roles, ARRAY[]::TEXT[]) AS roles
       FROM utilisateur u
       LEFT JOIN admins a ON a.id = u.active_par
       LEFT JOIN LATERAL (
         SELECT ARRAY_AGG(role ORDER BY role) AS roles
           FROM utilisateur_role WHERE utilisateur_id = u.id
       ) r ON TRUE
      WHERE u.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Le parcours d'accueil d'un donateur inscrit, et le projet qu'il a choisi. */
export async function parcoursDonateur(utilisateurId, client = null) {
  const resultat = await query(
    `SELECT d.ville, d.pays, d.profession, d.source_connaissance,
            d.type_donateur, d.nom_structure, d.site_web, d.devise,
            d.langue, d.fuseau_horaire, d.affectation, d.projet_id,
            d.mode_paiement, d.frequence, d.etape_suivante,
            p.name AS projet_nom, p.reference AS projet_reference
       FROM donateur d
       LEFT JOIN projects p ON p.id = d.projet_id
      WHERE d.utilisateur_id = $1`,
    [utilisateurId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/**
 * Les fiches donateurs qui portent l'adresse d'un compte.
 *
 * Un donateur inscrit en ligne et une fiche saisie par l'equipe ne sont
 * pas relies en base ; la meme adresse electronique les designe pourtant
 * comme la meme personne, et ses dons doivent se lire sur son profil.
 */
export async function fichesDeLAdresse(email, client = null) {
  if (!email) return [];
  const resultat = await query(
    'SELECT id FROM donors WHERE LOWER(email) = LOWER($1)',
    [email],
    client
  );
  return resultat.rows.map((ligne) => ligne.id);
}

/** La fiche de terrain d'un benevole, notes internes comprises. */
export async function ficheBenevole(utilisateurId, client = null) {
  const resultat = await query(
    `SELECT b.id, b.profession, b.competences, b.langues, b.disponibilites,
            b.accepte_terrain, b.accepte_distance,
            b.contact_urgence_nom, b.contact_urgence_tel,
            b.valide_par_hope, b.valide_le, b.benevole_depuis::text AS benevole_depuis,
            b.notes_internes
       FROM benevole b
      WHERE b.utilisateur_id = $1`,
    [utilisateurId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Les missions auxquelles un benevole s'est inscrit, avec leur projet. */
export async function missionsDuBenevole(benevoleId, client = null) {
  const resultat = await query(
    `SELECT i.id, i.statut, i.inscrit_le, i.heures_validees,
            m.titre, m.format, m.date_debut, m.date_fin, m.lieu_nom,
            p.id AS projet_id, p.name AS projet_nom
       FROM inscription_mission i
       JOIN mission  m ON m.id = i.mission_id
       JOIN projects p ON p.id = m.projet_id
      WHERE i.benevole_id = $1
      ORDER BY m.date_debut DESC`,
    [benevoleId],
    client
  );
  return versListe(resultat.rows);
}

/** L'organisation d'un contact bailleur, notes internes comprises. */
export async function organisationDuContact(utilisateurId, client = null) {
  const resultat = await query(
    `SELECT b.id, b.raison_sociale, b.type_organisation, b.secteur, b.pays,
            b.adresse, b.site_web, b.nif,
            b.partenaire_depuis::text AS partenaire_depuis,
            b.statut, b.niveau, b.notes_internes,
            c.fonction, c.contact_principal
       FROM bailleur_contact c
       JOIN bailleur b ON b.id = c.bailleur_id
      WHERE c.utilisateur_id = $1`,
    [utilisateurId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Les projets qu'un bailleur finance : ce qu'il a affecte a chacun. */
export async function projetsFinances(bailleurId, client = null) {
  const resultat = await query(
    `SELECT p.id, p.name AS nom, p.reference, p.status AS statut, e.devise,
            SUM(a.montant)::text AS montant,
            MAX(a.date_affectation)::text AS derniere_affectation,
            ARRAY_AGG(DISTINCT e.intitule) AS engagements
       FROM affectation a
       JOIN engagement e ON e.id = a.engagement_id
       JOIN projects   p ON p.id = a.projet_id
      WHERE e.bailleur_id = $1
      GROUP BY p.id, p.name, p.reference, p.status, e.devise
      ORDER BY SUM(a.montant) DESC`,
    [bailleurId],
    client
  );
  return versListe(resultat.rows);
}

/**
 * Les totaux d'un bailleur, devise par devise : ce qu'il a promis, ce
 * qui est arrive, ce qui a ete reparti entre les projets.
 */
export async function totauxBailleur(bailleurId, client = null) {
  const resultat = await query(
    `WITH engage AS (
       SELECT devise, SUM(montant_engage) AS montant
         FROM engagement
        WHERE bailleur_id = $1 AND type_soutien = 'financier' AND statut <> 'annule'
        GROUP BY devise
     ), recu AS (
       SELECT v.devise, SUM(v.montant) AS montant
         FROM versement v JOIN engagement e ON e.id = v.engagement_id
        WHERE e.bailleur_id = $1 AND v.statut = 'recu'
        GROUP BY v.devise
     ), affecte AS (
       SELECT e.devise, SUM(a.montant) AS montant, COUNT(DISTINCT a.projet_id)::int AS projets
         FROM affectation a JOIN engagement e ON e.id = a.engagement_id
        WHERE e.bailleur_id = $1
        GROUP BY e.devise
     ), devises AS (
       SELECT devise FROM engage UNION SELECT devise FROM recu UNION SELECT devise FROM affecte
     )
     SELECT d.devise,
            COALESCE(engage.montant, 0)::text  AS engage,
            COALESCE(recu.montant, 0)::text    AS recu,
            COALESCE(affecte.montant, 0)::text AS affecte,
            COALESCE(affecte.projets, 0)       AS projets
       FROM devises d
       LEFT JOIN engage  ON engage.devise  = d.devise
       LEFT JOIN recu    ON recu.devise    = d.devise
       LEFT JOIN affecte ON affecte.devise = d.devise
      ORDER BY d.devise`,
    [bailleurId],
    client
  );
  return versListe(resultat.rows);
}

/* ================================================================
   Une fiche donateur, et les dons
   ================================================================ */

export async function trouverFiche(id, client = null) {
  const resultat = await query(
    `SELECT o.id, o.first_name, o.last_name, o.organization_name, o.email,
            o.phone, o.country, o.city, o.origin, o.created_at,
            a.id AS compte_id, a.status AS compte_statut, a.email AS compte_email,
            a.last_login_at AS compte_derniere_connexion
       FROM donors o
       LEFT JOIN donor_accounts a ON a.donor_id = o.id
      WHERE o.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Les dons de plusieurs fiches, du plus recent au plus ancien. */
export async function donsDesFiches(ficheIds, client = null) {
  if (ficheIds.length === 0) return [];
  const resultat = await query(
    `SELECT d.id, d.reference, d.amount::text AS montant, d.currency AS devise,
            d.allocation, d.project_id AS projet_id, p.name AS projet_nom,
            d.frequency AS frequence, d.payment_method AS moyen,
            d.status AS statut, d.received_at AS recu_le
       FROM donations d
       LEFT JOIN projects p ON p.id = d.project_id
      WHERE d.donor_id = ANY($1::int[])
      ORDER BY d.received_at DESC, d.id DESC`,
    [ficheIds],
    client
  );
  return versListe(resultat.rows);
}

/**
 * Ce que ces fiches ont donne, en dons recus seulement : le total par
 * devise, la part laissee au fonds HOPE, et le detail par projet.
 */
export async function syntheseDons(ficheIds, client = null) {
  if (ficheIds.length === 0) return { totaux: [], projets: [] };
  const [totaux, projets] = await Promise.all([
    query(
      `SELECT currency AS devise,
              SUM(amount)::text AS total,
              COALESCE(SUM(amount) FILTER (WHERE allocation = 'HOPE'), 0)::text AS fonds_hope,
              COUNT(*)::int AS nombre
         FROM donations
        WHERE donor_id = ANY($1::int[]) AND status = 'RECEIVED'
        GROUP BY currency
        ORDER BY currency`,
      [ficheIds],
      client
    ),
    query(
      `SELECT p.id, p.name AS nom, p.reference, d.currency AS devise,
              SUM(d.amount)::text AS montant, COUNT(*)::int AS nombre
         FROM donations d
         JOIN projects p ON p.id = d.project_id
        WHERE d.donor_id = ANY($1::int[]) AND d.status = 'RECEIVED'
          AND d.allocation = 'PROJECT'
        GROUP BY p.id, p.name, p.reference, d.currency
        ORDER BY SUM(d.amount) DESC`,
      [ficheIds],
      client
    ),
  ]);
  return { totaux: versListe(totaux.rows), projets: versListe(projets.rows) };
}

/* ================================================================
   Ecritures
   ================================================================ */

/** Les coordonnees d'un compte. Les colonnes arrivent deja validees. */
export async function modifierCompte(id, { nom, prenom, email, telephone }, client = null) {
  await query(
    `UPDATE utilisateur
        SET nom = $2, prenom = $3, email = $4, telephone = $5
      WHERE id = $1`,
    [id, nom, prenom, email, telephone],
    client
  );
}

/** Le nom de structure d'un donateur inscrit (NULL pour un particulier). */
export async function modifierNomStructure(utilisateurId, nomStructure, client = null) {
  await query('UPDATE donateur SET nom_structure = $2 WHERE utilisateur_id = $1', [
    utilisateurId,
    nomStructure,
  ], client);
}

/** La raison sociale de l'organisation d'un contact bailleur. */
export async function modifierRaisonSociale(bailleurId, raisonSociale, client = null) {
  await query('UPDATE bailleur SET raison_sociale = $2 WHERE id = $1', [
    bailleurId,
    raisonSociale,
  ], client);
}

/**
 * Supprime une fiche donateur.
 *
 * Le service a verifie qu'aucun don ne s'y rattache : la base le refuse
 * de toute facon (donations.donor_id ON DELETE RESTRICT).
 */
export async function supprimerFiche(id, client = null) {
  const resultat = await query('DELETE FROM donors WHERE id = $1', [id], client);
  return resultat.rowCount > 0;
}

/**
 * Efface l'identite d'une fiche donateur sans la supprimer.
 *
 * La ligne reste : ses dons y sont rattaches (donations.donor_id, en
 * ON DELETE RESTRICT) et comptent dans les totaux des projets. Le pays et
 * l'origine restent aussi, car les statistiques les additionnent ; tout
 * ce qui designe la personne part.
 *
 * La base exige un nom ou une raison sociale (donors_identite_presente) :
 * la fiche prend celui que les ecrans affichent deja pour un don sans
 * donateur nomme.
 */
export async function anonymiserFiche(id, client = null) {
  const resultat = await query(
    `UPDATE donors
        SET first_name = 'Donateur', last_name = 'supprimé', organization_name = NULL,
            email = NULL, phone = NULL, city = NULL, updated_at = NOW()
      WHERE id = $1`,
    [id],
    client
  );
  return resultat.rowCount > 0;
}

/**
 * Efface les dons d'une fiche : la seule facon de la supprimer ensuite,
 * la cle etant en ON DELETE RESTRICT. Les notifications qui citent ces
 * dons partent avec eux (ON DELETE CASCADE).
 *
 * Les sommes recues par les projets diminuent d'autant : a n'appeler que
 * sur demande explicite (voir utilisateurs.service).
 */
export async function supprimerDonsDeFiche(id, client = null) {
  const resultat = await query('DELETE FROM donations WHERE donor_id = $1', [id], client);
  return resultat.rowCount;
}

export async function compterDonsDeFiche(id, client = null) {
  const resultat = await query('SELECT COUNT(*)::int AS n FROM donations WHERE donor_id = $1', [
    id,
  ], client);
  return resultat.rows[0].n;
}
