import jwt from 'jsonwebtoken';

import { config } from '../config/env.js';
import * as volunteerRepository from '../repositories/volunteer.repository.js';
import { AUDIENCE_DONATEUR, EMETTEUR } from '../shared/audiences.js';
import { ErreurAuthentification } from '../shared/errors.js';
import { versUtilisateurPublic } from '../services/auth.service.js';
import { exigerSessionFraicheUtilisateur } from '../services/session.service.js';
import { lireJeton } from '../shared/session.js';

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
    const jeton = lireJeton(req, 'donateur');
    if (!jeton) {
      throw new ErreurAuthentification(
        'Jeton d’authentification manquant.',
        'JETON_MANQUANT'
      );
    }

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

    await exigerSessionFraicheUtilisateur(compte.id, charge);

    req.donateur = versUtilisateurPublic(compte, 'donateur');
    next();
  } catch (erreur) {
    next(erreur);
  }
}
