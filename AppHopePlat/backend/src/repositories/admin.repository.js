import { query } from '../config/database.js';

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

const COLONNES = `
  id, admin_log, full_name, role, status, photo_url,
  last_login_at, created_at, updated_at
`;

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

export async function trouverParId(id) {
  const resultat = await query(`SELECT ${COLONNES} FROM admins WHERE id = $1 LIMIT 1`, [id]);
  return versAdmin(resultat.rows[0]);
}

export async function lister() {
  const resultat = await query(`SELECT ${COLONNES} FROM admins ORDER BY id`);
  return resultat.rows.map(versAdmin);
}

export async function creer(donnees, client = null) {
  const resultat = await query(
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

export async function mettreAJourMotDePasse(id, passwordHash) {
  const resultat = await query(
    `UPDATE admins SET password_hash = $2 WHERE id = $1 RETURNING ${COLONNES}`,
    [id, passwordHash]
  );
  return versAdmin(resultat.rows[0]);
}

export async function marquerConnexion(id) {
  await query('UPDATE admins SET last_login_at = NOW() WHERE id = $1', [id]);
}

export async function existe(adminLog) {
  const resultat = await query('SELECT 1 FROM admins WHERE admin_log = $1 LIMIT 1', [adminLog]);
  return resultat.rowCount > 0;
}

export async function compterAdministrateursActifs(saufId = null) {
  const resultat = await query(
    `SELECT COUNT(*)::int AS total FROM admins
      WHERE role = 'ADMIN' AND status = 'ACTIVE' AND ($1::int IS NULL OR id <> $1)`,
    [saufId]
  );
  return resultat.rows[0].total;
}
