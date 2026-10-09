import { query } from '../config/database.js';
import { versListe } from '../shared/mapping.js';

const IGNOREES = [
  /\/lu$/,
  /\/read(-all)?$/,
  /^\/conversations/,
  /^\/espace-messages\/[^/]+\/lu$/,
  /\/photo$/,
  /^\/projects\/media$/,
];

const CHAMPS_DE_DECISION = ['status', 'statut', 'role', 'action', 'decision'];

const LIBELLES = {
  'POST /me/password': 'a changé son mot de passe',
  'POST /categories': 'a créé une catégorie de projet',
  'POST /projects': 'a créé un projet',
  'PATCH /projects/:id': 'a modifié un projet',
  'PATCH /projects/:id/complete': 'a terminé un projet',
  'PATCH /projects/:id/reopen': 'a rouvert un projet',
  'PATCH /projects/:id/archive': 'a archivé un projet',
  'POST /projects/:id/rapport/publication': 'a publié le rapport d’un projet',
  'DELETE /projects/:id': 'a supprimé un projet',
  'POST /projects/:projectId/beneficiaries': 'a rattaché un bénéficiaire à un projet',
  'POST /projects/:projectId/tasks': 'a créé une tâche',
  'DELETE /tasks/:id': 'a supprimé une tâche',
  'PATCH /taches/:id': 'a modifié une tâche',
  'POST /taches/:id/equipe': 'a affecté un bénévole à une tâche',
  'DELETE /taches/:id/equipe/:benevoleId': 'a retiré un bénévole d’une tâche',
  'POST /taches/:id/demandes/:benevoleId/accepter': 'a accepté la demande d’un bénévole',
  'POST /taches/:id/demandes/:benevoleId/refuser': 'a refusé la demande d’un bénévole',
  'POST /impacts': 'a enregistré un impact',
  'PATCH /impacts/:id': 'a modifié un impact',
  'DELETE /impacts/:id': 'a supprimé un impact',
  'POST /investments': 'a investi le fonds HOPE dans un projet',
  'POST /donors': 'a créé une fiche donateur',
  'PATCH /donors/:id': 'a modifié une fiche donateur',
  'POST /donors/:id/account': 'a ouvert un compte donateur',
  'PATCH /donor-accounts/:id/status': 'a changé le statut d’un compte donateur',
  'POST /donations': 'a enregistré un don',
  'PATCH /donations/:id/status': 'a changé le statut d’un don',
  'POST /donations/generate-monthly': 'a généré les échéances des dons mensuels',
  'POST /messages': 'a envoyé un message',
  'PATCH /messages/:id/reply': 'a répondu à un message',
  'POST /expenses': 'a enregistré une dépense',
  'PATCH /expenses/:id': 'a modifié une dépense',
  'PATCH /expenses/:id/cancel': 'a annulé une dépense',
  'POST /expenses/:expenseId/documents': 'a joint un justificatif à une dépense',
  'DELETE /documents/:id': 'a supprimé un justificatif',
  'POST /field-proofs': 'a ajouté une preuve de terrain',
  'DELETE /field-proofs/:id': 'a supprimé une preuve de terrain',
  'POST /team': 'a créé un compte de l’équipe',
  'PATCH /team/:id': 'a modifié un compte de l’équipe',
  'PATCH /team/:id/password': 'a réinitialisé le mot de passe d’un membre de l’équipe',
  'POST /backoffice': 'a créé un compte back office',
  'PATCH /backoffice/:id': 'a modifié un compte back office',
  'POST /backoffice/:id/acces': 'a renvoyé un mot de passe back office',
  'POST /utilisateurs/comptes': 'a créé un compte bénévole ou bailleur',
  'PATCH /utilisateurs/comptes/:id': 'a modifié le compte d’un utilisateur',
  'DELETE /utilisateurs/comptes/:id': 'a supprimé le compte d’un utilisateur',
  'DELETE /utilisateurs/fiches/:id': 'a supprimé une fiche donateur',
  'POST /volunteers/:id/activate': 'a validé un compte bénévole',
  'PATCH /volunteers/:id/status': 'a changé le statut d’un bénévole',
  'POST /consulter/:id': 'a consulté l’espace d’un utilisateur',
  'POST /publications': 'a publié une actualité',
  'PATCH /publications/:id': 'a modifié une actualité',
  'DELETE /publications/:id': 'a supprimé une actualité',
  'PATCH /publications/interets/:id': 'a traité une manifestation d’intérêt',
  'POST /funders/:id/activate': 'a validé un compte bailleur',
  'PATCH /funders/:id/status': 'a changé le statut d’un bailleur',
  'POST /beneficiaries': 'a enregistré un bénéficiaire',
  'PATCH /beneficiaries/:id': 'a modifié un bénéficiaire',
  'PATCH /project-beneficiaries/:id': 'a modifié le rattachement d’un bénéficiaire',
};

