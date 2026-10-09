import path from 'node:path';

import { DOSSIER_PREUVES, supprimerFichier } from '../middleware/upload.middleware.js';
import * as annuaireService from '../services/annuaireBenevoles.service.js';
import * as fieldProofService from '../services/fieldProof.service.js';
import * as donorSpaceService from '../services/donorSpace.service.js';
import * as promesseDonService from '../services/promesseDon.service.js';
import * as publicationService from '../services/publication.service.js';
import * as taskService from '../services/task.service.js';
import * as volunteerProjectsService from '../services/volunteerProjects.service.js';
import * as volunteerProfileService from '../services/volunteerProfile.service.js';
import * as mediaService from '../services/media.service.js';

import { envoyerFichierLivraison } from './fichierLivraison.js';
import { gerer } from './handler.js';

export const projets = {
  lister: gerer(() => volunteerProjectsService.lister()),
  recuperer: gerer((req) => volunteerProjectsService.recupererParId(req.params.id, req.benevole.id)),
  fichierPreuve: gerer(async (req, res) => {
    const fichier = await volunteerProjectsService.fichierDePreuve(
      req.params.id,
      req.params.preuveId,
      req.params.fileId
    );
    envoyerFichierLivraison(res, fichier);
  }),

  ajouterPreuve: gerer(
    async (req) => {
      try {
        return await fieldProofService.creerParBenevole(
          req.params.id,
          req.body,
          req.benevole,
          req.files ?? []
        );
      } catch (erreur) {
        for (const fichier of req.files ?? []) {
          await supprimerFichier(path.join(DOSSIER_PREUVES, path.basename(fichier.filename)));
        }
        throw erreur;
      }
    },
    { statut: 201 }
  ),

  supprimerPreuve: gerer(async (req) => {
    const resultat = await fieldProofService.supprimerParBenevole(
      req.params.id,
      req.params.preuveId,
      req.benevole
    );
    for (const chemin of resultat.filePaths) {
      await supprimerFichier(path.join(DOSSIER_PREUVES, path.basename(chemin)));
    }
    return { id: resultat.id, deleted: true };
  }),
};

export const dons = {
  options: gerer(() => promesseDonService.options()),
  coordonnees: gerer(async () => donorSpaceService.coordonneesDePaiement()),
  declarer: gerer((req) => donorSpaceService.declarerPaiement(req.benevole, req.params.id, req.body)),
  faire: gerer(
    (req) =>
      promesseDonService.promettreUnDon(promesseDonService.identiteBenevole(req.benevole), req.body, {
        mensuelPermis: false,
      }),
    { statut: 201 }
  ),
};

export const actualites = {
  lister: gerer(() => publicationService.filBenevole()),
};

export const taches = {
  apercu: gerer(() => taskService.apercu()),
  libres: gerer((req) => taskService.listerAPrendre(req.benevole.id)),
  miennes: gerer((req) => taskService.mesTaches(req.benevole.id, req.query)),
  demander: gerer((req) => taskService.demander(req.params.id, req.benevole.id)),
  annulerDemande: gerer((req) => taskService.annulerDemande(req.params.id, req.benevole.id)),
  relacher: gerer((req) => taskService.relacher(req.params.id, req.benevole.id)),
  livrer: gerer(async (req) => {
    try {
      return await taskService.livrer(req.params.id, req.benevole.id, req.files ?? [], req.body);
    } catch (erreur) {
      for (const fichier of req.files ?? []) {
        await supprimerFichier(path.join(DOSSIER_PREUVES, path.basename(fichier.filename)));
      }
      throw erreur;
    }
  }),

  fichier: gerer(async (req, res) => {
    const fichier = await taskService.fichierDeLivraison(
      req.params.id,
      req.params.fileId,
      req.benevole.id
    );
    envoyerFichierLivraison(res, fichier);
  }),
};

export const benevoles = {
  lister: gerer((req) => annuaireService.lister(req.benevole.id)),
  profil: gerer((req) => annuaireService.profil(req.benevole.id, req.params.id)),
};

export const profil = {
  completer: gerer(
    (req) => volunteerProfileService.completer(req.benevole.id, req.body),
    { statut: 201 }
  ),
  recuperer: gerer((req) => volunteerProfileService.recuperer(req.benevole.id)),
  mettreAJour: gerer((req) => volunteerProfileService.mettreAJour(req.benevole.id, req.body)),
  journal: gerer((req) => volunteerProfileService.journal(req.benevole.id)),
  televerserPhoto: gerer((req) => mediaService.enregistrer(req.file), { statut: 201 }),
};
