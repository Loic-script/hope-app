import * as funderAuthService from '../services/funderAuth.service.js';
import { ErreurAuthentification } from '../shared/errors.js';
import { lireJeton } from '../shared/session.js';
import { exigerSessionFraicheUtilisateur } from '../services/session.service.js';

export async function authenticateFunder(req, _res, next) {
  try {
    const jeton = lireJeton(req, 'bailleur');
    if (!jeton) {
      throw new ErreurAuthentification(
        'Jeton d’authentification manquant.',
        'JETON_MANQUANT'
      );
    }

    const charge = funderAuthService.verifierJeton(jeton);

    req.bailleur = await funderAuthService.recupererBailleurAuthentifie(
      charge.utilisateurId
    );
    await exigerSessionFraicheUtilisateur(charge.utilisateurId, charge);

    next();
  } catch (erreur) {
    next(erreur);
  }
}

export function exigerConsultation(req, _res, next) {
  if (req.bailleur?.peutConsulter === false) {
    const erreur = new ErreurAuthentification(
      'Votre accès est suspendu. Contactez l’équipe HOPE.',
      'CONSULTATION_INTERDITE'
    );
    erreur.statut = 403;
    next(erreur);
    return;
  }
  next();
}

export function exigerOrganisation(req, _res, next) {
  if (!req.bailleur?.bailleurId) {
    const erreur = new ErreurAuthentification(
      'Votre organisation est introuvable. Contactez l’équipe HOPE.',
      'ORGANISATION_MANQUANTE'
    );
    erreur.statut = 409;
    next(erreur);
    return;
  }
  next();
}