function adresseIp(req) {
  return String(req.ip ?? req.socket?.remoteAddress ?? '').slice(0, 64) || null;
}

export async function consigner({
  acteurType,
  acteurId = null,
  acteurLibelle = null,
  action,
  libelle,
  cible = null,
  details = null,
  statut = null,
  ip = null,
}) {
  try {
    await query(
      `INSERT INTO journal_audit
         (acteur_type, acteur_id, acteur_libelle, action, libelle, cible, details, statut_http, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        acteurType,
        acteurId === null ? null : String(acteurId),
        acteurLibelle,
        String(action).slice(0, 160),
        String(libelle).slice(0, 300),
        cible === null ? null : String(cible).slice(0, 120),
        details ? JSON.stringify(details) : null,
        statut,
        ip,
      ]
    );
  } catch (erreur) {
    console.error('[HOPE] Journal d’audit indisponible :', erreur.message);
  }
}

export function consignerRequete(req, evenement) {
  return consigner({ ...evenement, ip: adresseIp(req) });
}

export function journaliserAdmin(req, res, suite) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return suite();
  res.on('finish', () => {
    const statut = res.statusCode;
    if (statut >= 400 && statut !== 401 && statut !== 403) return;
    const motif = req.route?.path ?? req.path;
    if (IGNOREES.some((regle) => regle.test(motif))) return;
    const cle = `${req.method} ${motif}`;
    const details = {};
    for (const champ of CHAMPS_DE_DECISION) {
      const valeur = req.body?.[champ];
      if (typeof valeur === 'string' && valeur.length <= 40) details[champ] = valeur;
    }
    const cible = req.params?.id ?? req.params?.projectId ?? req.params?.expenseId ?? null;
    consignerRequete(req, {
      acteurType: 'admin',
      acteurId: req.admin?.id ?? null,
      acteurLibelle: req.admin?.fullName ?? req.admin?.adminLog ?? null,
      action: cle,
      libelle: (statut === 401 || statut === 403 ? 'a tenté (refusé) : ' : '') + (LIBELLES[cle] ?? `a effectué ${cle}`),
      cible,
      details: Object.keys(details).length > 0 ? details : null,
      statut,
    });
  });
  return suite();
}

export async function lister(requete = {}) {
  const parPage = 50;
  const page = Math.max(1, Number.parseInt(requete.page ?? '1', 10) || 1);
  const conditions = [];
  const valeurs = [];
  if (['admin', 'utilisateur', 'systeme'].includes(requete.type)) {
    valeurs.push(requete.type);
    conditions.push(`acteur_type = $${valeurs.length}`);
  }
  if (requete.recherche && String(requete.recherche).trim() !== '') {
    valeurs.push(`%${String(requete.recherche).trim().slice(0, 80)}%`);
    conditions.push(`(libelle ILIKE $${valeurs.length} OR acteur_libelle ILIKE $${valeurs.length} OR action ILIKE $${valeurs.length})`);
  }
  const ou = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [lignes, total] = await Promise.all([
    query(
      `SELECT id, acteur_type, acteur_id, acteur_libelle, action, libelle, cible, details, statut_http, ip, cree_le
         FROM journal_audit ${ou}
        ORDER BY cree_le DESC, id DESC
        LIMIT ${parPage} OFFSET ${(page - 1) * parPage}`,
      valeurs
    ),
    query(`SELECT COUNT(*)::int AS n FROM journal_audit ${ou}`, valeurs),
  ]);
  return { items: versListe(lignes.rows), page, parPage, total: total.rows[0].n };
}
