/**
 * Repository des administrateurs.
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
    passwordHash: ligne.password_hash,
    createdAt: ligne.created_at,
    updatedAt: ligne.updated_at,
  };
}

/**
 * Recherche un administrateur par son identifiant de connexion.
 * Retourne le hash : cette methode est reservee au service d'authentification.
 */
export async function trouverParLogin(adminLog) {
  const resultat = await query(
    `SELECT id, admin_log, password_hash, created_at, updated_at
       FROM admins
      WHERE admin_log = $1
      LIMIT 1`,
    [adminLog]
  );
  return versAdmin(resultat.rows[0]);
}

/**
 * Recherche un administrateur par son identifiant technique, sans le hash.
 * Utilise par la route protegee /api/admin/me.
 */
export async function trouverParId(id) {
  const resultat = await query(
    `SELECT id, admin_log, created_at, updated_at
       FROM admins
      WHERE id = $1
      LIMIT 1`,
    [id]
  );
  return versAdmin(resultat.rows[0]);
}

/** Cree un administrateur a partir d'un hash bcrypt deja calcule. */
export async function creer(adminLog, passwordHash) {
  const resultat = await query(
    `INSERT INTO admins (admin_log, password_hash)
     VALUES ($1, $2)
     RETURNING id, admin_log, created_at, updated_at`,
    [adminLog, passwordHash]
  );
  return versAdmin(resultat.rows[0]);
}

/** Remplace le hash d'un administrateur existant. */
export async function mettreAJourMotDePasse(id, passwordHash) {
  const resultat = await query(
    `UPDATE admins
        SET password_hash = $2,
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, admin_log, created_at, updated_at`,
    [id, passwordHash]
  );
  return versAdmin(resultat.rows[0]);
}

/** Indique si la table admins contient deja cet identifiant. */
export async function existe(adminLog) {
  const resultat = await query('SELECT 1 FROM admins WHERE admin_log = $1 LIMIT 1', [adminLog]);
  return resultat.rowCount > 0;
}
