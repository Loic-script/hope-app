/**
 * La fermeture des sessions d'un compte.
 *
 * Un JWT ne se revoque pas : il vaut jusqu'a son expiration. Pour qu'un
 * changement de mot de passe ferme les sessions ouvertes ailleurs, le
 * compte garde la date a partir de laquelle ses jetons comptent
 * (sessions_valides_depuis) ; un jeton emis avant est refuse.
 *
 * La date est prise a l'horloge du serveur Node et arrondie a la seconde
 * inferieure, comme le champ iat des jetons : le jeton neuf remis juste
 * apres la fermeture passe donc toujours, meme si l'horloge de la base
 * avance un peu.
 */
import { query } from '../config/database.js';
import { verifierFraicheur } from '../shared/session.js';

function maintenantALaSeconde() {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
}

/** Refuse un jeton d'utilisateur emis avant la fermeture des sessions. */
export async function exigerSessionFraicheUtilisateur(utilisateurId, charge) {
  const { rows } = await query('SELECT sessions_valides_depuis FROM utilisateur WHERE id = $1', [utilisateurId]);
  verifierFraicheur(charge, rows[0]?.sessions_valides_depuis ?? null);
}

/** Meme chose pour un compte de l'equipe. */
export async function exigerSessionFraicheAdmin(adminId, charge) {
  const { rows } = await query('SELECT sessions_valides_depuis FROM admins WHERE id = $1', [adminId]);
  verifierFraicheur(charge, rows[0]?.sessions_valides_depuis ?? null);
}

/** Ferme toutes les sessions ouvertes d'un utilisateur. */
export async function fermerSessionsUtilisateur(utilisateurId, client = null) {
  await query('UPDATE utilisateur SET sessions_valides_depuis = $2 WHERE id = $1', [utilisateurId, maintenantALaSeconde()], client);
}

/** Ferme toutes les sessions ouvertes d'un compte de l'equipe. */
export async function fermerSessionsAdmin(adminId, client = null) {
  await query('UPDATE admins SET sessions_valides_depuis = $2 WHERE id = $1', [adminId, maintenantALaSeconde()], client);
}
