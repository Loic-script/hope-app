/**
 * Repository de la messagerie.
 *
 * Un fil reunit des participants ; chacun peut y ecrire. Deux tables
 * d'identite coexistent dans HOPE -- "utilisateur" pour ceux qui
 * s'inscrivent, "admins" pour l'equipe -- et toutes les fonctions d'ici
 * recoivent donc un "acteur" : { type: 'utilisateur' | 'admin', id }.
 *
 * Aucune regle metier ici : qui peut lire, ecrire ou transferer se
 * decide dans le service. Ce fichier ne fait que dire la verite de la
 * base, en une requete chaque fois que c'est possible.
 */
import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

/** La colonne qui porte un acteur, dans une table a double identite. */
function colonne(acteur, prefixe = '') {
  return `${prefixe}${acteur.type === 'admin' ? 'admin_id' : 'utilisateur_id'}`;
}

/** Valeurs des deux colonnes d'identite, pour un INSERT. */
function identites(acteur) {
  return acteur.type === 'admin' ? [null, Number(acteur.id)] : [String(acteur.id), null];
}

/**
 * Une personne, telle que la messagerie la montre.
 *
 * Attend les alias : u (utilisateur), a (admins), r (role principal),
 * bn (benevole), bc (bailleur_contact), bl (bailleur). Le role principal
 * est choisi par ordre d'interet : un contact de bailleur se presente
 * par son organisation avant tout.
 */
const PERSONNE = `
  json_build_object(
    'type', CASE WHEN a.id IS NOT NULL THEN 'admin' ELSE 'utilisateur' END,
    'id', COALESCE(u.id::text, a.id::text),
    'nom', COALESCE(NULLIF(TRIM(u.prenom || ' ' || u.nom), ''), split_part(u.email, '@', 1),
                    a.full_name, a.admin_log, 'Compte supprimé'),
    'prenom', COALESCE(NULLIF(u.prenom, ''), split_part(u.email, '@', 1),
                       split_part(COALESCE(a.full_name, a.admin_log, ''), ' ', 1)),
    'photoUrl', COALESCE(u.photo_url, a.photo_url),
    'role', CASE WHEN a.id IS NOT NULL THEN 'equipe' ELSE r.role END,
    'roleEquipe', a.role,
    'fonction', COALESCE(bc.fonction, bn.profession),
    'entreprise', bl.raison_sociale,
    'entrepriseId', bl.id,
    'siteWeb', bl.site_web,
    'email', u.email,
    'telephone', u.telephone,
    'statut', COALESCE(u.statut, lower(a.status))
  )
`;

/** Les jointures qui nourrissent PERSONNE, a partir de p.utilisateur_id / p.admin_id. */
const JOINTURES_PERSONNE = `
  LEFT JOIN utilisateur u ON u.id = p.utilisateur_id
  LEFT JOIN admins a ON a.id = p.admin_id
  LEFT JOIN LATERAL (
    SELECT ur.role FROM utilisateur_role ur
     WHERE ur.utilisateur_id = u.id
     ORDER BY CASE ur.role WHEN 'bailleur' THEN 0 WHEN 'benevole' THEN 1
                           WHEN 'donateur' THEN 2 ELSE 3 END
     LIMIT 1
  ) r ON TRUE
  LEFT JOIN benevole bn ON bn.utilisateur_id = u.id
  LEFT JOIN bailleur_contact bc ON bc.utilisateur_id = u.id
  LEFT JOIN bailleur bl ON bl.id = bc.bailleur_id
`;

/** Les participants d'un fil (alias c), avec leur date d'ajout. */
const PARTICIPANTS = `
  COALESCE((
    SELECT json_agg(
             (${PERSONNE})::jsonb || jsonb_build_object('ajouteLe', p.rejoint_le)
             ORDER BY p.rejoint_le, p.id
           )
      FROM conversation_participant p
      ${JOINTURES_PERSONNE}
     WHERE p.conversation_id = c.id
  ), '[]'::json) AS participants
`;

/** Les pieces d'un message (alias m), sans le nom de fichier sur le disque. */
const PIECES = `
  COALESCE((
    SELECT json_agg(
             json_build_object(
               'id', pc.id, 'nom', pc.nom_origine, 'type', pc.type,
               'typeMime', pc.type_mime, 'taille', pc.taille
             ) ORDER BY pc.position, pc.id
           )
      FROM conversation_piece pc
     WHERE pc.message_id = m.id
  ), '[]'::json)
`;

