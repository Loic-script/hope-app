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
    req.espace = charge.aud;

    next();
  } catch (erreur) {
    next(erreur);
  }
}
