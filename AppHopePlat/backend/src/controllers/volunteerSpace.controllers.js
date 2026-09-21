/**
 * Controleurs de l'espace benevole.
 *
 * Lecture de la requete, appel du service, formatage : aucune regle
 * metier ici. req.benevole est pose par authenticateVolunteer et porte
 * l'identifiant du compte utilisateur.
 */
import path from 'node:path';

import { DOSSIER_PREUVES, supprimerFichier } from '../middleware/upload.middleware.js';
import * as taskService from '../services/task.service.js';
import * as volunteerProjectsService from '../services/volunteerProjects.service.js';
import * as volunteerProfileService from '../services/volunteerProfile.service.js';
import * as mediaService from '../services/media.service.js';

import { envoyerFichierLivraison } from './fichierLivraison.js';
import { gerer } from './handler.js';

/** Les projets, autour desquels l'espace s'organise. */
export const projets = {
  lister: gerer(() => volunteerProjectsService.lister()),
  recuperer: gerer((req) => volunteerProjectsService.recupererParId(req.params.id, req.benevole.id)),
  // Un fichier d'une preuve terrain : ce que voit aussi le donateur.
  fichierPreuve: gerer(async (req, res) => {
    const fichier = await volunteerProjectsService.fichierDePreuve(
      req.params.id,
      req.params.preuveId,
      req.params.fileId
    );
    envoyerFichierLivraison(res, fichier);
  }),
};

export const taches = {
  apercu: gerer(() => taskService.apercu()),
  // Celles qu'il peut demander : libres, ou a rejoindre.
  libres: gerer((req) => taskService.listerAPrendre(req.benevole.id)),
  miennes: gerer((req) => taskService.mesTaches(req.benevole.id, req.query)),
  demander: gerer((req) => taskService.demander(req.params.id, req.benevole.id)),
  annulerDemande: gerer((req) => taskService.annulerDemande(req.params.id, req.benevole.id)),
  relacher: gerer((req) => taskService.relacher(req.params.id, req.benevole.id)),
  /*
   * multer a deja ecrit les fichiers quand le service se prononce : un
   * refus -- aucune preuve, un PDF, une tache deja livree -- les
   * laisserait sur le disque sans rien pour les referencer.
   */
  livrer: gerer(async (req) => {
    try {
      return await taskService.livrer(req.params.id, req.benevole.id, req.files ?? []);
    } catch (erreur) {
      for (const fichier of req.files ?? []) {
        await supprimerFichier(path.join(DOSSIER_PREUVES, path.basename(fichier.filename)));
      }
      throw erreur;
    }
  }),

  /** Un fichier de sa propre livraison. */
  fichier: gerer(async (req, res) => {
    const fichier = await taskService.fichierDeLivraison(
      req.params.id,
      req.params.fileId,
      req.benevole.id
    );
    envoyerFichierLivraison(res, fichier);
  }),
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
