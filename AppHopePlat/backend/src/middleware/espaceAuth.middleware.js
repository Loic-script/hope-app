/**
 * Middleware commun aux espaces utilisateurs.
 *
 * Les notifications et les messages ne dependent pas du role : un
 * benevole et un bailleur lisent les leurs de la meme facon. Ce verrou
 * accepte donc les trois audiences d'utilisateur -- et elles seules.
 * Un jeton d'administrateur est rejete : l'equipe a son propre fil,
 * indexe sur d'autres tables.
 *
 * Il ne recharge pas le compte depuis PostgreSQL, contrairement aux
 * verrous de chaque espace : ceux-ci sont montes en amont sur les
 * routes metier et ont deja verifie que le compte est actif. Ici on ne
 * lit que du courrier, et l'identifiant suffit.
 */
import jwt from 'jsonwebtoken';

import { config } from '../config/env.js';
import {
  AUDIENCE_BAILLEUR,
  AUDIENCE_BENEVOLE,
  AUDIENCE_DONATEUR,
  EMETTEUR,
} from '../shared/audiences.js';
import { ErreurAuthentification } from '../shared/errors.js';
import { lireJetonEspace } from '../shared/session.js';
import { exigerSessionFraicheUtilisateur } from '../services/session.service.js';

const AUDIENCES = [AUDIENCE_BENEVOLE, AUDIENCE_BAILLEUR, AUDIENCE_DONATEUR];

export async function authenticateEspace(req, _res, next) {
  try {
    const jeton = lireJetonEspace(req);
    if (!jeton) {
      throw new ErreurAuthentification(
        'Jeton d’authentification manquant.',
        'JETON_MANQUANT'
      );
    }

    let charge;
    try {
      charge = jwt.verify(jeton, config.jwt.secret, {
        issuer: EMETTEUR,
        audience: AUDIENCES,
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

    if (!charge.utilisateurId) {
      throw new ErreurAuthentification('Jeton invalide.', 'JETON_INVALIDE');
    }

    await exigerSessionFraicheUtilisateur(charge.utilisateurId, charge);

    req.utilisateurId = charge.utilisateurId;
    // L'audience dit de quel espace vient la demande. Rien ne s'en sert
    // encore ; elle est la pour les journaux et pour le jour ou une
    // notification devra pointer vers le bon espace.
    req.espace = charge.aud;

    next();
  } catch (erreur) {
    next(erreur);
  }
}
