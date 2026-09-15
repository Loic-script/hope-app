/**
 * Controleurs de l'espace bailleur.
 *
 * Lecture de la requete, appel du service, formatage : aucune regle
 * metier ici. req.bailleur est pose par authenticateFunder et porte
 * l'organisation resolue depuis le compte connecte.
 */
import fs from 'node:fs';
import path from 'node:path';

import { DOSSIER_PREUVES } from '../middleware/upload.middleware.js';
import { ErreurIntrouvable } from '../shared/errors.js';
import * as funderAuthService from '../services/funderAuth.service.js';
import * as funderService from '../services/funder.service.js';
import * as mediaService from '../services/media.service.js';

import { gerer } from './handler.js';

/* ---------------------------- Authentification ------------------------- */

/**
 * POST /api/bailleur/inscription
 *
 * Repond 201 sans jeton : le compte et l'organisation existent, mais
 * l'acces attend la validation de l'equipe HOPE.
 */
export async function inscription(req, res, next) {
  try {
    const bailleur = await funderAuthService.inscrire(req.body ?? {});

    res.status(201).json({
      success: true,
      message:
        'Votre demande de partenariat est enregistrée. L’équipe HOPE validera votre accès avant votre première connexion.',
      bailleur,
    });
  } catch (erreur) {
    next(erreur);
  }
}

/** POST /api/bailleur/login */
export async function login(req, res, next) {
  try {
    const { email, motDePasse } = req.body ?? {};
    const resultat = await funderAuthService.connecter({ email, motDePasse });

    res.status(200).json({
      success: true,
      message: 'Connexion réussie',
      token: resultat.token,
      expiresIn: resultat.expiresIn,
      bailleur: resultat.bailleur,
    });
  } catch (erreur) {
    next(erreur);
  }
}

/** GET /api/bailleur/me  (protege) */
export async function me(req, res, next) {
  try {
    res.status(200).json({ authenticated: true, bailleur: req.bailleur });
  } catch (erreur) {
    next(erreur);
  }
}

/** POST /api/bailleur/logout  (protege) */
export async function logout(_req, res) {
  res.status(200).json({ success: true, message: 'Déconnexion effectuée.' });
}

/** Les types d'organisation, pour la liste du formulaire de completion. */
export async function typesOrganisation(_req, res) {
  res.status(200).json({
    items: funderAuthService.TYPES_ORGANISATION.map((cle) => ({
      cle,
      libelle: funderAuthService.LIBELLES_TYPE[cle],
    })),
  });
}

/* ------------------------------- L'espace ------------------------------ */

export const espace = {
  declarerOrganisation: gerer(
    (req) => funderService.declarerOrganisation(req.bailleur.utilisateurId, req.body),
    { statut: 201 }
  ),
  tableauDeBord: gerer((req) => funderService.tableauDeBord(req.bailleur.bailleurId)),
  partenariat: gerer((req) => funderService.partenariat(req.bailleur.bailleurId)),
  versements: gerer((req) => funderService.versements(req.bailleur.bailleurId, req.query)),
  documents: gerer((req) => funderService.documents(req.bailleur.bailleurId, req.query)),
  telecharger: gerer((req) =>
    funderService.telecharger(req.bailleur.bailleurId, req.params.id, req.bailleur)
  ),
  certificat: gerer(
    (req) => funderService.genererCertificat(req.bailleur.bailleurId, req.bailleur),
    { statut: 201 }
  ),
  preuves: gerer((req) => funderService.preuves(req.bailleur.bailleurId)),
  fil: gerer((req) => funderService.fil(req.bailleur.bailleurId)),
  manifesterUnInteret: gerer(
    (req) =>
      funderService.manifesterUnInteret(req.bailleur.bailleurId, req.body, req.bailleur),
    { statut: 201 }
  ),
  profil: gerer((req) => funderService.profil(req.bailleur.bailleurId)),
  mettreAJourContact: gerer((req) =>
    funderService.mettreAJourContact(req.bailleur.contactId, req.body)
  ),
  // Le fichier seul : c'est la mise a jour de la fiche qui le rattache.
  televerserPhoto: gerer((req) => mediaService.enregistrer(req.file), { statut: 201 }),

  /**
   * Sert un fichier de preuve, si le bailleur finance le projet.
   *
   * Repond le fichier lui-meme, comme cote administration : l'espace
   * montrait jusqu'ici le nom du fichier sans jamais l'ouvrir.
   */
  telechargerPreuve: gerer(async (req, res) => {
    const fichier = await funderService.fichierDePreuve(
      req.bailleur.bailleurId,
      req.params.id,
      req.params.fileId
    );

    // basename() neutralise toute tentative de remontee de repertoire.
    const cheminAbsolu = path.join(DOSSIER_PREUVES, path.basename(fichier.filePath));
    if (!fs.existsSync(cheminAbsolu)) {
      throw new ErreurIntrouvable('Le fichier de la preuve', req.params.fileId);
    }

    res.setHeader('Content-Type', fichier.mimeType ?? 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(fichier.fileName ?? 'preuve')}"`
    );
    res.sendFile(cheminAbsolu);
  }),
};
