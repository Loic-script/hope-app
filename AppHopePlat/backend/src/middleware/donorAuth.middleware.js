/**
 * Middleware de protection de l'espace donateur.
 *
 * L'espace lui-meme n'est pas encore construit : il n'y a qu'une page
 * de bienvenue. Le verrou existe deja pour qu'elle ne soit pas ouverte
 * a tous, et pour que l'espace s'y greffe sans le refaire.
 *
 * Comme ailleurs, le compte est RECHARGE depuis PostgreSQL a chaque
 * appel : un jeton vaut deux heures, un compte suspendu ne doit pas en
 * profiter jusqu'au bout.
 */
import jwt from 'jsonwebtoken';

import { config } from '../config/env.js';
import * as volunteerRepository from '../repositories/volunteer.repository.js';
import { AUDIENCE_DONATEUR, EMETTEUR } from '../shared/audiences.js';
import { ErreurAuthentification } from '../shared/errors.js';
import { versUtilisateurPublic } from '../services/auth.service.js';

function lireJeton(req) {
  const entete = req.headers.authorization;
  if (!entete || typeof entete !== 'string') return null;

  const [schema, valeur] = entete.split(' ');
  if (!valeur || schema.toLowerCase() !== 'bearer') return null;

  const jeton = valeur.trim();
  return jeton === '' ? null : jeton;
}

/** Verifie un JWT de l'espace donateur. */
export function verifierJeton(token) {
  try {
    return jwt.verify(token, config.jwt.secret, {
      issuer: EMETTEUR,
      audience: AUDIENCE_DONATEUR,
    });
  } catch (erreur) {
    if (erreur.name === 'TokenExpiredError') {
      throw new ErreurAuthentification(
        'Session expirée, veuillez vous reconnecter.',
        'JETON_EXPIRE'
      );
    }
    throw new ErreurAuthentification('Jeton invalide.', 'JETON_INVALIDE');
  }
}

export async function authenticateDonor(req, _res, next) {
  try {
    const jeton = lireJeton(req);
    if (!jeton) {
      throw new ErreurAuthentification(
        'Jeton d’authentification manquant.',
        'JETON_MANQUANT'
      );
    }

    // L'audience "hope-donateur" est verifiee ici : un jeton des autres
    // espaces est rejete, meme s'il est parfaitement valide.
    const charge = verifierJeton(jeton);

    const compte = await volunteerRepository.trouverParId(charge.utilisateurId);
    if (!compte) {
      throw new ErreurAuthentification('Compte introuvable.', 'COMPTE_INTROUVABLE');
    }
    if (compte.statut !== 'actif') {
      throw new ErreurAuthentification('Ce compte n’est plus actif.', 'COMPTE_INACTIF');
    }
    if (!(compte.roles ?? []).includes('donateur')) {
      throw new ErreurAuthentification(
        'Ce compte n’a pas accès à l’espace donateur.',
        'ROLE_MANQUANT'
      );
    }

    req.donateur = versUtilisateurPublic(compte, 'donateur');
    next();
  } catch (erreur) {
    next(erreur);
  }
}
