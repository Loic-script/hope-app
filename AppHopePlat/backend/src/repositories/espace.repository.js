/**
 * Repository des notifications et des messages des espaces utilisateurs.
 *
 * Les deux tables ne connaissent que "utilisateur" : elles servent le
 * benevole, le bailleur, et le donateur le jour ou son espace existera.
 * C'est le jeton qui dit de quel espace vient la demande, pas la table.
 *
 * Aucune requete ne se passe de l'identifiant de l'utilisateur : c'est
 * ce parametre, et non un filtre ajoute plus haut, qui garantit qu'on ne
 * lit jamais le courrier d'un autre.
 */
import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

/* ================================================================
   Notifications
   ================================================================ */

/** Les notifications d'un utilisateur, les plus recentes en tete. */
export async function listerNotifications(utilisateurId, { limite = 40 } = {}, client = null) {
  const resultat = await query(
    `SELECT id, type, titre, corps, lien, lu, cree_le
       FROM notification_utilisateur
      WHERE utilisateur_id = $1
      ORDER BY cree_le DESC
      LIMIT $2`,
    [utilisateurId, limite],
    client
  );
  return versListe(resultat.rows);
}

/**
 * Marque une notification comme lue.
 *
 * La condition porte aussi sur l'utilisateur : sans elle, un
 * identifiant devine suffirait a toucher la notification d'un autre.
 */
export async function marquerLue(utilisateurId, id, client = null) {
  const resultat = await query(
    `UPDATE notification_utilisateur
        SET lu = TRUE
      WHERE id = $2 AND utilisateur_id = $1
      RETURNING id`,
    [utilisateurId, id],
    client
  );
  return resultat.rowCount > 0;
}

/** Marque tout le fil comme lu. */
export async function marquerToutLu(utilisateurId, client = null) {
  const resultat = await query(
    `UPDATE notification_utilisateur
        SET lu = TRUE
      WHERE utilisateur_id = $1 AND lu = FALSE`,
    [utilisateurId],
    client
  );
  return resultat.rowCount;
}

/** Depose une notification. Appelee par les services, jamais par une route. */
export async function creerNotification(
  { utilisateurId, type, titre, corps = null, lien = null },
  client = null
) {
  const resultat = await query(
    `INSERT INTO notification_utilisateur (utilisateur_id, type, titre, corps, lien)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, type, titre, corps, lien, lu, cree_le`,
    [utilisateurId, type, titre, corps, lien],
    client
  );
  return versObjet(resultat.rows[0]);
}

/**
 * Depose la meme notification chez chaque contact bailleur qui peut
 * ouvrir son espace : compte actif, contact actif et autorise a
 * consulter. Les autres ne verraient jamais la cloche.
 *
 * @returns {Promise<number>} le nombre de notifications deposees
 */
export async function notifierBailleurs({ type, titre, corps = null, lien = null }, client = null) {
  const resultat = await query(
    `INSERT INTO notification_utilisateur (utilisateur_id, type, titre, corps, lien)
     SELECT DISTINCT u.id, $1, $2, $3, $4
       FROM bailleur_contact bc
       JOIN utilisateur u ON u.id = bc.utilisateur_id
      WHERE bc.actif AND bc.peut_consulter AND u.statut = 'actif'`,
    [type, titre, corps, lien],
    client
  );
  return resultat.rowCount;
}

/* ================================================================
   Messages

   Un fil porte un sujet ; les paroles vivent dans message_entree, une
   ligne par prise de parole. Le statut du fil suit celui qui a parle en
   dernier : "envoye" quand c'est l'utilisateur -- l'equipe lui doit une
   reponse -- "repondu" quand c'est HOPE.
   ================================================================ */

/** Les entrees d'un fil, agregees en une colonne JSON. */
const ENTREES = `
  COALESCE((
    SELECT json_agg(
             json_build_object(
               'id', e.id, 'auteur', e.auteur, 'corps', e.corps,
               'lu', e.lu, 'creeLe', e.cree_le,
               'auteurNom', a.admin_log
             ) ORDER BY e.cree_le, e.id
           )
      FROM message_entree e
      LEFT JOIN admins a ON a.id = e.admin_id
     WHERE e.fil_id = m.id
  ), '[]'::json) AS entrees
`;

/** Les fils d'un utilisateur, le plus recemment anime en tete. */
export async function listerMessages(utilisateurId, client = null) {
  const resultat = await query(
    `SELECT m.id, m.sujet, m.statut, m.cree_le, m.updated_at,
            ${ENTREES},
            (SELECT COUNT(*)::int FROM message_entree e
              WHERE e.fil_id = m.id AND e.auteur = 'hope' AND e.lu = FALSE) AS non_lus
       FROM message_utilisateur m
      WHERE m.utilisateur_id = $1
      ORDER BY m.updated_at DESC`,
    [utilisateurId],
    client
  );
  return versListe(resultat.rows);
}

