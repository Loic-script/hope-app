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

/* ================================================================
   Messages
   ================================================================ */

/** Les messages d'un utilisateur, avec la reponse de l'equipe. */
export async function listerMessages(utilisateurId, client = null) {
  const resultat = await query(
    `SELECT m.id, m.sujet, m.corps, m.statut, m.reponse, m.repondu_le,
            m.reponse_lue, m.cree_le,
            a.admin_log AS repondu_par
       FROM message_utilisateur m
       LEFT JOIN admins a ON a.id = m.repondu_par
      WHERE m.utilisateur_id = $1
      ORDER BY m.cree_le DESC`,
    [utilisateurId],
    client
  );
  return versListe(resultat.rows);
}

/** Envoie un message a l'equipe. */
export async function creerMessage({ utilisateurId, sujet, corps }, client = null) {
  const resultat = await query(
    `INSERT INTO message_utilisateur (utilisateur_id, sujet, corps)
     VALUES ($1, $2, $3)
     RETURNING id, sujet, corps, statut, reponse, repondu_le, reponse_lue, cree_le`,
    [utilisateurId, sujet, corps],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Marque les reponses comme lues : la pastille du menu s'eteint. */
export async function marquerReponsesLues(utilisateurId, client = null) {
  const resultat = await query(
    `UPDATE message_utilisateur
        SET reponse_lue = TRUE
      WHERE utilisateur_id = $1 AND reponse_lue = FALSE`,
    [utilisateurId],
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
       (SELECT COUNT(*)::int FROM message_utilisateur
         WHERE utilisateur_id = $1 AND reponse_lue = FALSE) AS messages`,
    [utilisateurId],
    client
  );
  return versObjet(resultat.rows[0]);
}