/* ================================================================
   Participation et non-lus
   ================================================================ */

/** L'acteur participe-t-il a ce fil ? La seule porte d'acces. */
export async function estParticipant(acteur, conversationId, client = null) {
  const resultat = await query(
    `SELECT 1 FROM conversation_participant
      WHERE conversation_id = $1 AND ${colonne(acteur)} = $2`,
    [conversationId, acteur.id],
    client
  );
  return resultat.rowCount > 0;
}

/**
 * Condition "ce message n'est pas de moi", sur l'alias m.
 *
 * IS DISTINCT FROM et non <> : un message d'un compte supprime a ses
 * deux colonnes a NULL, et doit compter comme ecrit par un autre.
 */
function pasDeMoi(acteur, rang) {
  return `m.${colonne(acteur)} IS DISTINCT FROM $${rang}`;
}

/**
 * Le total des non-lus d'un acteur, et le fil du plus recent.
 *
 * Non-lu : un message non supprime, ecrit par un autre, envoye apres la
 * derniere lecture. Le fil du plus recent sert a la notification, qui y
 * mene directement.
 */
export async function nonLus(acteur, client = null) {
  const resultat = await query(
    `SELECT COUNT(*)::int AS total,
            (ARRAY_AGG(m.conversation_id ORDER BY m.cree_le DESC, m.id DESC))[1] AS dernier_fil
       FROM conversation_participant p
       JOIN conversation_message m ON m.conversation_id = p.conversation_id
      WHERE p.${colonne(acteur)} = $1
        AND m.supprime_le IS NULL
        AND ${pasDeMoi(acteur, 1)}
        AND (p.lu_jusqu_a IS NULL OR m.cree_le > p.lu_jusqu_a)`,
    [acteur.id],
    client
  );
  return { total: resultat.rows[0].total, dernierFil: resultat.rows[0].dernier_fil ?? null };
}

/** Le seul total : ce que la pastille du menu affiche. */
export async function compterNonLues(acteur, client = null) {
  return (await nonLus(acteur, client)).total;
}

/**
 * Marque le fil lu jusqu'a un message, ou jusqu'a maintenant.
 *
 * Jusqu'a un message plutot qu'a une heure venue du navigateur : une date
 * JavaScript s'arrete a la milliseconde, PostgreSQL garde la microseconde,
 * et le dernier message affiche serait reste "plus recent" que sa propre
 * lecture -- donc non lu. L'heure est relue ici, exacte.
 *
 * GREATEST : une lecture ne recule jamais -- deux onglets ouverts sur le
 * meme fil ne doivent pas se faire perdre la lecture l'un a l'autre.
 *
 * @param {number|null} messageId un message de ce fil ; null pour "maintenant"
 */
export async function marquerLu(acteur, conversationId, messageId = null, client = null) {
  await query(
    `UPDATE conversation_participant
        SET lu_jusqu_a = GREATEST(
              COALESCE(lu_jusqu_a, '-infinity'::timestamptz),
              COALESCE(
                (SELECT m.cree_le FROM conversation_message m
                  WHERE m.id = $3 AND m.conversation_id = $1),
                NOW()
              )
            )
      WHERE conversation_id = $1 AND ${colonne(acteur)} = $2`,
    [conversationId, acteur.id, messageId],
    client
  );
}

/* ================================================================
   Lecture des fils
   ================================================================ */

/**
 * Les fils d'un acteur, le plus recemment anime en tete.
 *
 * Un fil sans message -- un groupe tout juste cree -- se classe a sa date
 * de creation. Le dernier message est rendu meme supprime : la liste doit
 * pouvoir dire "Message supprime".
 */
