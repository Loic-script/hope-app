/**
 * Repository des dons.
 *
 *   allocation = 'PROJECT' : don affecte, il finance directement un projet
 *   allocation = 'HOPE'    : don non affecte, il alimente le fonds HOPE
 */
import { query } from '../config/database.js';
import { construireSet, versListe, versObjet } from '../shared/mapping.js';

const COLONNES = `
  d.id, d.reference, d.donor_id, d.donor_account_id, d.amount, d.currency,
  d.allocation, d.project_id, d.frequency, d.payment_method,
  d.payment_reference, d.status, d.received_at, d.message,
  d.created_at, d.updated_at,
  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', o.first_name, o.last_name)), ''),
           o.organization_name, 'Donateur anonyme') AS donor_name,
  o.origin              AS donor_origin,
  o.country             AS donor_country,
  (d.donor_account_id IS NOT NULL) AS from_account,
  p.name                AS project_name,
  p.reference           AS project_reference
`;

const JOINTURES = `
  JOIN donors o    ON o.id = d.donor_id
  LEFT JOIN projects p ON p.id = d.project_id
`;

/**
 * @param {{ allocation?: string, frequence?: string, statut?: string,
 *           origine?: string, projectId?: number, donorId?: number,
 *           recherche?: string, limite?: number, decalage?: number }} filtres
 */
export async function lister(filtres = {}, client = null) {
  const conditions = [];
  const valeurs = [];

  if (filtres.allocation) {
    valeurs.push(filtres.allocation);
    conditions.push(`d.allocation = $${valeurs.length}`);
  }
  if (filtres.frequence) {
    valeurs.push(filtres.frequence);
    conditions.push(`d.frequency = $${valeurs.length}`);
  }
  if (filtres.statut) {
    valeurs.push(filtres.statut);
    conditions.push(`d.status = $${valeurs.length}`);
  }
  if (filtres.origine) {
    valeurs.push(filtres.origine);
    conditions.push(`o.origin = $${valeurs.length}`);
  }
  if (filtres.projectId) {
    valeurs.push(filtres.projectId);
    conditions.push(`d.project_id = $${valeurs.length}`);
  }
  if (filtres.donorId) {
    valeurs.push(filtres.donorId);
    conditions.push(`d.donor_id = $${valeurs.length}`);
  }
  if (filtres.recherche) {
    valeurs.push(`%${filtres.recherche}%`);
    conditions.push(`(d.reference ILIKE $${valeurs.length}
                      OR o.first_name ILIKE $${valeurs.length}
                      OR o.last_name ILIKE $${valeurs.length}
                      OR o.organization_name ILIKE $${valeurs.length}
                      OR p.name ILIKE $${valeurs.length})`);
  }

  const ou = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  valeurs.push(filtres.limite ?? 150);
  const limite = `LIMIT $${valeurs.length}`;
  valeurs.push(filtres.decalage ?? 0);
  const decalage = `OFFSET $${valeurs.length}`;

  const resultat = await query(
    `SELECT ${COLONNES} FROM donations d ${JOINTURES} ${ou}
      ORDER BY d.received_at DESC, d.id DESC ${limite} ${decalage}`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

export async function trouverParId(id, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES} FROM donations d ${JOINTURES} WHERE d.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

export async function creer(donnees, client = null) {
  const resultat = await query(
    `INSERT INTO donations
       (reference, donor_id, donor_account_id, amount, currency, allocation,
        project_id, frequency, payment_method, payment_reference, status,
        received_at, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, NOW()), $13)
     RETURNING id`,
    [
      donnees.reference,
      donnees.donorId,
      donnees.donorAccountId,
      donnees.amount,
      donnees.currency,
      donnees.allocation,
      donnees.projectId,
      donnees.frequency,
      donnees.paymentMethod,
      donnees.paymentReference,
      donnees.status,
      donnees.receivedAt,
      donnees.message,
    ],
    client
  );
  return trouverParId(resultat.rows[0].id, client);
}

export async function mettreAJour(id, colonnes, client = null) {
  const { clause, valeurs, vide } = construireSet(colonnes, 2);
  if (vide) return trouverParId(id, client);
  await query(`UPDATE donations SET ${clause} WHERE id = $1`, [id, ...valeurs], client);
  return trouverParId(id, client);
}

/**
 * Le don d'une session de paiement en ligne, avec le compte qui l'a
 * ouverte : c'est lui, et lui seul, qui a le droit d'en lire l'etat.
 */
export async function parSessionFournisseur(sessionId, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES}, d.payment_provider, d.provider_session_id,
            d.provider_payment_id, d.provider_status, o.utilisateur_id
       FROM donations d ${JOINTURES}
      WHERE d.provider_session_id = $1`,
    [sessionId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/**
 * Passe un don a "recu" apres un paiement en ligne abouti.
 *
 * La condition sur le statut fait tout le travail : Stripe annonce un
 * paiement deux fois -- la page de retour et le webhook, parfois dans le
 * desordre --, et seule la premiere annonce a l'arriver change la ligne.
 * Rend le don si c'est bien cette fois-ci, null sinon : l'equipe n'est
 * alors prevenue qu'une fois.
 */
export async function confirmerPaiementEnLigne(id, donnees, client = null) {
  const resultat = await query(
    `UPDATE donations
        SET status = 'RECEIVED',
            received_at = NOW(),
            payment_reference = COALESCE(payment_reference, $2),
            provider_payment_id = $3,
            provider_status = $4,
            provider_updated_at = NOW()
      WHERE id = $1 AND status <> 'RECEIVED'
      RETURNING id`,
    [id, donnees.referencePaiement ?? null, donnees.paiementId ?? null, donnees.statutFournisseur ?? null],
    client
  );
  return resultat.rows.length > 0 ? trouverParId(id, client) : null;
}

/** Ou en est le paiement en ligne, quand il n'aboutit pas (encore). */
export async function noterEtatFournisseur(id, donnees, client = null) {
  await query(
    `UPDATE donations
        SET provider_payment_id = COALESCE($2, provider_payment_id),
            provider_status = $3,
            provider_updated_at = NOW()
      WHERE id = $1`,
    [id, donnees.paiementId ?? null, donnees.statutFournisseur ?? null],
    client
  );
  return trouverParId(id, client);
}

/** Une reference de transaction deja declaree pour un don ? */
export async function referencePaiementPrise(reference, client) {
  const { rows } = await query(
    'SELECT 1 FROM donations WHERE UPPER(payment_reference) = UPPER($1) LIMIT 1',
    [reference],
    client
  );
  return rows.length > 0;
}

/** Genere une reference lisible : DON-2026-0007. */
export async function genererReference(client = null) {
  const annee = new Date().getFullYear();
  /*
   * Le plus grand numero de l'annee, plus un -- pas le nombre de dons :
   * un don supprime ferait retomber le compte sur une reference deja
   * prise. Dans une transaction, un verrou (libere a la fin de celle-ci)
   * empeche deux dons simultanes de tirer le meme numero.
   */
  if (client) await query("SELECT pg_advisory_xact_lock(hashtext('donations.reference'))", [], client);
  const resultat = await query(
    `SELECT COALESCE(MAX(SUBSTRING(reference FROM '[0-9]+$')::int), 0) AS dernier
       FROM donations WHERE reference LIKE $1`,
    [`DON-${annee}-%`],
    client
  );
  return `DON-${annee}-${String(resultat.rows[0].dernier + 1).padStart(4, '0')}`;
}

/**
 * Etat du fonds : ce qui a ete recu, ce qui est deja engage.
 *
 *   dons_affectes   : dons flechees vers un projet
 *   dons_hope       : dons non affectes, le fonds libre de HOPE
 *   deja_investi    : part du fonds HOPE deja engagee sur des projets
 *   disponible_hope : ce qu'il reste a investir
 */
export async function etatDuFonds(client = null) {
  const resultat = await query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE allocation = 'PROJECT'), 0) AS dons_affectes,
       COALESCE(SUM(amount) FILTER (WHERE allocation = 'HOPE'), 0)    AS dons_hope,
       COALESCE(SUM(amount), 0)                                       AS total_recu,
       COUNT(*)::int                                                  AS nombre_dons,
       COUNT(*) FILTER (WHERE allocation = 'PROJECT')::int            AS nombre_affectes,
       COUNT(*) FILTER (WHERE allocation = 'HOPE')::int               AS nombre_hope,
       COUNT(*) FILTER (WHERE frequency = 'MONTHLY')::int             AS nombre_mensuels,
       (SELECT COALESCE(SUM(amount), 0) FROM investments)             AS deja_investi
     FROM donations
     WHERE status = 'RECEIVED'`,
    [],
    client
  );
  return versObjet(resultat.rows[0]);
}

