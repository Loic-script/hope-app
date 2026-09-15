/**
 * Controleurs des conversations, partages par les espaces et
 * l'administration.
 *
 * L'acteur est deduit de ce que le middleware a pose sur la requete :
 * req.utilisateurId pour un espace, req.admin pour l'equipe. Il ne vient
 * jamais du corps ni de l'URL -- c'est ce qui empeche d'ecrire sous
 * l'identite d'un autre.
 */
import * as conversationService from '../services/conversation.service.js';

/** Qui parle, d'apres ce que le verrou a etabli. */
function acteurDe(req) {
  if (req.admin?.id) return { type: 'admin', id: req.admin.id };
  return { type: 'utilisateur', id: req.utilisateurId ?? req.benevole?.utilisateurId };
}

export const conversations = {
  async lister(req, res, next) {
    try {
      const acteur = acteurDe(req);
      // "moi" accompagne la liste : sans lui, l'ecran devrait deviner
      // lequel des participants il est, et se tromperait.
      res.status(200).json({
        moi: { type: acteur.type, id: String(acteur.id) },
        items: await conversationService.lister(acteur),
      });
    } catch (erreur) {
      next(erreur);
    }
  },

  async annuaire(req, res, next) {
    try {
      res.status(200).json({ items: await conversationService.annuaire(acteurDe(req)) });
    } catch (erreur) {
      next(erreur);
    }
  },

  async recuperer(req, res, next) {
    try {
      const acteur = acteurDe(req);
      const donnees = await conversationService.recuperer(acteur, req.params.id);
      res.status(200).json({ moi: { type: acteur.type, id: String(acteur.id) }, ...donnees });
    } catch (erreur) {
      next(erreur);
    }
  },

  async ouvrir(req, res, next) {
    try {
      const resultat = await conversationService.ouvrir(acteurDe(req), req.body ?? {});
      res.status(201).json({ success: true, ...resultat });
    } catch (erreur) {
      next(erreur);
    }
  },

  async ecrire(req, res, next) {
    try {
      const message = await conversationService.ecrire(
        acteurDe(req),
        req.params.id,
        req.body ?? {}
      );
      res.status(201).json({ success: true, message });
    } catch (erreur) {
      next(erreur);
    }
  },
};