export async function lister(acteur, client = null) {
  const resultat = await query(
    `SELECT c.id, c.type, c.nom, c.photo_fichier, c.assistance, c.cree_le,
            moi.lu_jusqu_a AS lu_le,
            ${PARTICIPANTS},
            dernier.message AS dernier,
            (SELECT COUNT(*)::int
               FROM conversation_message m
              WHERE m.conversation_id = c.id
                AND m.supprime_le IS NULL
                AND ${pasDeMoi(acteur, 1)}
                AND (moi.lu_jusqu_a IS NULL OR m.cree_le > moi.lu_jusqu_a)) AS non_lus,
            COALESCE(dernier.cree_le, c.cree_le) AS derniere_activite
       FROM conversation_participant moi
       JOIN conversation c ON c.id = moi.conversation_id
       LEFT JOIN LATERAL (
         SELECT m.cree_le,
                json_build_object(
                  'id', m.id, 'corps', m.corps, 'creeLe', m.cree_le,
                  'supprime', m.supprime_le IS NOT NULL,
                  'auteurNom', m.auteur_nom,
                  'auteurType', CASE WHEN m.admin_id IS NULL THEN 'utilisateur' ELSE 'admin' END,
                  'auteurId', COALESCE(m.utilisateur_id::text, m.admin_id::text),
                  'pieces', ${PIECES}
                ) AS message
           FROM conversation_message m
          WHERE m.conversation_id = c.id
          ORDER BY m.cree_le DESC, m.id DESC
          LIMIT 1
       ) dernier ON TRUE
      WHERE moi.${colonne(acteur)} = $1
      ORDER BY COALESCE(dernier.cree_le, c.cree_le) DESC, c.id DESC`,
    [acteur.id],
    client
  );
  return versListe(resultat.rows);
}

