/**
 * Controleurs des notifications et des messages des espaces.
 *
 * Lecture de la requete, appel du service, formatage : aucune regle
 * metier ici. L'identifiant de l'utilisateur vient du middleware, jamais
 * du corps ni de l'URL -- c'est ce qui empeche de lire le courrier d'un
 * autre en changeant un parametre.
 */
import * as espaceService from '../services/espace.service.js';

/** GET /api/espace/notifications */
export async function listerNotifications(req, res, next) {
  try {
    const items = await espaceService.listerNotifications(req.utilisateurId);
    res.status(200).json({ items });
  } catch (erreur) {
    next(erreur);
  }
}

/** PATCH /api/espace/notifications/:id/lue */
export async function marquerLue(req, res, next) {
  try {
    const resultat = await espaceService.marquerLue(req.utilisateurId, req.params.id);
    res.status(200).json({ success: true, ...resultat });
  } catch (erreur) {
    next(erreur);
  }
}

/** PATCH /api/espace/notifications/lues */
export async function marquerToutLu(req, res, next) {
  try {
    const resultat = await espaceService.marquerToutLu(req.utilisateurId);
    res.status(200).json({ success: true, ...resultat });
  } catch (erreur) {
    next(erreur);
  }
}

/**
 * GET /api/espace/messages
 *
 * L'ouverture de la boite vaut lecture des reponses : la pastille
 * s'eteint ici, et non sur un bouton que personne ne cliquerait.
 */
export async function listerMessages(req, res, next) {
  try {
    const items = await espaceService.listerMessages(req.utilisateurId);
    await espaceService.marquerReponsesLues(req.utilisateurId);
    res.status(200).json({ items });
  } catch (erreur) {
    next(erreur);
  }
}

/** POST /api/espace/messages */
export async function envoyerMessage(req, res, next) {
  try {
    const message = await espaceService.envoyerMessage(req.utilisateurId, req.body ?? {});
    res.status(201).json({ success: true, message });
  } catch (erreur) {
    next(erreur);
  }
}

/** GET /api/espace/badges */
export async function badges(req, res, next) {
  try {
    res.status(200).json(await espaceService.compteurs(req.utilisateurId));
  } catch (erreur) {
    next(erreur);
  }
}
