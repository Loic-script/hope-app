import { query } from '../config/database.js';
import { verifierFraicheur } from '../shared/session.js';

function maintenantALaSeconde() {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
}

export async function exigerSessionFraicheUtilisateur(utilisateurId, charge) {
  const { rows } = await query('SELECT sessions_valides_depuis FROM utilisateur WHERE id = $1', [utilisateurId]);
  verifierFraicheur(charge, rows[0]?.sessions_valides_depuis ?? null);
}

export async function exigerSessionFraicheAdmin(adminId, charge) {
  const { rows } = await query('SELECT sessions_valides_depuis FROM admins WHERE id = $1', [adminId]);
  verifierFraicheur(charge, rows[0]?.sessions_valides_depuis ?? null);
}

export async function fermerSessionsUtilisateur(utilisateurId, client = null) {
  await query('UPDATE utilisateur SET sessions_valides_depuis = $2 WHERE id = $1', [utilisateurId, maintenantALaSeconde()], client);
}

export async function fermerSessionsAdmin(adminId, client = null) {
  await query('UPDATE admins SET sessions_valides_depuis = $2 WHERE id = $1', [adminId, maintenantALaSeconde()], client);
}