/**
 * Tous les fils, cote equipe.
 *
 * Le nom et le role viennent avec : la messagerie de l'administration
 * doit dire qui ecrit, et a quel titre.
 */
export async function listerTousLesFils(client = null) {
  const resultat = await query(
    `SELECT m.id, m.sujet, m.statut, m.cree_le, m.updated_at,
            m.utilisateur_id,
            u.prenom, u.nom, u.email, u.photo_url,
            r.role,
            ${ENTREES},
            (SELECT COUNT(*)::int FROM message_entree e
              WHERE e.fil_id = m.id AND e.auteur = 'utilisateur' AND e.lu = FALSE) AS non_lus
       FROM message_utilisateur m
       JOIN utilisateur u ON u.id = m.utilisateur_id
       LEFT JOIN LATERAL (
         SELECT role FROM utilisateur_role WHERE utilisateur_id = u.id LIMIT 1
       ) r ON TRUE
      ORDER BY m.updated_at DESC`,
    [],
    client
  );
  return versListe(resultat.rows);
}

/** Un fil, sans ses entrees : de quoi verifier a qui il appartient. */
export async function trouverFil(id, client = null) {
  const resultat = await query(
    `SELECT id, utilisateur_id, sujet, statut FROM message_utilisateur WHERE id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Ouvre un fil et y depose la premiere parole. */
export async function creerFil({ utilisateurId, sujet, corps }, client = null) {
  const fil = await query(
    `INSERT INTO message_utilisateur (utilisateur_id, sujet, statut)
     VALUES ($1, $2, 'envoye')
     RETURNING id`,
    [utilisateurId, sujet],
    client
  );
  const id = fil.rows[0].id;
  await ajouterEntree({ filId: id, auteur: 'utilisateur', corps }, client);
  return versObjet({ id, sujet, statut: 'envoye' });
}

/**
 * Ajoute une parole au fil, et remonte celui-ci.
 *
 * Le statut suit l'auteur : une parole de l'utilisateur remet le fil en
 * attente, une parole de HOPE le declare repondu. Sans cette mise a
 * jour, un fil relance resterait marque "repondu" et se perdrait au bas
 * de la liste de l'equipe.
 */
export async function ajouterEntree({ filId, auteur, corps, adminId = null }, client = null) {
  const resultat = await query(
    `INSERT INTO message_entree (fil_id, auteur, corps, admin_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, auteur, corps, lu, cree_le`,
    [filId, auteur, corps, adminId],
    client
  );

  await query(
    `UPDATE message_utilisateur
        SET statut = $2, updated_at = NOW()
      WHERE id = $1`,
    [filId, auteur === 'hope' ? 'repondu' : 'envoye'],
    client
  );

  return versObjet(resultat.rows[0]);
}

/** Marque comme lues les paroles de HOPE adressees a cet utilisateur. */
export async function marquerReponsesLues(utilisateurId, client = null) {
  const resultat = await query(
    `UPDATE message_entree e
        SET lu = TRUE
       FROM message_utilisateur m
      WHERE e.fil_id = m.id
        AND m.utilisateur_id = $1
        AND e.auteur = 'hope'
        AND e.lu = FALSE`,
    [utilisateurId],
    client
  );
  return resultat.rowCount;
}

/** Marque comme lues les paroles de l'utilisateur dans un fil, cote equipe. */
export async function marquerFilLuParHope(filId, client = null) {
  const resultat = await query(
    `UPDATE message_entree
        SET lu = TRUE
      WHERE fil_id = $1 AND auteur = 'utilisateur' AND lu = FALSE`,
    [filId],
    client
  );
  return resultat.rowCount;
}

/* ================================================================
   Pastilles
   ================================================================ */

/**
 * Les deux compteurs du menu, en une requete.
 *
 * Deux sous-requetes plutot que deux allers-retours : le menu les
 * recharge a chaque changement de page, et c'est la requete la plus
 * frequente de l'espace.
 */
export async function compteurs(utilisateurId, client = null) {
  const resultat = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM notification_utilisateur
         WHERE utilisateur_id = $1 AND lu = FALSE)          AS notifications,
       (SELECT COUNT(*)::int
          FROM message_entree e
          JOIN message_utilisateur m ON m.id = e.fil_id
         WHERE m.utilisateur_id = $1
           AND e.auteur = 'hope' AND e.lu = FALSE)        AS messages`,
    [utilisateurId],
    client
  );
  return versObjet(resultat.rows[0]);
}
