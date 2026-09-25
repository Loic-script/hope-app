/**
 * Repository des comptes benevoles.
 *
 * Un compte vit dans "utilisateur", ses roles dans "utilisateur_role".
 * Les deux tables sont toujours lues ensemble : un compte sans role ne
 * mene a aucun espace.
 */
import { query, transaction } from '../config/database.js';
import { versListe, versObjet } from '../shared/mapping.js';

/**
 * Colonnes exposees hors du repository.
 *
 * mot_de_passe n'y figure pas : le hash ne sort que par
 * trouverParEmailAvecHash, et uniquement pour la comparaison bcrypt.
 */
const COLONNES = `
  u.id, u.nom, u.prenom, u.telephone, u.email, u.photo_url, u.adresse,
  u.date_de_naissance, u.statut, u.telephone_verifie, u.profil_complete,
  u.cree_le, u.derniere_connexion, u.active_le, u.active_par,
  a.admin_log AS active_par_log,
  COALESCE(r.roles, ARRAY[]::TEXT[]) AS roles
`;

const JOINTURES = `
  LEFT JOIN admins a ON a.id = u.active_par
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(role ORDER BY role) AS roles
      FROM utilisateur_role
     WHERE utilisateur_id = u.id
  ) r ON TRUE
`;

/**
 * Cree le compte et lui attribue ses roles, en une seule transaction.
 *
 * Un client peut etre passe : l'inscription d'un bailleur cree aussi
 * son organisation, et le tout doit tenir dans une seule transaction
 * plutot que d'en imbriquer une seconde.
 */
export async function creer(donnees, roles = ['benevole'], clientExterne = null) {
  const travail = async (client) => {
    const resultat = await query(
      `INSERT INTO utilisateur (nom, prenom, email, mot_de_passe, telephone,
                                conditions_version, conditions_acceptees_le)
       VALUES ($1, $2, $3, $4, $5, $6::varchar, CASE WHEN $6::varchar IS NULL THEN NULL ELSE NOW() END)
       RETURNING id`,
      [
        donnees.nom,
        donnees.prenom,
        donnees.email,
        donnees.motDePasse,
        donnees.telephone ?? null,
        // La version des conditions acceptees a l'inscription (null pour
        // un compte cree par un script ou par l'equipe).
        donnees.conditionsVersion ?? null,
      ],
      client
    );

    const id = resultat.rows[0].id;

    for (const role of roles) {
      await query(
        `INSERT INTO utilisateur_role (utilisateur_id, role)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [id, role],
        client
      );
    }

    // La fiche de terrain nait avec le compte : l'espace benevole a
    // besoin d'un identifiant de benevole des la premiere connexion, et
    // une fiche creee a la demande obligerait chaque lecture a verifier
    // son existence.
    if (roles.includes('benevole')) {
      await query(
        `INSERT INTO benevole (utilisateur_id)
         VALUES ($1)
         ON CONFLICT (utilisateur_id) DO NOTHING`,
        [id],
        client
      );
    }

    return trouverParId(id, client);
  };

  return clientExterne ? travail(clientExterne) : transaction(travail);
}

export async function trouverParId(id, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES} FROM utilisateur u ${JOINTURES} WHERE u.id = $1`,
    [id],
    client
  );
  return versObjet(resultat.rows[0]);
}

/**
 * Recherche par courriel, hash compris.
 *
 * Reserve a la connexion : c'est le seul endroit ou le hash doit sortir
 * de la base, et il ne va pas plus loin que la comparaison bcrypt.
 */
export async function trouverParEmailAvecHash(email, client = null) {
  const resultat = await query(
    `SELECT ${COLONNES}, u.mot_de_passe
       FROM utilisateur u ${JOINTURES}
      WHERE u.email = $1`,
    [email],
    client
  );
  return versObjet(resultat.rows[0]);
}

/** Vrai si le courriel est deja pris. */
export async function emailExiste(email, client = null) {
  const resultat = await query(
    'SELECT 1 FROM utilisateur WHERE email = $1 LIMIT 1',
    [email],
    client
  );
  return resultat.rowCount > 0;
}

/**
 * Liste les comptes portant un role donne.
 *
 * @param {{ role?: string, statut?: string }} filtres
 */
export async function lister({ role = 'benevole', statut = null } = {}, client = null) {
  const valeurs = [role];
  let condition = '';

  if (statut) {
    valeurs.push(statut);
    condition = `AND u.statut = $${valeurs.length}`;
  }

  const resultat = await query(
    `SELECT ${COLONNES}
       FROM utilisateur u ${JOINTURES}
      WHERE EXISTS (
        SELECT 1 FROM utilisateur_role
         WHERE utilisateur_id = u.id AND role = $1
      )
      ${condition}
      ORDER BY
        -- Les comptes a traiter remontent en tete de liste.
        CASE u.statut WHEN 'en_attente' THEN 0 ELSE 1 END,
        u.cree_le DESC`,
    valeurs,
    client
  );
  return versListe(resultat.rows);
}

/** Change le statut d'un compte et trace qui l'a fait. */
export async function changerStatut(id, statut, adminId = null, client = null) {
  const resultat = await query(
    // Le type de $2 est fixe a chaque usage : sans cela PostgreSQL le
    // deduit varchar dans l'affectation et text dans la comparaison, et
    // refuse la requete (42P08, types incoherents).
    `UPDATE utilisateur
        SET statut     = $2::VARCHAR,
            -- La trace d'activation n'est posee qu'au passage a "actif",
            -- et jamais effacee par une suspension ulterieure.
            active_le  = CASE WHEN $2::VARCHAR = 'actif' THEN NOW() ELSE active_le END,
            active_par = CASE WHEN $2::VARCHAR = 'actif' THEN $3::INTEGER ELSE active_par END
      WHERE id = $1
      RETURNING id`,
    [id, statut, adminId],
    client
  );

  if (resultat.rowCount === 0) return null;
  return trouverParId(id, client);
}

/** Horodate la connexion. Un echec ici ne doit pas faire echouer le login. */
export async function marquerConnexion(id, client = null) {
  await query('UPDATE utilisateur SET derniere_connexion = NOW() WHERE id = $1', [id], client);
}

/** Vrai si le numero est deja pris. */
export async function telephoneExiste(telephone, client = null) {
  if (!telephone) return false;
  const resultat = await query(
    'SELECT 1 FROM utilisateur WHERE telephone = $1 LIMIT 1',
    [telephone],
    client
  );
  return resultat.rowCount > 0;
}

/**
 * Marque le profil comme complete.
 *
 * Pose par les formulaires de completion, une fois la fiche propre au
 * role remplie. Sans ce marqueur, l'espace redemanderait le formulaire
 * a chaque connexion a un benevole qui n'a declare aucune competence.
 */
export async function marquerProfilComplete(id, client = null) {
  await query('UPDATE utilisateur SET profil_complete = TRUE WHERE id = $1', [id], client);
}

/** Compteurs affiches sur la pastille de l'espace administrateur. */
export async function compterParStatut(role = 'benevole', client = null) {
  const resultat = await query(
    `SELECT u.statut, COUNT(*)::int AS nombre
       FROM utilisateur u
      WHERE EXISTS (
        SELECT 1 FROM utilisateur_role
         WHERE utilisateur_id = u.id AND role = $1
      )
      GROUP BY u.statut`,
    [role],
    client
  );

  const compteurs = { en_attente: 0, actif: 0, suspendu: 0, supprime: 0 };
  for (const ligne of resultat.rows) {
    compteurs[ligne.statut] = ligne.nombre;
  }
  return compteurs;
}
