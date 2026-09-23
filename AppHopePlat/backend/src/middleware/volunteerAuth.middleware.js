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

    /*
     * Le jeton remis a l'inscription ne vaut que pour la fiche a
     * remplir. Sans ce refus, il ouvrirait tout l'espace le jour ou
     * l'equipe validerait le compte -- deux heures de sursis, mais deux
     * heures de trop.
     */
    if (charge.portee === volunteerAuthService.PORTEE_COMPLETION) {
      throw new ErreurAuthentification(
        'Ce jeton ne vaut que pour compléter votre fiche.',
        'JETON_LIMITE'
      );
    }

    req.benevole = await volunteerAuthService.recupererBenevoleAuthentifie(
      charge.utilisateurId
    );

    next();
  } catch (erreur) {
    next(erreur);
  }
}

/**
 * Le verrou de la seule route ouverte a un compte en attente : remplir
 * sa fiche, juste apres l'inscription.
 *
 * Il accepte deux jetons, et rien d'autre :
 *
 *   * celui remis a l'inscription, limite a cette route ;
 *   * celui d'un benevole deja actif dont la fiche n'est pas remplie --
 *     un compte ouvert avant que ce formulaire n'existe, par exemple.
 *
 * Dans les deux cas le compte est recharge : ni un compte suspendu, ni
 * une fiche deja enregistree ne passent.
 */
export async function authenticateVolunteerACompleter(req, _res, next) {
  try {
    const jeton = lireJeton(req);
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

    next();
  } catch (erreur) {
    next(erreur);
  }
}
