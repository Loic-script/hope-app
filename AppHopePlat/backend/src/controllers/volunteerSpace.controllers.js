/**
 * Controleurs de l'espace benevole.
 *
 * Lecture de la requete, appel du service, formatage : aucune regle
 * metier ici. req.benevole est pose par authenticateVolunteer et porte
 * l'identifiant du compte utilisateur.
 */
import * as missionService from '../services/mission.service.js';
import * as taskService from '../services/task.service.js';
import * as volunteerProfileService from '../services/volunteerProfile.service.js';

import { gerer } from './handler.js';

/**
 * Identifiant de la fiche benevole liee au compte connecte.
 *
 * Les listes de missions s'en servent pour marquer celles ou le
 * benevole est deja inscrit.
 */
async function ficheDe(req) {
  const profil = await volunteerProfileService.recuperer(req.benevole.id);
  return profil.id;
}

export const missions = {
  apercu: gerer(() => missionService.apercu()),
  lister: gerer(async (req) => missionService.lister(req.query, await ficheDe(req))),
  recuperer: gerer(async (req) =>
    missionService.recupererParId(req.params.id, await ficheDe(req))
  ),
  mesMissions: gerer(async (req) => missionService.mesMissions(await ficheDe(req))),
  sInscrire: gerer((req) => missionService.sInscrire(req.params.id, req.benevole.id), {
    statut: 201,
  }),
  seDesinscrire: gerer((req) =>
    missionService.seDesinscrire(req.params.id, req.benevole.id, req.body)
  ),
  laisserUnAvis: gerer(
    (req) => missionService.laisserUnAvis(req.params.id, req.benevole.id, req.body),
    { statut: 201 }
  ),
};

export const taches = {
  libres: gerer(() => taskService.listerLibres()),
  miennes: gerer((req) => taskService.mesTaches(req.benevole.id, req.query)),
  prendre: gerer((req) => taskService.prendre(req.params.id, req.benevole.id)),
  relacher: gerer((req) => taskService.relacher(req.params.id, req.benevole.id)),
  livrer: gerer((req) => taskService.livrer(req.params.id, req.benevole.id)),
};

export const profil = {
  completer: gerer(
    (req) => volunteerProfileService.completer(req.benevole.id, req.body),
    { statut: 201 }
  ),
  recuperer: gerer((req) => volunteerProfileService.recuperer(req.benevole.id)),
  mettreAJour: gerer((req) => volunteerProfileService.mettreAJour(req.benevole.id, req.body)),
  journal: gerer((req) => volunteerProfileService.journal(req.benevole.id)),
};
