/**
 * Controleurs de l'espace administrateur.
 *
 * Lecture de la requete, appel du service, formatage de la reponse : aucune
 * regle metier ici. Ils sont regroupes par module dans un seul fichier,
 * chaque handler tenant en une ligne grace a l'enveloppe gerer().
 */
import fs from 'node:fs';
import path from 'node:path';

import * as beneficiaryService from '../services/beneficiary.service.js';
import * as taskService from '../services/task.service.js';
import * as espaceService from '../services/espace.service.js';
import * as catalogService from '../services/catalog.service.js';
import * as dashboardService from '../services/dashboard.service.js';
import * as documentService from '../services/document.service.js';
import * as donationService from '../services/donation.service.js';
import * as donorService from '../services/donor.service.js';
import * as expenseService from '../services/expense.service.js';
import * as fieldProofService from '../services/fieldProof.service.js';
import * as fundService from '../services/fund.service.js';
import * as impactService from '../services/impact.service.js';
import * as mediaService from '../services/media.service.js';
import * as messageService from '../services/message.service.js';
import * as notificationService from '../services/notification.service.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import * as projectService from '../services/project.service.js';
import * as statisticsService from '../services/statistics.service.js';
import * as teamService from '../services/team.service.js';
import * as funderAccountService from '../services/funderAccount.service.js';
import * as volunteerService from '../services/volunteer.service.js';
// La consultation d'un espace reutilise la mecanique de jeton de
// l'authentification : c'est la meme session, emise autrement.
import * as authService from '../services/auth.service.js';

import { DOSSIER_PREUVES, supprimerFichier } from '../middleware/upload.middleware.js';
import { ErreurIntrouvable } from '../shared/errors.js';
import { gerer } from './handler.js';

/* ================================================================
   Accueil, references, statistiques
   ================================================================ */

export const dashboard = {
  recuperer: gerer(() => dashboardService.recupererAccueil()),
};

export const catalog = {
  recuperer: gerer(() => catalogService.recuperer()),
  listerCategories: gerer(async () => ({ items: await catalogService.listerCategories() })),
  creerCategorie: gerer((req) => catalogService.creerCategorie(req.body), { statut: 201 }),
};

export const statistics = {
  recuperer: gerer(() => statisticsService.recuperer()),
};

/* ================================================================
   Projets
   ================================================================ */

export const projects = {
  lister: gerer((req) => projectService.lister(req.query)),
  recuperer: gerer((req) => projectService.recupererParId(req.params.id)),
  recupererApercu: gerer((req) => projectService.recupererApercu(req.params.id)),
  creer: gerer((req) => projectService.creer(req.body, req.admin), { statut: 201 }),
  mettreAJour: gerer((req) => projectService.mettreAJour(req.params.id, req.body)),
  terminer: gerer((req) => projectService.terminer(req.params.id, req.body, req.admin)),
  rouvrir: gerer((req) => projectService.rouvrir(req.params.id)),
  archiver: gerer((req) => projectService.archiver(req.params.id)),
  supprimer: gerer((req) => projectService.supprimer(req.params.id)),
  listerTermines: gerer(() => projectService.listerTermines()),

  /** Televersement de la photo ou de la video qui illustre un projet. */
  televerserMedia: gerer((req) => mediaService.enregistrer(req.file), { statut: 201 }),
};

/* ================================================================
   Budget : etat du fonds et investissements
   ================================================================ */

export const fund = {
  etat: gerer(() => fundService.etat()),
  listerInvestissements: gerer((req) => fundService.listerInvestissements(req.query)),
  investir: gerer((req) => fundService.investir(req.body, req.admin), { statut: 201 }),
};

/* ================================================================
   Dons et donateurs
   ================================================================ */

export const donations = {
  lister: gerer((req) => donationService.lister(req.query)),
  recuperer: gerer((req) => donationService.recupererParId(req.params.id)),
  creer: gerer((req) => donationService.creer(req.body), { statut: 201 }),
  changerStatut: gerer((req) => donationService.changerStatut(req.params.id, req.body)),
  genererEcheances: gerer((req) => donationService.genererEcheancesMensuelles(req.admin), {
    statut: 201,
  }),
};

export const donors = {
  lister: gerer((req) => donorService.lister(req.query)),
  recuperer: gerer((req) => donorService.recupererParId(req.params.id)),
  creer: gerer((req) => donorService.creer(req.body), { statut: 201 }),
  mettreAJour: gerer((req) => donorService.mettreAJour(req.params.id, req.body)),
  ouvrirCompte: gerer((req) => donorService.ouvrirCompte(req.params.id, req.body), { statut: 201 }),
  changerStatutCompte: gerer((req) => donorService.changerStatutCompte(req.params.id, req.body)),
  listerComptes: gerer(() => donorService.listerComptes()),
};

/* ================================================================
   Depenses et justificatifs
   ================================================================ */

