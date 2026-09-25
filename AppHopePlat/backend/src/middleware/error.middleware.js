/**
 * Gestion centralisee des erreurs et des routes inconnues.
 */
import { ErreurApplicative } from '../shared/errors.js';
import { estProduction } from '../config/env.js';

/** 404 : aucune route ne correspond a l'URL demandee. */
export function routeIntrouvable(req, res) {
  res.status(404).json({
    success: false,
    code: 'ROUTE_INTROUVABLE',
    message: `Route introuvable : ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Convertit une erreur en reponse JSON.
 *
 * Les erreurs applicatives portent leur propre code HTTP et un message
 * destine a l'utilisateur. Les autres deviennent une 500 dont le detail reste
 * dans les logs du serveur, jamais dans la reponse.
 */
export function gestionnaireErreurs(erreur, req, res, _next) {
  if (erreur instanceof ErreurApplicative) {
    const corps = {
      success: false,
      code: erreur.code,
      message: erreur.message,
    };
    if (erreur.details) corps.details = erreur.details;
    return res.status(erreur.statut).json(corps);
  }

  // Corps JSON illisible envoye par le client.
  if (erreur.type === 'entity.parse.failed' || erreur instanceof SyntaxError) {
    return res.status(400).json({
      success: false,
      code: 'JSON_INVALIDE',
      message: 'Le corps de la requete n\'est pas un JSON valide.',
    });
  }

  /*
   * Une valeur deja prise (PostgreSQL 23505).
   *
   * Un service qui sait de quel champ il s'agit traduit lui-meme la
   * collision -- l'inscription le fait pour l'adresse electronique. Ce
   * filet rattrape les autres : "cette valeur existe deja" est une
   * information utile, "une erreur interne est survenue" n'en est pas
   * une. Le nom de la contrainte reste dans les logs : il nomme des
   * tables et des colonnes, qui ne regardent pas le client.
   */
  if (erreur.code === '23505') {
    console.error(
      `[HOPE] Valeur deja prise sur ${req.method} ${req.originalUrl} :`,
      erreur.constraint ?? erreur.detail
    );
    return res.status(409).json({
      success: false,
      code: 'DEJA_ENREGISTRE',
      message: 'Cette valeur est déjà enregistrée.',
    });
  }

  /*
   * Une erreur HTTP deja qualifiee par Express ou un intergiciel -- un
   * fichier absent de /assets ou /media (404), un corps trop gros (413).
   * Ce n'est pas une panne du serveur : on rend son statut, sans detail.
   */
  const statut = Number(erreur.status ?? erreur.statusCode);
  if (statut >= 400 && statut < 500) {
    return res.status(statut).json({
      success: false,
      code: statut === 404 ? 'FICHIER_INTROUVABLE' : 'REQUETE_INVALIDE',
      message: statut === 404 ? 'Ressource introuvable.' : 'Requête refusée.',
    });
  }

  console.error(`[HOPE] Erreur non geree sur ${req.method} ${req.originalUrl} :`, erreur);

  return res.status(500).json({
    success: false,
    code: 'ERREUR_SERVEUR',
    message: 'Une erreur interne est survenue.',
    ...(estProduction ? {} : { detail: erreur.message }),
  });
}

