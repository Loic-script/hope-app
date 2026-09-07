/**
 * Middleware de protection des routes administrateur.
 *
 * Lit l'en-tete "Authorization: Bearer <jwt>", verifie la signature et
 * l'expiration, puis depose l'identite dans req.admin pour la suite de la
 * chaine. Toute route qui n'accepte que l'administrateur connecte doit passer
 * par ici.
 */
import * as adminAuthService from '../services/adminAuth.service.js';
import { ErreurAuthentification } from '../shared/errors.js';

/** Extrait le jeton de l'en-tete Authorization. */
function lireJeton(req) {
  const entete = req.headers.authorization;
  if (!entete || typeof entete !== 'string') return null;

  const [schema, valeur] = entete.split(' ');
  if (!valeur || schema.toLowerCase() !== 'bearer') return null;

  const jeton = valeur.trim();
  return jeton === '' ? null : jeton;
}

export function authenticateAdmin(req, _res, next) {
  try {
    const jeton = lireJeton(req);
    if (!jeton) {
      throw new ErreurAuthentification('Jeton d\'authentification manquant.', 'JETON_MANQUANT');
    }

    const charge = adminAuthService.verifierJeton(jeton);

    req.admin = {
      id: charge.adminId,
      adminLog: charge.adminLog,
    };

    next();
  } catch (erreur) {
    next(erreur);
  }
}
