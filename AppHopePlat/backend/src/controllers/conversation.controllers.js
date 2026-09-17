/**
 * Controleurs de la messagerie, partages par les espaces et
 * l'administration.
 *
 * L'acteur est deduit de ce que le verrou a pose sur la requete :
 * req.admin pour l'equipe, req.utilisateurId pour un espace. Il ne vient
 * jamais du corps ni de l'URL -- c'est ce qui empeche d'ecrire sous
 * l'identite d'un autre.
 */
import * as conversationService from '../services/conversation.service.js';

import { gerer } from './handler.js';

/** Qui parle, d'apres ce que le verrou a etabli. */
export function acteurDe(req) {
  if (req.admin?.id) return { type: 'admin', id: req.admin.id };
  return { type: 'utilisateur', id: req.utilisateurId ?? req.benevole?.utilisateurId };
}

/** "moi" accompagne chaque reponse : l'ecran n'a pas a deviner qui il est. */
function moi(req) {
  const acteur = acteurDe(req);
  return { type: acteur.type, id: String(acteur.id) };
}

export const conversations = {
  lister: gerer(async (req) => ({
    moi: moi(req),
    ...(await conversationService.lister(acteurDe(req))),
  })),

  joignables: gerer((req) => conversationService.joignables(acteurDe(req))),

  nonLus: gerer((req) => conversationService.nonLus(acteurDe(req))),

  recuperer: gerer(async (req) => ({
    moi: moi(req),
    ...(await conversationService.recuperer(acteurDe(req), req.params.id)),
  })),

  marquerLu: gerer((req) => conversationService.marquerLu(acteurDe(req), req.params.id, req.body ?? {})),

  ouvrir: gerer((req) => conversationService.ouvrir(acteurDe(req), req.body ?? {}), { statut: 201 }),

  envoyer: gerer(
    async (req) => ({
      message: await conversationService.envoyer(acteurDe(req), req.params.id, req.body ?? {}),
    }),
    { statut: 201 }
  ),
};
