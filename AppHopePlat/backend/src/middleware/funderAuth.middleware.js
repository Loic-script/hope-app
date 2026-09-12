/**
 * Middleware de protection de l'espace bailleur.
 *
 * Lit le jeton, verifie sa signature et son audience, puis RECHARGE le
 * contact et son organisation depuis PostgreSQL. Un jeton reste valable
 * deux heures : sans ce rechargement, un acces retire continuerait de
 * fonctionner jusqu'a l'expiration.
 *
 * req.bailleur porte l'organisation resolue. Toute la suite filtre sur
 * bailleurId, jamais sur l'identifiant de la personne.
 */
import * as funderAuthService from '../services/funderAuth.service.js';
import { ErreurAuthentification } from '../shared/errors.js';

function lireJeton(req) {
  const entete = req.headers.authorization;
  if (!entete || typeof entete !== 'string') return null;

  const [schema, valeur] = entete.split(' ');
  if (!valeur || schema.toLowerCase() !== 'bearer') return null;

  const jeton = valeur.trim();
  return jeton === '' ? null : jeton;
}

export async function authenticateFunder(req, _res, next) {
  try {
    const jeton = lireJeton(req);
    if (!jeton) {
      throw new ErreurAuthentification(
        'Jeton d’authentification manquant.',
        'JETON_MANQUANT'
      );
    }

    // L'audience "hope-bailleur" est verifiee ici : un jeton
    // d'administrateur ou de benevole est rejete, meme s'il est valide.
    const charge = funderAuthService.verifierJeton(jeton);

    req.bailleur = await funderAuthService.recupererBailleurAuthentifie(
      charge.utilisateurId
    );

    next();
  } catch (erreur) {
    next(erreur);
  }
}

/**
 * Refuse l'acces a un contact dont la consultation a ete retiree.
 *
 * A monter apres authenticateFunder. Le refus est un 403 : la personne
 * est authentifiee, ce sont ses droits qui ne suffisent pas.
 */
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

/**
 * Refuse les ecrans de donnees a un bailleur qui n'a pas encore declare
 * son organisation.
 *
 * L'inscription commune aux trois types ne recueille ni la raison
 * sociale ni le type d'organisation, tous deux obligatoires en base :
 * ils sont demandes a la premiere connexion. Tant que c'est fait, il n'y
 * a pas de bailleur_id sur quoi filtrer, donc rien a montrer.
 *
 * Le code renvoye permet au frontend de router vers le formulaire au
 * lieu d'afficher une erreur.
 */
export function exigerOrganisation(req, _res, next) {
  if (!req.bailleur?.bailleurId) {
    const erreur = new ErreurAuthentification(
      'Renseignez votre organisation pour accéder à votre espace.',
      'ORGANISATION_MANQUANTE'
    );
    erreur.statut = 409;
    next(erreur);
    return;
  }
  next();
}
