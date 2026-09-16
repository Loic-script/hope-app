/**
 * Controleurs de l'espace benevole.
 *
 * Lecture de la requete, appel du service, formatage : aucune regle
 * metier ici. req.benevole est pose par authenticateVolunteer et porte
 * l'identifiant du compte utilisateur.
 */
import * as taskService from '../services/task.service.js';
import * as volunteerProjectsService from '../services/volunteerProjects.service.js';
import * as volunteerProfileService from '../services/volunteerProfile.service.js';
import * as mediaService from '../services/media.service.js';

import { gerer } from './handler.js';

/** Les projets, autour desquels l'espace s'organise. */
export const projets = {
  lister: gerer(() => volunteerProjectsService.lister()),
  recuperer: gerer((req) => volunteerProjectsService.recupererParId(req.params.id)),
};

export const taches = {
  apercu: gerer(() => taskService.apercu()),
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
  // Le meme service que les medias de projet : un fichier ecrit par
  // multer, une adresse rendue. C'est la mise a jour du profil qui la
  // rattache ensuite au compte.
  televerserPhoto: gerer((req) => mediaService.enregistrer(req.file), { statut: 201 }),
};
