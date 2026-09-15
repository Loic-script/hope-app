/**
 * Repository des comptes de l'equipe HOPE.
 *
 * Seule couche autorisee a parler SQL. Elle expose des objets JavaScript et
 * n'applique aucune regle metier (c'est le role du service).
 */
import { query } from '../config/database.js';

/**
 * Convertit une ligne PostgreSQL (snake_case) en objet metier (camelCase).
 * Le hash n'est expose que lorsque la ligne l'inclut explicitement.
 */
function versAdmin(ligne) {
  if (!ligne) return null;
  return {
    id: ligne.id,
    adminLog: ligne.admin_log,
    photoUrl: ligne.photo_url,
    passwordHash: ligne.password_hash,
    fullName: ligne.full_name,
    role: ligne.role,
    status: ligne.status,
    lastLoginAt: ligne.last_login_at,
    createdAt: ligne.created_at,
    updatedAt: ligne.updated_at,
  };
}

/** Colonnes exposables : jamais password_hash. */
const COLONNES = `
  id, admin_log, full_name, role, status, photo_url,
  last_login_at, created_at, updated_at
`;

/**
 * Recherche un compte par son identifiant de connexion.
 * Retourne le hash : cette methode est reservee au service d'authentification.
 */
/** Pose ou retire la photo de profil d'un administrateur. */
export async function mettreAJourPhoto(id, photoUrl, client = null) {
  await query('UPDATE admins SET photo_url = $2 WHERE id = $1', [id, photoUrl], client);
}

export async function trouverParLogin(adminLog) {
  const resultat = await query(
    `SELECT ${COLONNES}, password_hash FROM admins WHERE admin_log = $1 LIMIT 1`,
    [adminLog]
  );
  return versAdmin(resultat.rows[0]);
}

/**
 * Recherche un compte par son identifiant technique, sans le hash.
 * Appelee a chaque requete protegee par le middleware d'authentification.
 */
export async function trouverParId(id) {
  const resultat = await query(`SELECT ${COLONNES} FROM admins WHERE id = $1 LIMIT 1`, [id]);
  return versAdmin(resultat.rows[0]);
}

/** Tous les comptes de l'equipe, les plus recents en premier. */
export async function lister() {
  const resultat = await query(`SELECT ${COLONNES} FROM admins ORDER BY id`);
  return resultat.rows.map(versAdmin);
}

/** Cree un compte a partir d'un hash bcrypt deja calcule. */
export async function creer(donnees, client = null) {
  const resultat = await query(
    // Les valeurs par defaut sont resolues ici et non par un COALESCE :
    // reutiliser $1 pour deux colonnes de largeurs differentes empeche
    // PostgreSQL d'en deduire un type.
    `INSERT INTO admins (admin_log, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLONNES}`,
    [
      donnees.adminLog,
      donnees.passwordHash,
      donnees.fullName ?? donnees.adminLog,
      donnees.role ?? 'ADMIN',
    ],
    client
  );
  return versAdmin(resultat.rows[0]);
}

/**
 * Met a jour le nom affiche, le role ou le statut.
 * COALESCE laisse inchangee toute valeur non fournie.
 */
export async function mettreAJour(id, donnees) {
  const resultat = await query(
    `UPDATE admins
        SET full_name = COALESCE($2, full_name),
            role      = COALESCE($3, role),
            status    = COALESCE($4, status)
      WHERE id = $1
      RETURNING ${COLONNES}`,
    [id, donnees.fullName ?? null, donnees.role ?? null, donnees.status ?? null]
  );
  return versAdmin(resultat.rows[0]);
}

/** Remplace le hash d'un compte existant. */
export async function mettreAJourMotDePasse(id, passwordHash) {
  const resultat = await query(
    `UPDATE admins SET password_hash = $2 WHERE id = $1 RETURNING ${COLONNES}`,
    [id, passwordHash]
  );
  return versAdmin(resultat.rows[0]);
}

/** Horodate la derniere connexion reussie. */
export async function marquerConnexion(id) {
  await query('UPDATE admins SET last_login_at = NOW() WHERE id = $1', [id]);
}

/** Indique si la table contient deja cet identifiant de connexion. */
export async function existe(adminLog) {
  const resultat = await query('SELECT 1 FROM admins WHERE admin_log = $1 LIMIT 1', [adminLog]);
  return resultat.rowCount > 0;
}

/**
 * Nombre d'administrateurs actifs.
 *
 * Sert de garde-fou : on ne retire jamais le dernier ADMIN actif, sinon
 * plus personne ne peut gerer les comptes et la plateforme se verrouille.
 */
export async function compterAdministrateursActifs(saufId = null) {
  const resultat = await query(
    `SELECT COUNT(*)::int AS total FROM admins
      WHERE role = 'ADMIN' AND status = 'ACTIVE' AND ($1::int IS NULL OR id <> $1)`,
    [saufId]
  );
  return resultat.rows[0].total;
}
