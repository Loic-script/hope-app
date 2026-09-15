/**
 * Repository des conversations.
 *
 * Une conversation reunit des participants ; chacun peut y ecrire. Le
 * modele ne connait pas les roles : un administrateur y est un
 * participant comme un autre.
 *
 * Deux tables d'identite coexistent dans HOPE -- "utilisateur" pour ceux
 * qui s'inscrivent, "admins" pour l'equipe. Toutes les fonctions d'ici
 * recoivent donc un "acteur" : { type, id }. C'est lui, et non un filtre
 * ajoute plus haut, qui garantit qu'on ne lit jamais la conversation
 * d'un autre.
 */
import { query } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

/**
 * Condition d'appartenance, ecrite une fois.
 *
 * @param {{type: string, id: string|number}} acteur
 * @param {any[]} valeurs tableau de parametres, complete au passage
 */
function estParticipant(acteur, valeurs) {
  valeurs.push(acteur.id);
  const colonne = acteur.type === 'admin' ? 'admin_id' : 'utilisateur_id';
  return `EXISTS (
    SELECT 1 FROM conversation_participant p
     WHERE p.conversation_id = c.id AND p.${colonne} = $${valeurs.length}
  )`;
}

/** Les participants d'une conversation, avec de quoi les nommer. */
const PARTICIPANTS = `
  COALESCE((
    SELECT json_agg(
             json_build_object(
               'type', CASE WHEN p.admin_id IS NULL THEN 'utilisateur' ELSE 'admin' END,
               'id', COALESCE(p.utilisateur_id::text, p.admin_id::text),
               'nom', COALESCE(TRIM(u.prenom || ' ' || u.nom), a.admin_log),
               'photoUrl', u.photo_url,
               'role', COALESCE(r.role, 'equipe')
             ) ORDER BY p.rejoint_le, p.id
           )
      FROM conversation_participant p
      LEFT JOIN utilisateur u ON u.id = p.utilisateur_id
      LEFT JOIN admins a ON a.id = p.admin_id
      LEFT JOIN LATERAL (
        SELECT role FROM utilisateur_role WHERE utilisateur_id = u.id LIMIT 1
      ) r ON TRUE
     WHERE p.conversation_id = c.id
  ), '[]'::json) AS participants
`;

/** Le dernier message : c'est lui qui resume la conversation dans la liste. */
const DERNIER = `
  (SELECT json_build_object('corps', m.corps, 'creeLe', m.cree_le,
                            'estDeMoi', %AUTEUR%)
     FROM conversation_message m
    WHERE m.conversation_id = c.id
    ORDER BY m.cree_le DESC, m.id DESC
    LIMIT 1) AS dernier
`;

/**
 * Les conversations d'un acteur, la plus recemment animee en tete.
 *
 * Le compte des non-lus se deduit de "lu_jusqu_a" : tout message plus
 * recent, et qui n'est pas de moi, n'a pas ete lu. Pas de drapeau a
 * poser message par message.
 */
