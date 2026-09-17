/**
 * Controleurs de la messagerie, partages par les espaces et
 * l'administration.
 *
 * L'acteur est deduit de ce que le verrou a pose sur la requete :
 * req.admin pour l'equipe, req.utilisateurId pour un espace. Il ne vient
 * jamais du corps ni de l'URL -- c'est ce qui empeche d'ecrire sous
 * l'identite d'un autre.
 */
import fs from 'node:fs';

import * as conversationService from '../services/conversation.service.js';
import * as pieceJointe from '../services/pieceJointe.service.js';
import { ErreurIntrouvable } from '../shared/errors.js';

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

  fichiers: gerer((req) => conversationService.fichiersPartages(acteurDe(req), req.params.id)),

  marquerLu: gerer((req) => conversationService.marquerLu(acteurDe(req), req.params.id, req.body ?? {})),

  ouvrir: gerer((req) => conversationService.ouvrir(acteurDe(req), req.body ?? {}), { statut: 201 }),

  envoyer: gerer(
    async (req) => ({
      message: await conversationService.envoyer(
        acteurDe(req),
        req.params.id,
        req.body ?? {},
        req.files ?? []
      ),
    }),
    { statut: 201 }
  ),

  modifier: gerer(async (req) => ({
    message: await conversationService.modifier(acteurDe(req), req.params.id, req.params.messageId, req.body ?? {}),
  })),

  supprimer: gerer(async (req) => ({
    message: await conversationService.supprimer(acteurDe(req), req.params.id, req.params.messageId),
  })),

  transferer: gerer(
    (req) => conversationService.transferer(acteurDe(req), req.params.id, req.params.messageId, req.body ?? {}),
    { statut: 201 }
  ),
};

/**
 * Lecture d'un fichier de la messagerie, par adresse signee.
 *
 * Aucune session ici : <img> et <video> n'en envoient pas. La signature
 * dit qui demande ; la participation est reverifiee avant de servir.
 * Toute adresse fausse, expiree ou etrangere repond 404.
 *
 * res.sendFile traite les requetes Range : une video se lit et s'avance
 * sans etre telechargee en entier.
 */
export const fichiers = {
  piece: gerer(async (req, res) => {
    const acteur = pieceJointe.verifierSignature('piece', req.params.id, req.query);
    if (!acteur) throw new ErreurIntrouvable('Le fichier', req.params.id);

    const piece = await conversationService.pieceLisible(acteur, req.params.id);
    const cheminAbsolu = pieceJointe.chemin(piece.fichier);
    if (!fs.existsSync(cheminAbsolu)) throw new ErreurIntrouvable('Le fichier', req.params.id);

    await new Promise((resolve, reject) => {
      res.sendFile(
        cheminAbsolu,
        {
          acceptRanges: true,
          lastModified: false,
          headers: {
            'Content-Type': piece.typeMime,
            'Content-Disposition': pieceJointe.disposition(piece.nomOrigine, req.query.telecharger === '1'),
            'X-Content-Type-Options': 'nosniff',
            // Prive : ni proxy ni cache partage ne doit garder une piece.
            'Cache-Control': 'private, max-age=3600',
            // L'adresse porte sa signature : elle ne doit pas fuir en Referer.
            'Referrer-Policy': 'no-referrer',
          },
        },
        (erreur) => (erreur && !res.headersSent ? reject(erreur) : resolve())
      );
    });
  }),
};
