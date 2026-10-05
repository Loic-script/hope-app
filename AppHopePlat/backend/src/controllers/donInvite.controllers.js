/**
 * Le don sans compte, depuis le site vitrine (donInvite.service).
 *
 * Aucune session : le jeton remis avec le don voyage dans l'en-tete
 * X-Hope-Don, a part de toute autre autorisation du navigateur.
 */
import * as donInviteService from '../services/donInvite.service.js';
import { gerer } from './handler.js';

/** Le jeton du don, tel que le navigateur le renvoie. */
function jetonDe(req) {
  return req.get('x-hope-don') ?? '';
}

export const options = gerer(() => donInviteService.options());

export const coordonnees = gerer(() => donInviteService.coordonnees());

export const promettre = gerer((req) => donInviteService.promettre(req.body), { statut: 201 });

export const declarer = gerer((req) => donInviteService.declarer(req.params.id, req.body, jetonDe(req)));

export const carte = {
  reglages: gerer(() => donInviteService.reglagesCarte()),
  ouvrir: gerer((req) => donInviteService.ouvrirCarte(req.body, req.get('origin') ?? ''), { statut: 201 }),
  etat: gerer((req) => donInviteService.etatCarte(req.params.id, jetonDe(req))),
};