/**
 * La derniere occurrence de chaque don mensuel encore attendu ce mois-ci.
 *
 * Un don mensuel n'est pas une ligne unique qui se repete : c'est une
 * occurrence par mois. La recurrence est donc identifiee par le triplet
 * (donateur, affectation, projet), et la derniere occurrence sert de
 * modele a la suivante.
 *
 * Seules remontent les recurrences dont la derniere occurrence est
 * anterieure au mois courant : celles deja generees sont ignorees, ce qui
 * rend la generation rejouable sans creer de doublon.
 *
 * Un don affecte a un projet qui n'est plus en cours est ecarte : la
 * regle PROJET_FERME le refuserait de toute facon.
 */
export async function echeancesMensuellesAGenerer(client = null) {
  const resultat = await query(
    `SELECT DISTINCT ON (d.donor_id, d.allocation, COALESCE(d.project_id, 0))
            d.donor_id, d.donor_account_id, d.amount, d.currency, d.allocation,
            d.project_id, d.payment_method, d.received_at AS derniere_occurrence
       FROM donations d
       LEFT JOIN projects p ON p.id = d.project_id
      WHERE d.frequency = 'MONTHLY'
        AND d.status IN ('RECEIVED', 'PENDING')
        AND (d.project_id IS NULL OR p.status = 'IN_PROGRESS')
      ORDER BY d.donor_id, d.allocation, COALESCE(d.project_id, 0), d.received_at DESC`,
    [],
    client
  );

  return versListe(
    resultat.rows.filter(
      (ligne) =>
        new Date(ligne.derniere_occurrence) <
        new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
    )
  );
}

/**
 * Verrouille l'ensemble des dons HOPE le temps de decider d'un
 * investissement : deux investissements simultanes ne peuvent pas vider
 * le fonds deux fois.
 */
export async function verrouillerFondsHope(client) {
  await query(
    "SELECT id FROM donations WHERE allocation = 'HOPE' AND status = 'RECEIVED' FOR UPDATE",
    [],
    client
  );
  return etatDuFonds(client);
}
