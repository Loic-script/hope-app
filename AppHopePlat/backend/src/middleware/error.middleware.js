import { ErreurApplicative } from '../shared/errors.js';
import { estProduction } from '../config/env.js';
import { signalerErreur } from '../services/surveillance.service.js';

export function routeIntrouvable(req, res) {
  res.status(404).json({
    success: false,
    code: 'ROUTE_INTROUVABLE',
    message: `Route introuvable : ${req.method} ${req.originalUrl}`,
  });
}

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

  if (erreur.type === 'entity.parse.failed' || erreur instanceof SyntaxError) {
    return res.status(400).json({
      success: false,
      code: 'JSON_INVALIDE',
      message: 'Le corps de la requete n\'est pas un JSON valide.',
    });
  }

  if (erreur.code === '22P02') {
    return res.status(400).json({
      success: false,
      code: 'IDENTIFIANT_INVALIDE',
      message: 'Identifiant invalide.',
    });
  }

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

  const statut = Number(erreur.status ?? erreur.statusCode);
  if (statut >= 400 && statut < 500) {
    return res.status(statut).json({
      success: false,
      code: statut === 404 ? 'FICHIER_INTROUVABLE' : 'REQUETE_INVALIDE',
      message: statut === 404 ? 'Ressource introuvable.' : 'Requête refusée.',
    });
  }

  console.error(`[HOPE] Erreur non geree sur ${req.method} ${req.originalUrl.split('?')[0]} :`, erreur);
  signalerErreur(req, erreur);

  return res.status(500).json({
    success: false,
    code: 'ERREUR_SERVEUR',
    message: 'Une erreur interne est survenue.',
    ...(estProduction ? {} : { detail: erreur.message }),
  });
}
