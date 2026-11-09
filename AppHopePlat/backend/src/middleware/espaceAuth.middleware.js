import jwt from 'jsonwebtoken';

import { config } from '../config/env.js';
import * as volunteerRepository from '../repositories/volunteer.repository.js';
import {
  AUDIENCE_BAILLEUR,
  AUDIENCE_BENEVOLE,
  AUDIENCE_DONATEUR,
  AUDIENCE_PAR_TYPE,
  EMETTEUR,
} from '../shared/audiences.js';
import { ErreurAuthentification } from '../shared/errors.js';
import { lireJetonEspace } from '../shared/session.js';
import { exigerSessionFraicheUtilisateur } from '../services/session.service.js';

const AUDIENCES = [AUDIENCE_BENEVOLE, AUDIENCE_BAILLEUR, AUDIENCE_DONATEUR];

const TYPE_PAR_AUDIENCE = Object.fromEntries(
  Object.entries(AUDIENCE_PAR_TYPE).map(([type, audience]) => [audience, type])
);

async function exigerCompteActif(charge) {
  if (charge.portee) {
    throw new ErreurAuthentification(
      'Ce jeton ne vaut que pour compléter votre fiche.',
      'JETON_LIMITE'
    );
  }
  const compte = await volunteerRepository.trouverParId(charge.utilisateurId);
  if (!compte) {
    throw new ErreurAuthentification('Compte introuvable.', 'COMPTE_INTROUVABLE');
  }
  if (compte.statut !== 'actif') {
    throw new ErreurAuthentification('Ce compte n’est plus actif.', 'COMPTE_INACTIF');
  }
  if (!(compte.roles ?? []).includes(TYPE_PAR_AUDIENCE[charge.aud])) {
    throw new ErreurAuthentification(
      'Ce compte n’a pas accès à cet espace.',
      'ROLE_MANQUANT'
    );
  }
}

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

    await exigerCompteActif(charge);
    await exigerSessionFraicheUtilisateur(charge.utilisateurId, charge);

    req.utilisateurId = charge.utilisateurId;
    req.espace = charge.aud;

    next();
  } catch (erreur) {
    next(erreur);
  }
}
