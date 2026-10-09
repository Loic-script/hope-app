import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

export async function donsParMois(client = null) {
  const resultat = await query(
    `WITH mois AS (
       SELECT generate_series(
         date_trunc('month', NOW()) - INTERVAL '11 months',
         date_trunc('month', NOW()),
         INTERVAL '1 month'
       ) AS debut
     )
     SELECT TO_CHAR(m.debut, 'YYYY-MM') AS periode,
            COALESCE(SUM(d.amount) FILTER (WHERE d.allocation = 'PROJECT'), 0) AS affectes,
            COALESCE(SUM(d.amount) FILTER (WHERE d.allocation = 'HOPE'), 0)    AS hope,
            COALESCE(SUM(d.amount), 0)                                         AS total,
            COUNT(d.id)::int                                                   AS nombre
       FROM mois m
       LEFT JOIN donations d
              ON date_trunc('month', d.received_at) = m.debut
             AND d.status = 'RECEIVED'
      GROUP BY m.debut
      ORDER BY m.debut`,
    [],
    client
  );
  return versListe(resultat.rows);
}

export async function projetsParStatut(client = null) {
  const resultat = await query(
    `SELECT status,
            COUNT(*)::int                      AS nombre,
            COALESCE(SUM(required_budget), 0)  AS budget_requis
       FROM projects
      GROUP BY status
      ORDER BY nombre DESC`,
    [],
    client
  );
  return versListe(resultat.rows);
}

export async function projetsParCategorie(client = null) {
  const resultat = await query(
    `SELECT COALESCE(c.name, 'Sans catégorie') AS categorie,
            COUNT(p.id)::int                   AS nombre,
            COALESCE(SUM(p.required_budget), 0) AS budget_requis,
            COALESCE(SUM(finance.montant), 0)   AS finance
       FROM projects p
       LEFT JOIN project_categories c ON c.id = p.category_id
       LEFT JOIN LATERAL (
         SELECT COALESCE((SELECT SUM(amount) FROM donations
                           WHERE project_id = p.id AND status = 'RECEIVED'), 0)
              + COALESCE((SELECT SUM(amount) FROM investments
                           WHERE project_id = p.id), 0) AS montant
       ) finance ON TRUE
      GROUP BY 1
      ORDER BY finance DESC, nombre DESC`,
    [],
    client
  );
  return versListe(resultat.rows);
}

export async function projetsLesPlusFinances(limite = 6, client = null) {
  const resultat = await query(
    `SELECT p.id, p.reference, p.name, p.status, p.required_budget, p.currency,
            finance.montant AS funded_total,
            depense.montant AS spent_total
       FROM projects p
       LEFT JOIN LATERAL (
         SELECT COALESCE((SELECT SUM(amount) FROM donations
                           WHERE project_id = p.id AND status = 'RECEIVED'), 0)
              + COALESCE((SELECT SUM(amount) FROM investments
                           WHERE project_id = p.id), 0) AS montant
       ) finance ON TRUE
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(amount), 0) AS montant
           FROM expenses WHERE project_id = p.id AND status <> 'CANCELLED'
       ) depense ON TRUE
      ORDER BY finance.montant DESC, p.id DESC
      LIMIT $1`,
    [limite],
    client
  );
  return versListe(resultat.rows);
}

export async function repartitionDonateurs(client = null) {
  const resultat = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM donors)                                    AS total,
       (SELECT COUNT(*)::int FROM donor_accounts)                            AS avec_compte,
       (SELECT COUNT(*)::int FROM donors o
          WHERE NOT EXISTS (SELECT 1 FROM donor_accounts a WHERE a.donor_id = o.id))
                                                                             AS sans_compte,
       (SELECT COUNT(*)::int FROM donors WHERE origin = 'INTERNATIONAL')     AS internationaux,
       (SELECT COUNT(*)::int FROM donors WHERE origin = 'LOCAL')             AS locaux,
       (SELECT COUNT(*)::int FROM donations
          WHERE frequency = 'MONTHLY' AND status = 'RECEIVED')               AS dons_mensuels,
       (SELECT COUNT(*)::int FROM donations
          WHERE frequency = 'ONE_TIME' AND status = 'RECEIVED')              AS dons_ponctuels`,
    [],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function meilleursDonateurs(limite = 6, client = null) {
  const resultat = await query(
    `SELECT o.id, o.origin, o.country,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', o.first_name, o.last_name)), ''),
                     o.organization_name, 'Donateur anonyme') AS display_name,
            (a.id IS NOT NULL)         AS has_account,
            COUNT(d.id)::int           AS donations_count,
            COALESCE(SUM(d.amount), 0) AS donations_total
       FROM donors o
       LEFT JOIN donor_accounts a ON a.donor_id = o.id
       JOIN donations d ON d.donor_id = o.id AND d.status = 'RECEIVED'
      GROUP BY o.id, a.id
      ORDER BY donations_total DESC
      LIMIT $1`,
    [limite],
    client
  );
  return versListe(resultat.rows);
}

export async function repartitionParPaiement(client = null) {
  const resultat = await query(
    `SELECT COALESCE(NULLIF(TRIM(payment_method), ''), 'Non précisé') AS moyen,
            COUNT(*)::int            AS nombre,
            COALESCE(SUM(amount), 0) AS montant
       FROM donations
      WHERE status = 'RECEIVED'
      GROUP BY 1
      ORDER BY montant DESC`,
    [],
    client
  );
  return versListe(resultat.rows);
}