export const expenses = {
  lister: gerer((req) => expenseService.lister(req.query)),
  recuperer: gerer((req) => expenseService.recupererParId(req.params.id)),
  creer: gerer((req) => expenseService.creer(req.body), { statut: 201 }),
  mettreAJour: gerer((req) => expenseService.mettreAJour(req.params.id, req.body)),
  annuler: gerer((req) => expenseService.annuler(req.params.id)),
};

export const documents = {
  lister: gerer((req) => documentService.lister(req.query)),
  listerParDepense: gerer((req) => documentService.listerParDepense(req.params.expenseId)),
  recuperer: gerer((req) => documentService.recupererParId(req.params.id)),
  creer: gerer((req) => documentService.creer(req.params.expenseId, req.file, req.body, req.admin), {
    statut: 201,
  }),
  supprimer: gerer((req) => documentService.supprimer(req.params.id)),

  /** Sert le fichier lui-meme ; repond directement, sans passer par gerer(). */
  telecharger: gerer(async (req, res) => {
    const { document, cheminAbsolu } = await documentService.preparerTelechargement(req.params.id);

    if (!fs.existsSync(cheminAbsolu)) {
      throw new ErreurIntrouvable('Le fichier du justificatif', req.params.id);
    }

    res.setHeader('Content-Type', document.mimeType ?? 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(document.fileName)}"`
    );
    res.sendFile(cheminAbsolu);
  }),
};

/* ================================================================
   Equipe HOPE et journal d'activite

   req.admin est l'auteur de l'action : il est passe aux services pour
   qu'ils sachent qui journaliser et qui refuser.
   ================================================================ */

export const team = {
  lister: gerer(() => teamService.lister()),
  creer: gerer((req) => teamService.creer(req.body, req.admin), { statut: 201 }),
  mettreAJour: gerer((req) => teamService.mettreAJour(req.params.id, req.body, req.admin)),
  reinitialiserMotDePasse: gerer((req) =>
    teamService.reinitialiserMotDePasse(req.params.id, req.body, req.admin)
  ),
  changerSonMotDePasse: gerer((req) => teamService.changerSonMotDePasse(req.admin, req.body)),
  journal: gerer((req) => teamService.journal(req.query)),
};

/* ================================================================
   Benevoles

   Ils s'inscrivent eux-memes, mais n'entrent pas seuls : leur compte
   reste "en_attente" jusqu'a ce qu'un administrateur l'active.
   ================================================================ */

/**
 * Comptes bailleurs.
 *
 * Meme geste que pour les benevoles : ils s'inscrivent seuls, mais
 * l'acces s'ouvre ici. Activer un bailleur fait aussi passer son
 * organisation de "prospect" a "actif".
 */
export const funders = {
  lister: gerer((req) => funderAccountService.lister(req.query)),
  activer: gerer((req) => funderAccountService.activer(req.params.id, req.admin)),
  changerStatut: gerer((req) =>
    funderAccountService.changerStatut(req.params.id, req.body, req.admin)
  ),
};

export const volunteers = {
  lister: gerer((req) => volunteerService.lister(req.query)),
  activer: gerer((req) => volunteerService.activer(req.params.id, req.admin)),
  changerStatut: gerer((req) =>
    volunteerService.changerStatut(req.params.id, req.body, req.admin)
  ),
};

/* ================================================================
   Preuves terrain

   Le pendant des justificatifs : ceux-ci prouvent une depense, celles-la
   prouvent une action. Meme traitement du fichier, servi derriere le
   jeton et jamais en acces libre.
   ================================================================ */

/**
 * Consultation de l'espace d'un utilisateur depuis l'espace admin.
 *
 * Rend un jeton de courte duree pour l'espace du compte designe, et
 * depose la trace de l'operation dans le journal : consulter l'espace
 * de quelqu'un n'est pas un acte anodin, il doit rester lisible apres
 * coup.
 */
export const consultation = {
  ouvrir: gerer(async (req) => {
    const session = await authService.consulterEspace(req.params.id, req.admin);

    await activityLogRepository.deposer(req.admin, {
      action: 'CONSULT',
      entityType: 'UTILISATEUR',
      // entity_id est un entier ; l'identifiant d'un utilisateur est un
      // UUID. Il vit donc dans le libelle, qui le porte en clair.
      entityId: null,
      label: `a consulté l’espace ${session.type} de « ${session.utilisateur.prenom} ${session.utilisateur.nom} »`,
    });

    return session;
  }),
};

