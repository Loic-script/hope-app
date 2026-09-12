/**
 * Middleware de protection de l'espace benevole.
 *
 * Meme principe que pour l'administrateur : on lit le jeton, on verifie
 * sa signature et son audience, puis on RECHARGE le compte depuis
 * PostgreSQL. Un jeton reste valable deux heures ; sans ce rechargement,
 * un compte suspendu continuerait de travailler jusqu'a son expiration.
 */
import * as volunteerAuthService from '../services/volunteerAuth.service.js';
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

export async function authenticateVolunteer(req, _res, next) {
  try {
    const jeton = lireJeton(req);
    if (!jeton) {
      throw new ErreurAuthentification(
        'Jeton d’authentification manquant.',
        'JETON_MANQUANT'
      );
    }

    // L'audience "hope-benevole" est verifiee ici : un jeton
    // d'administrateur est rejete, meme s'il est parfaitement valide.
    const charge = volunteerAuthService.verifierJeton(jeton);

    req.benevole = await volunteerAuthService.recupererBenevoleAuthentifie(
      charge.utilisateurId
    );

    next();
  } catch (erreur) {
    next(erreur);
  }
}
