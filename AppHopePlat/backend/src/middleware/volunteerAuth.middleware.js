import * as volunteerAuthService from '../services/volunteerAuth.service.js';
import { ErreurAuthentification } from '../shared/errors.js';
import { lireJeton } from '../shared/session.js';
import { exigerSessionFraicheUtilisateur } from '../services/session.service.js';

export async function authenticateVolunteer(req, _res, next) {
  try {
    const jeton = lireJeton(req, 'benevole');
    if (!jeton) {
      throw new ErreurAuthentification(
        'Jeton d’authentification manquant.',
        'JETON_MANQUANT'
      );
    }

    const charge = volunteerAuthService.verifierJeton(jeton);

    if (charge.portee === volunteerAuthService.PORTEE_COMPLETION) {
      throw new ErreurAuthentification(
        'Ce jeton ne vaut que pour compléter votre fiche.',
        'JETON_LIMITE'
      );
    }

    req.benevole = await volunteerAuthService.recupererBenevoleAuthentifie(
      charge.utilisateurId
    );
    await exigerSessionFraicheUtilisateur(charge.utilisateurId, charge);

    next();
  } catch (erreur) {
    next(erreur);
  }
}

export async function authenticateVolunteerACompleter(req, _res, next) {
  try {
    const jeton = lireJeton(req, 'benevole');
    if (!jeton) {
      throw new ErreurAuthentification(
        'Jeton d’authentification manquant.',
        'JETON_MANQUANT'
      );
    }

    const charge = volunteerAuthService.verifierJeton(jeton);
    req.benevole = await volunteerAuthService.recupererBenevoleACompleter(
      charge.utilisateurId
    );
    await exigerSessionFraicheUtilisateur(charge.utilisateurId, charge);

    next();
  } catch (erreur) {
    next(erreur);
  }
}