/** Un fil, avec ses participants. Sans verification d'acces : le service la fait. */
export async function trouver(conversationId, client = null) {
  const resultat = await query(
    `SELECT c.id, c.type, c.nom, c.photo_fichier, c.assistance, c.cree_le, ${PARTICIPANTS}
       FROM conversation c
      WHERE c.id = $1`,
    [conversationId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** La date de derniere lecture d'un acteur dans un fil. */
export async function luLe(acteur, conversationId, client = null) {
  const resultat = await query(
    `SELECT lu_jusqu_a FROM conversation_participant
      WHERE conversation_id = $1 AND ${colonne(acteur)} = $2`,
    [conversationId, acteur.id],
    client
  );
  return resultat.rows[0]?.lu_jusqu_a ?? null;
}

/** Les messages d'un fil, du plus ancien au plus recent, pieces comprises. */
export async function messages(conversationId, client = null) {
  const resultat = await query(
    `SELECT m.id, m.corps, m.cree_le, m.modifie_le, m.supprime_le, m.transfere,
            m.auteur_nom,
            CASE WHEN m.admin_id IS NULL THEN 'utilisateur' ELSE 'admin' END AS auteur_type,
            COALESCE(m.utilisateur_id::text, m.admin_id::text) AS auteur_id,
            COALESCE(u.photo_url, a.photo_url) AS auteur_photo,
            ${PIECES} AS pieces
       FROM conversation_message m
       LEFT JOIN utilisateur u ON u.id = m.utilisateur_id
       LEFT JOIN admins a ON a.id = m.admin_id
      WHERE m.conversation_id = $1
      ORDER BY m.cree_le, m.id`,
    [conversationId],
    client
  );
  return versListe(resultat.rows);
}

/** Un message, avec ce qu'il faut pour decider qui peut y toucher. */
export async function trouverMessage(messageId, client = null) {
  const resultat = await query(
    `SELECT m.id, m.conversation_id, m.corps, m.cree_le, m.modifie_le, m.supprime_le,
            m.transfere, m.auteur_nom,
            CASE WHEN m.admin_id IS NULL THEN 'utilisateur' ELSE 'admin' END AS auteur_type,
            COALESCE(m.utilisateur_id::text, m.admin_id::text) AS auteur_id,
            ${PIECES} AS pieces
       FROM conversation_message m
      WHERE m.id = $1`,
    [messageId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/* ================================================================
   Retrouver ou creer un fil
   ================================================================ */

/**
 * Verrou transactionnel sur une cle.
 *
 * Deux clics rapides sur "Envoyer un message" arrivent en parallele :
 * sans verrou, les deux cherchent le fil, ne le trouvent pas, et en
 * creent chacun un. Le verrou les met en file ; le second trouve ce que
 * le premier a cree.
 */
export async function verrouiller(cle, client) {
  await query('SELECT pg_advisory_xact_lock(hashtext($1))', [cle], client);
}

/** Le fil individuel qui reunit exactement ces deux personnes. */
export async function trouverIndividuel(a, b, client = null) {
  const resultat = await query(
    `SELECT c.id
       FROM conversation c
      WHERE c.type = 'individuel' AND c.assistance = FALSE
        AND (SELECT COUNT(*) FROM conversation_participant WHERE conversation_id = c.id) = 2
        AND EXISTS (SELECT 1 FROM conversation_participant
                     WHERE conversation_id = c.id AND ${colonne(a)} = $1)
        AND EXISTS (SELECT 1 FROM conversation_participant
                     WHERE conversation_id = c.id AND ${colonne(b)} = $2)
      ORDER BY c.id
      LIMIT 1`,
    [a.id, b.id],
    client
  );
  return resultat.rows[0]?.id ?? null;
}

/**
 * Le fil d'assistance d'un utilisateur.
 *
 * Les anciens fils "ecrire a HOPE" etaient ouverts un par sujet : un
 * utilisateur peut donc en avoir plusieurs. On reprend le plus
 * recemment anime -- celui ou la conversation en est restee -- plutot
 * que de fusionner un historique que chacun a lu dans cet ordre.
 */
export async function trouverAssistance(utilisateurId, client = null) {
  const resultat = await query(
    `SELECT c.id
       FROM conversation c
       JOIN conversation_participant p ON p.conversation_id = c.id
      WHERE c.assistance AND p.utilisateur_id = $1
      ORDER BY c.maj_le DESC, c.id DESC
      LIMIT 1`,
    [utilisateurId],
    client
  );
  return resultat.rows[0]?.id ?? null;
}

/** Cree un fil vide. Les participants s'ajoutent ensuite. */
export async function creerFil(
  { type = 'individuel', nom = null, photoFichier = null, assistance = false },
  client = null
) {
  const resultat = await query(
    `INSERT INTO conversation (type, nom, photo_fichier, assistance)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [type, nom, photoFichier, assistance],
    client
  );
  return resultat.rows[0].id;
}

/**
 * Ajoute des participants ; ceux qui y sont deja sont ignores.
 *
 * Les index uniques sont partiels -- une colonne d'identite vaut NULL --
 * d'ou le predicat repete dans ON CONFLICT.
 *
 * @param {Date|string|null} luLe la lecture de depart : NULL pour tout
 *        lire comme neuf, NOW() pour arriver a jour.
 * @returns {Promise<number>} le nombre de participants reellement ajoutes
 */
export async function ajouterParticipants(conversationId, acteurs, luLe = null, client = null) {
  let ajoutes = 0;
  for (const acteur of acteurs) {
    const [utilisateurId, adminId] = identites(acteur);
    const cible = acteur.type === 'admin'
      ? '(conversation_id, admin_id) WHERE admin_id IS NOT NULL'
      : '(conversation_id, utilisateur_id) WHERE utilisateur_id IS NOT NULL';
    const resultat = await query(
      `INSERT INTO conversation_participant (conversation_id, utilisateur_id, admin_id, lu_jusqu_a)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ${cible} DO NOTHING`,
      [conversationId, utilisateurId, adminId, luLe],
      client
    );
    ajoutes += resultat.rowCount;
  }
  return ajoutes;
}

/**
 * Inscrit l'equipe active a tous les fils d'assistance ou elle manque.
 *
 * Un administrateur cree apres un fil n'y figurait pas ; la participation
 * etant la seule porte, il ne l'aurait jamais vu. Il arrive a jour : lui
 * faire lire comme neuf tout l'historique n'aurait pas de sens.
 */
export async function rattacherEquipeAuxAssistances(client = null) {
  await query(
    `INSERT INTO conversation_participant (conversation_id, admin_id, lu_jusqu_a)
     SELECT c.id, a.id, NOW()
       FROM conversation c
       CROSS JOIN admins a
      WHERE c.assistance AND a.status = 'ACTIVE'
     ON CONFLICT (conversation_id, admin_id) WHERE admin_id IS NOT NULL DO NOTHING`,
    [],
    client
  );
}

/** Les administrateurs actifs : l'equipe, a inscrire a un fil d'assistance. */
export async function equipeActive(client = null) {
  const resultat = await query(`SELECT id FROM admins WHERE status = 'ACTIVE' ORDER BY id`, [], client);
  return resultat.rows.map((ligne) => ({ type: 'admin', id: ligne.id }));
}

/** Retire un participant. Rend le nombre de participants restants. */
export async function retirerParticipant(acteur, conversationId, client = null) {
  await query(
    `DELETE FROM conversation_participant WHERE conversation_id = $1 AND ${colonne(acteur)} = $2`,
    [conversationId, acteur.id],
    client
  );
  const reste = await query(
    'SELECT COUNT(*)::int AS n FROM conversation_participant WHERE conversation_id = $1',
    [conversationId],
    client
  );
  return reste.rows[0].n;
}

/** Supprime un fil ; messages et pieces partent en cascade. Rend les fichiers a effacer. */
export async function supprimerFil(conversationId, client = null) {
  const fichiers = await query(
    `SELECT pc.fichier
       FROM conversation_piece pc
       JOIN conversation_message m ON m.id = pc.message_id
      WHERE m.conversation_id = $1
     UNION ALL
     SELECT photo_fichier FROM conversation WHERE id = $1 AND photo_fichier IS NOT NULL`,
    [conversationId],
    client
  );
  await query('DELETE FROM conversation WHERE id = $1', [conversationId], client);
  return fichiers.rows.map((ligne) => ligne.fichier);
}

/* ================================================================
   Ecriture des messages
   ================================================================ */

/** Depose un message et remonte le fil. */
export async function ajouterMessage(
  { conversationId, acteur, auteurNom, corps = '', transfere = false },
  client = null
) {
  const [utilisateurId, adminId] = identites(acteur);
  const resultat = await query(
    `INSERT INTO conversation_message
       (conversation_id, utilisateur_id, admin_id, auteur_nom, corps, transfere)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, cree_le`,
    [conversationId, utilisateurId, adminId, auteurNom, corps, transfere],
    client
  );
  await query('UPDATE conversation SET maj_le = NOW() WHERE id = $1', [conversationId], client);
  return versObjet(resultat.rows[0]);
}

/** Enregistre les pieces d'un message, dans l'ordre donne. */
export async function ajouterPieces(messageId, pieces, client = null) {
  for (const [rang, piece] of pieces.entries()) {
    await query(
      `INSERT INTO conversation_piece
         (message_id, nom_origine, type, type_mime, fichier, taille, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [messageId, piece.nomOrigine, piece.type, piece.typeMime, piece.fichier, piece.taille, rang],
      client
    );
  }
}

/** Remplace le texte d'un message et note la modification. */
export async function modifierMessage(messageId, corps, client = null) {
  await query(
    `UPDATE conversation_message SET corps = $2, modifie_le = NOW() WHERE id = $1`,
    [messageId, corps],
    client
  );
}

/**
 * Suppression logique : texte vide, date posee, pieces retirees.
 *
 * Rend les fichiers a effacer du disque. L'appelant les efface APRES la
 * transaction : un echec en cours de route ne doit pas laisser une
 * ligne pointant vers un fichier deja parti.
 */
export async function supprimerMessage(messageId, client = null) {
  const pieces = await query(
    'DELETE FROM conversation_piece WHERE message_id = $1 RETURNING fichier',
    [messageId],
    client
  );
  await query(
    `UPDATE conversation_message SET corps = '', supprime_le = NOW() WHERE id = $1`,
    [messageId],
    client
  );
  return pieces.rows.map((ligne) => ligne.fichier);
}

/** Les pieces d'un message avec leur nom sur le disque : pour les dupliquer. */
export async function piecesAvecFichiers(messageId, client = null) {
  const resultat = await query(
    `SELECT nom_origine, type, type_mime, fichier, taille
       FROM conversation_piece
      WHERE message_id = $1
      ORDER BY position, id`,
    [messageId],
    client
  );
  return versListe(resultat.rows);
}

/** Une piece, avec le fil de son message, pour en controler l'acces. */
export async function trouverPiece(pieceId, client = null) {
  const resultat = await query(
    `SELECT pc.id, pc.nom_origine, pc.type, pc.type_mime, pc.fichier, pc.taille,
            m.conversation_id, m.supprime_le
       FROM conversation_piece pc
       JOIN conversation_message m ON m.id = pc.message_id
      WHERE pc.id = $1`,
    [pieceId],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Toutes les pieces d'un fil, de la plus recente a la plus ancienne. */
export async function piecesDuFil(conversationId, client = null) {
  const resultat = await query(
    `SELECT pc.id, pc.nom_origine AS nom, pc.type, pc.type_mime, pc.taille,
            m.id AS message_id, m.cree_le, m.auteur_nom
       FROM conversation_piece pc
       JOIN conversation_message m ON m.id = pc.message_id
      WHERE m.conversation_id = $1 AND m.supprime_le IS NULL
      ORDER BY m.cree_le DESC, pc.position`,
    [conversationId],
    client
  );
  return versListe(resultat.rows);
}

/** Modifie le nom ou la photo d'un groupe. */
export async function modifierGroupe(conversationId, { nom, photoFichier }, client = null) {
  await query(
    `UPDATE conversation
        SET nom = COALESCE($2, nom),
            photo_fichier = COALESCE($3, photo_fichier)
      WHERE id = $1`,
    [conversationId, nom ?? null, photoFichier ?? null],
    client
  );
}

/* ================================================================
   Annuaire
   ================================================================ */

/**
 * Qui chaque espace peut joindre, en plus de l'equipe HOPE (le fil
 * d'assistance, propose a tout utilisateur) :
 *   - espace benevole : les autres benevoles ;
 *   - espaces donateur et bailleur : personne d'autre que l'equipe.
 * L'administration, elle, joint tout le monde.
 */
const ROLE_JOIGNABLE_PAR_ESPACE = { 'hope-benevole': 'benevole' };

/**
 * Les personnes qu'un acteur peut joindre.
 *
 * L'equipe joint tous les comptes, y compris ceux qui attendent leur
 * activation -- un candidat a qui l'on doit une reponse --, et les autres
 * administrateurs. Un utilisateur ne joint que ce que son espace permet
 * (ROLE_JOIGNABLE_PAR_ESPACE) ; les administrateurs, il les joint en bloc,
 * par le fil d'assistance.
 *
 * Toute ouverture de fil passe par ici (nouvelle conversation, groupe,
 * ajout de membres, transfert, bouton d'une fiche) : la regle vaut
 * partout.
 *
 * On s'exclut soi-meme : s'ecrire n'a pas de sens.
 */
export async function joignables(acteur, client = null) {
  const equipe = acteur.type === 'admin';
  const roleJoignable = equipe ? null : ROLE_JOIGNABLE_PAR_ESPACE[acteur.espace] ?? null;
  // Un utilisateur dont l'espace ne joint personne : inutile d'interroger.
  if (!equipe && !roleJoignable) return [];
  const resultat = await query(
    `SELECT ${PERSONNE} AS personne
       FROM (
         SELECT u2.id AS utilisateur_id, NULL::int AS admin_id
           FROM utilisateur u2
          WHERE u2.statut = ANY($1::text[])
            AND ($2::text IS NULL OR u2.id::text <> $2::text)
            AND ($5::text IS NULL OR EXISTS (
                  SELECT 1 FROM utilisateur_role r WHERE r.utilisateur_id = u2.id AND r.role = $5::text))
         UNION ALL
         SELECT NULL::uuid, a2.id
           FROM admins a2
          WHERE $3::boolean AND a2.status = 'ACTIVE'
            AND ($4::int IS NULL OR a2.id <> $4::int)
       ) p
       ${JOINTURES_PERSONNE}`,
    [
      equipe ? ['actif', 'en_attente'] : ['actif'],
      acteur.type === 'utilisateur' ? String(acteur.id) : null,
      equipe,
      acteur.type === 'admin' ? Number(acteur.id) : null,
      roleJoignable,
    ],
    client
  );
  return resultat.rows.map((ligne) => ligne.personne);
}

/** Une personne precise, si elle existe. */
export async function personne(acteur, client = null) {
  const resultat = await query(
    `SELECT ${PERSONNE} AS personne
       FROM (SELECT $1::uuid AS utilisateur_id, $2::int AS admin_id) p
       ${JOINTURES_PERSONNE}
      WHERE u.id IS NOT NULL OR a.id IS NOT NULL`,
    identites(acteur),
    client
  );
  return resultat.rows[0]?.personne ?? null;
}

/** Les contacts d'une organisation, le principal en tete. */
export async function contactsDeBailleur(bailleurId, client = null) {
  const resultat = await query(
    `SELECT bc.utilisateur_id, bc.contact_principal
       FROM bailleur_contact bc
       JOIN utilisateur u ON u.id = bc.utilisateur_id
      WHERE bc.bailleur_id = $1 AND bc.actif AND u.statut IN ('actif', 'en_attente')
      ORDER BY bc.contact_principal DESC, bc.cree_le`,
    [bailleurId],
    client
  );
  return resultat.rows.map((ligne) => ({
    acteur: { type: 'utilisateur', id: ligne.utilisateur_id },
    principal: ligne.contact_principal,
  }));
}
