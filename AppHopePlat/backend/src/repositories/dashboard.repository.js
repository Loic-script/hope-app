import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

export async function chiffresCles(client = null) {
  const resultat = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM projects WHERE status = 'IN_PROGRESS')     AS projets_en_cours,
       (SELECT COUNT(*)::int FROM projects WHERE status = 'COMPLETED')       AS projets_termines,
       (SELECT COUNT(*)::int FROM projects)                                  AS projets_total,
       (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE status = 'RECEIVED')
                                                                             AS dons_total,
       (SELECT COALESCE(SUM(amount), 0) FROM donations
         WHERE status = 'RECEIVED' AND allocation = 'PROJECT')               AS dons_affectes,
       (SELECT COALESCE(SUM(amount), 0) FROM donations
         WHERE status = 'RECEIVED' AND allocation = 'HOPE')                  AS dons_hope,
       (SELECT COALESCE(SUM(amount), 0) FROM investments)                    AS investi,
       (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE status <> 'CANCELLED')
                                                                             AS depenses_total,
       (SELECT COUNT(*)::int FROM expenses WHERE status <> 'CANCELLED')      AS depenses_nombre,
       (SELECT COUNT(*)::int FROM donors)                                    AS donateurs_total,
       (SELECT COUNT(*)::int FROM donor_accounts)                            AS donateurs_avec_compte,
       (SELECT COUNT(*)::int FROM beneficiaries WHERE status = 'ACTIVE')     AS beneficiaires_actifs,
       (SELECT COUNT(*)::int FROM beneficiaries)                             AS beneficiaires_total,
       (SELECT COUNT(*)::int FROM supporting_documents)                      AS justificatifs_total,
       (SELECT COUNT(*)::int FROM impacts)                                   AS impacts_total,
       (SELECT COUNT(*)::int FROM notifications WHERE is_read = FALSE)       AS notifications_non_lues,
       (SELECT COUNT(*)::int FROM messages WHERE status = 'NEW')             AS messages_non_lus,
       (SELECT COALESCE(SUM(required_budget), 0) FROM projects
         WHERE status <> 'ARCHIVED')                                         AS budget_requis`,
    [],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function variationsDuMois(client = null) {
  const resultat = await query(
    `SELECT
       (SELECT COALESCE(SUM(amount), 0) FROM donations
         WHERE status = 'RECEIVED' AND received_at >= NOW() - INTERVAL '30 days') AS dons_recents,
       (SELECT COUNT(*)::int FROM donations
         WHERE status = 'RECEIVED' AND received_at >= NOW() - INTERVAL '30 days') AS dons_nombre,
       (SELECT COUNT(*)::int FROM projects
         WHERE created_at >= NOW() - INTERVAL '30 days')                          AS projets_recents,
       (SELECT COUNT(*)::int FROM donors
         WHERE created_at >= NOW() - INTERVAL '30 days')                          AS donateurs_recents,
       (SELECT COALESCE(SUM(amount), 0) FROM expenses
         WHERE status <> 'CANCELLED' AND created_at >= NOW() - INTERVAL '30 days')
                                                                                  AS depenses_recentes`,
    [],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function activitesRecentes(limite = 8, client = null) {
  const resultat = await query(
    `(SELECT 'DONATION' AS kind, d.id, d.created_at AS happened_at,
             CONCAT(
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', o.first_name, o.last_name)), ''),
                        o.organization_name, 'Un donateur anonyme'),
               ' a fait un don ',
               CASE WHEN d.frequency = 'MONTHLY' THEN 'mensuel' ELSE 'ponctuel' END,
               ' pour ',
               CASE WHEN d.allocation = 'HOPE' THEN 'HOPE' ELSE p.name END
             ) AS label,
             d.amount, d.currency, p.name AS project_name
        FROM donations d
        JOIN donors o ON o.id = d.donor_id
        LEFT JOIN projects p ON p.id = d.project_id)
     UNION ALL
     (SELECT 'INVESTMENT', i.id, i.created_at,
             CONCAT('Investissement du fonds HOPE sur ', p.name),
             i.amount, i.currency, p.name
        FROM investments i JOIN projects p ON p.id = i.project_id)
     UNION ALL
     (SELECT 'EXPENSE', e.id, e.created_at,
             CONCAT('Depense enregistree : ', LEFT(e.description, 60)),
             e.amount, e.currency, p.name
        FROM expenses e JOIN projects p ON p.id = e.project_id)
     UNION ALL
     (SELECT 'PROJECT', p.id, p.created_at,
             CONCAT('Projet cree : ', p.name), NULL, NULL, p.name
        FROM projects p)
     UNION ALL
     (SELECT 'PROJECT_COMPLETED', p.id, p.completed_at,
             CONCAT('Projet termine : ', p.name), NULL, NULL, p.name
        FROM projects p WHERE p.completed_at IS NOT NULL)
     UNION ALL
     (SELECT 'BENEFICIARY', b.id, b.created_at,
             CONCAT('Nouveau beneficiaire : ', TRIM(CONCAT_WS(' ', b.first_name, b.last_name))),
             NULL, NULL, NULL
        FROM beneficiaries b)
     UNION ALL
     (SELECT 'MESSAGE', m.id, m.created_at,
             CONCAT('Message de ', COALESCE(
               NULLIF(TRIM(CONCAT_WS(' ', o.first_name, o.last_name)), ''),
               o.organization_name, 'un donateur'), ' : ', LEFT(m.subject, 50)),
             NULL, NULL, NULL
        FROM messages m
        JOIN donor_accounts a ON a.id = m.donor_account_id
        JOIN donors o ON o.id = a.donor_id)
     ORDER BY happened_at DESC
     LIMIT $1`,
    [limite],
    client
  );
  return versListe(resultat.rows);
}