export async function lister(acteur, client = null) {
  const valeurs = [];
  const condition = estParticipant(acteur, valeurs);

  valeurs.push(acteur.id);
  const rangAuteur = valeurs.length;
  const colonneAuteur = acteur.type === 'admin' ? 'm.admin_id' : 'm.utilisateur_id';
  const estDeMoi = `(${colonneAuteur} = $${rangAuteur})`;

  valeurs.push(acteur.id);
  const rangMoi = valeurs.length;
  const colonneMoi = acteur.type === 'admin' ? 'p2.admin_id' : 'p2.utilisateur_id';

  const resultat = await query(
    `SELECT c.id, c.sujet, c.cree_le, c.maj_le,
            ${PARTICIPANTS},
            ${DERNIER.replace('%AUTEUR%', estDeMoi)},
            (SELECT COUNT(*)::int
               FROM conversation_message m2
               JOIN conversation_participant p2
                 ON p2.conversation_id = c.id AND ${colonneMoi} = $${rangMoi}
              WHERE m2.conversation_id = c.id
                AND ${acteur.type === 'admin' ? 'm2.admin_id IS DISTINCT FROM' : 'm2.utilisateur_id IS DISTINCT FROM'} $${rangMoi}
                AND (p2.lu_jusqu_a IS NULL OR m2.cree_le > p2.lu_jusqu_a)
            ) AS non_lus
       FROM conversation c
      WHERE ${condition}
      ORDER BY c.maj_le DESC`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

/** Une conversation, si l'acteur y participe. */
export async function trouver(acteur, id, client = null) {
  const valeurs = [];
  const condition = estParticipant(acteur, valeurs);
  valeurs.push(id);

  const resultat = await query(
    `SELECT c.id, c.sujet, c.cree_le, c.maj_le, ${PARTICIPANTS}
       FROM conversation c
      WHERE ${condition} AND c.id = $${valeurs.length}`,
    valeurs,
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Les messages d'une conversation, du plus ancien au plus recent. */
export async function messages(conversationId, client = null) {
  const resultat = await query(
    `SELECT m.id, m.corps, m.cree_le,
            CASE WHEN m.admin_id IS NULL THEN 'utilisateur' ELSE 'admin' END AS auteur_type,
            COALESCE(m.utilisateur_id::text, m.admin_id::text) AS auteur_id,
            COALESCE(TRIM(u.prenom || ' ' || u.nom), a.admin_log) AS auteur_nom,
            u.photo_url AS auteur_photo
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

/**
 * La conversation a deux qui reunit deja ces deux personnes, s'il y en a
 * une.
 *
 * Ecrire deux fois a la meme personne doit continuer le meme fil, comme
 * partout ailleurs. Le compte des participants est verifie : une
 * conversation de groupe qui contiendrait ces deux-la n'est pas celle
 * qu'on cherche.
 */
export async function trouverEntre(a, b, client = null) {
  const colonneA = a.type === 'admin' ? 'admin_id' : 'utilisateur_id';
  const colonneB = b.type === 'admin' ? 'admin_id' : 'utilisateur_id';

  const resultat = await query(
    `SELECT c.id
       FROM conversation c
      WHERE (SELECT COUNT(*) FROM conversation_participant WHERE conversation_id = c.id) = 2
        AND EXISTS (SELECT 1 FROM conversation_participant
                     WHERE conversation_id = c.id AND ${colonneA} = $1)
        AND EXISTS (SELECT 1 FROM conversation_participant
                     WHERE conversation_id = c.id AND ${colonneB} = $2)
      LIMIT 1`,
    [a.id, b.id],
    client
  );
  return resultat.rows[0]?.id ?? null;
}

/** Ouvre une conversation entre des participants. */
export async function creer(participants, client = null) {
  const conversation = await query(
    `INSERT INTO conversation DEFAULT VALUES RETURNING id`,
    [],
    client
  );
  const id = conversation.rows[0].id;

  for (const acteur of participants) {
    await query(
      `INSERT INTO conversation_participant (conversation_id, utilisateur_id, admin_id)
       VALUES ($1, $2, $3)`,
      [
        id,
        acteur.type === 'admin' ? null : acteur.id,
        acteur.type === 'admin' ? acteur.id : null,
      ],
      client
    );
  }
  return id;
}

/** Depose un message et remonte la conversation. */
export async function ajouterMessage({ conversationId, acteur, corps }, client = null) {
  const resultat = await query(
    `INSERT INTO conversation_message (conversation_id, utilisateur_id, admin_id, corps)
     VALUES ($1, $2, $3, $4)
     RETURNING id, corps, cree_le`,
    [
      conversationId,
      acteur.type === 'admin' ? null : acteur.id,
      acteur.type === 'admin' ? acteur.id : null,
      corps,
    ],
    client
  );

  await query('UPDATE conversation SET maj_le = NOW() WHERE id = $1', [conversationId], client);
  return versObjet(resultat.rows[0]);
}

/** Marque la conversation lue jusqu'a maintenant, pour cet acteur. */
export async function marquerLue(acteur, conversationId, client = null) {
  const colonne = acteur.type === 'admin' ? 'admin_id' : 'utilisateur_id';
  await query(
    `UPDATE conversation_participant
        SET lu_jusqu_a = NOW()
      WHERE conversation_id = $1 AND ${colonne} = $2`,
    [conversationId, acteur.id],
    client
  );
}

/** Le nombre de conversations qui portent du non-lu, pour la pastille. */
export async function compterNonLues(acteur, client = null) {
  const colonne = acteur.type === 'admin' ? 'admin_id' : 'utilisateur_id';
  const colonneMessage = acteur.type === 'admin' ? 'm.admin_id' : 'm.utilisateur_id';

  const resultat = await query(
    `SELECT COUNT(*)::int AS total
       FROM conversation_participant p
      WHERE p.${colonne} = $1
        AND EXISTS (
          SELECT 1 FROM conversation_message m
           WHERE m.conversation_id = p.conversation_id
             AND ${colonneMessage} IS DISTINCT FROM $1
             AND (p.lu_jusqu_a IS NULL OR m.cree_le > p.lu_jusqu_a)
        )`,
    [acteur.id],
    client
  );
  return resultat.rows[0].total;
}

/**
 * L'annuaire : qui peut-on joindre.
 *
 * Les comptes actifs et l'equipe. On s'y exclut soi-meme : s'ecrire a
 * soi-meme n'a pas de sens, et la conversation a deux qui en resulterait
 * n'aurait qu'un participant.
 */
export async function annuaire(acteur, client = null) {
  const resultat = await query(
    `SELECT 'utilisateur' AS type, u.id::text AS id,
            TRIM(u.prenom || ' ' || u.nom) AS nom, u.email, u.photo_url,
            COALESCE(r.role, 'utilisateur') AS role
       FROM utilisateur u
       LEFT JOIN LATERAL (
         SELECT role FROM utilisateur_role WHERE utilisateur_id = u.id LIMIT 1
       ) r ON TRUE
      WHERE u.statut = 'actif'
        AND ($1::text IS NULL OR u.id::text <> $1::text)

      UNION ALL

      SELECT 'admin' AS type, a.id::text, a.admin_log, NULL, NULL, 'equipe'
        FROM admins a
       WHERE ($2::int IS NULL OR a.id <> $2::int)

      ORDER BY role, nom`,
    [
      acteur.type === 'utilisateur' ? String(acteur.id) : null,
      acteur.type === 'admin' ? Number(acteur.id) : null,
    ],
    client
  );
  return versListe(resultat.rows);
}