export const fieldProofs = {
  // Deux chemins mènent ici : /field-proofs?projectId=1 et
  // /projects/1/field-proofs. Le parametre d'URL prime sur la requete.
  lister: gerer((req) =>
    fieldProofService.lister({
      ...req.query,
      projectId: req.params.projectId ?? req.query.projectId,
    })
  ),
  recuperer: gerer((req) => fieldProofService.recupererParId(req.params.id)),

  /*
   * req.admin vient de authenticateAdmin : c'est l'auteur de la preuve.
   *
   * multer a deja ecrit le fichier quand le service se prononce : un
   * refus -- projet archive, date future, format incoherent -- laisserait
   * sinon un fichier orphelin sur le disque, que plus rien ne
   * reference.
   */
  creer: gerer(
    async (req) => {
      try {
        return await fieldProofService.creer(req.body, req.admin, req.files ?? []);
      } catch (erreur) {
        // Tout le lot part : un refus ne doit pas laisser la moitie des
        // images sur le disque, sans rien pour les referencer.
        for (const fichier of req.files ?? []) {
          await supprimerFichier(path.join(DOSSIER_PREUVES, path.basename(fichier.filename)));
        }
        throw erreur;
      }
    },
    { statut: 201 }
  ),

  supprimer: gerer(async (req) => {
    const resultat = await fieldProofService.supprimer(req.params.id);
    // Les lignes sont parties, en cascade : les fichiers peuvent suivre.
    for (const chemin of resultat.filePaths) {
      await supprimerFichier(path.join(DOSSIER_PREUVES, path.basename(chemin)));
    }
    return { id: resultat.id, deleted: true };
  }),

  /** Sert le fichier lui-meme ; repond directement, sans passer par gerer(). */
  /**
   * Sert un fichier de la preuve. Le fichier est designe par son
   * identifiant, la preuve en portant desormais plusieurs.
   */
  telecharger: gerer(async (req, res) => {
    const fichier = await fieldProofService.recupererFichier(req.params.id, req.params.fileId);

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

/* ================================================================
   Beneficiaires et impacts
   ================================================================ */

export const beneficiaries = {
  lister: gerer((req) => beneficiaryService.lister(req.query)),
  recuperer: gerer((req) => beneficiaryService.recupererParId(req.params.id)),
  creer: gerer((req) => beneficiaryService.creer(req.body), { statut: 201 }),
  mettreAJour: gerer((req) => beneficiaryService.mettreAJour(req.params.id, req.body)),
  listerParProjet: gerer((req) => beneficiaryService.listerParProjet(req.params.projectId)),
  rattacherAuProjet: gerer(
    (req) => beneficiaryService.rattacherAuProjet(req.params.projectId, req.body),
    { statut: 201 }
  ),
  mettreAJourRattachement: gerer((req) =>
    beneficiaryService.mettreAJourRattachement(req.params.id, req.body)
  ),
};

/**
 * Les taches d'un projet, cote equipe.
 *
 * L'administrateur les cree et les retire ; ce sont les benevoles qui
 * les prennent, depuis leur espace. Aucune route ici ne les attribue :
 * une tache imposee n'est pas du benevolat.
 */
export const tasks = {
  listerParProjet: gerer((req) => taskService.listerParProjet(req.params.projectId)),
  creer: gerer((req) => taskService.creerPourProjet(req.params.projectId, req.body), {
    statut: 201,
  }),
  supprimer: gerer((req) => taskService.supprimer(req.params.id)),
};

/**
 * Les messages venus des espaces benevole et bailleur.
 *
 * Table differente de "messages", qui porte le courrier du site public
 * rattache aux comptes donateurs : ni les memes cles, ni les memes
 * destinataires. Deux boites, donc, et deux listes.
 */
export const messagesEspaces = {
  lister: gerer(() => espaceService.listerTousLesFils().then((items) => ({ items }))),
  repondre: gerer(
    (req) => espaceService.repondreDepuisHope(req.params.id, req.body, req.admin?.id ?? null),
    { statut: 201 }
  ),
  marquerLu: gerer((req) => espaceService.marquerFilLuParHope(req.params.id)),
};

export const impacts = {
  lister: gerer((req) => impactService.lister(req.query)),
  listerParProjet: gerer((req) => impactService.listerParProjet(req.params.projectId)),
  recuperer: gerer((req) => impactService.recupererParId(req.params.id)),
  creer: gerer((req) => impactService.creer(req.body), { statut: 201 }),
  mettreAJour: gerer((req) => impactService.mettreAJour(req.params.id, req.body)),
  supprimer: gerer((req) => impactService.supprimer(req.params.id)),
};

/* ================================================================
   Notifications et messages
   ================================================================ */

export const notifications = {
  lister: gerer((req) => notificationService.lister(req.query)),
  marquerLue: gerer((req) => notificationService.marquerLue(req.params.id)),
  toutMarquerLu: gerer(() => notificationService.toutMarquerLu()),
  compteurs: gerer(() => notificationService.compteurs()),
};

export const messages = {
  lister: gerer((req) => messageService.lister(req.query)),
  recuperer: gerer((req) => messageService.recupererParId(req.params.id)),
  creer: gerer((req) => messageService.creer(req.body), { statut: 201 }),
  marquerLu: gerer((req) => messageService.marquerLu(req.params.id)),
  repondre: gerer((req) => messageService.repondre(req.params.id, req.body)),
};
