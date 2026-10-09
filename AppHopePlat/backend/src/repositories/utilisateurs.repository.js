import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

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

export async function fichesDeLAdresse(email, client = null) {
  if (!email) return [];
  const resultat = await query(
    'SELECT id FROM donors WHERE LOWER(email) = LOWER($1)',
    [email],
    client
  );
  return resultat.rows.map((ligne) => ligne.id);
}

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

export async function modifierCompte(id, { nom, prenom, email, telephone }, client = null) {
  await query(
    `UPDATE utilisateur
        SET nom = $2, prenom = $3, email = $4, telephone = $5
      WHERE id = $1`,
    [id, nom, prenom, email, telephone],
    client
  );
}

export async function modifierNomStructure(utilisateurId, nomStructure, client = null) {
  await query('UPDATE donateur SET nom_structure = $2 WHERE utilisateur_id = $1', [
    utilisateurId,
    nomStructure,
  ], client);
}

export async function modifierRaisonSociale(bailleurId, raisonSociale, client = null) {
  await query('UPDATE bailleur SET raison_sociale = $2 WHERE id = $1', [
    bailleurId,
    raisonSociale,
  ], client);
}

export async function supprimerFiche(id, client = null) {
  const resultat = await query('DELETE FROM donors WHERE id = $1', [id], client);
  return resultat.rowCount > 0;
}

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
