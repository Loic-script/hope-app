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
import * as adminRepository from '../repositories/admin.repository.js';
import * as photoBeneficiaireService from '../services/photoBeneficiaire.service.js';
import * as projectService from '../services/project.service.js';
import * as projectReportService from '../services/projectReport.service.js';
import * as publicationService from '../services/publication.service.js';
import * as statisticsService from '../services/statistics.service.js';
import * as teamService from '../services/team.service.js';
import * as funderAccountService from '../services/funderAccount.service.js';
import * as volunteerService from '../services/volunteer.service.js';
import * as utilisateursService from '../services/utilisateurs.service.js';
import * as authService from '../services/auth.service.js';

import { DOSSIER_PREUVES, supprimerFichier } from '../middleware/upload.middleware.js';
import { envoyerFichierLivraison } from './fichierLivraison.js';
import { ErreurIntrouvable } from '../shared/errors.js';
import { gerer } from './handler.js';
import * as auditService from '../services/audit.service.js';
import * as reactionsService from '../services/reactionsActualite.service.js';
import * as backofficeService from '../services/backoffice.service.js';
import * as compteParEquipeService from '../services/compteParEquipe.service.js';
import { poserSession } from '../shared/session.js';
import * as adminAuthService from '../services/adminAuth.service.js';

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

export const projects = {
  lister: gerer((req) => projectService.lister(req.query)),
  recuperer: gerer((req) => projectService.recupererParId(req.params.id)),
  recupererApercu: gerer((req) => projectService.recupererApercu(req.params.id)),
  creer: gerer((req) => projectService.creer(req.body, req.admin), { statut: 201 }),
  mettreAJour: gerer((req) => projectService.mettreAJour(req.params.id, req.body)),
  terminer: gerer((req) => projectService.terminer(req.params.id, req.body, req.admin)),
  rouvrir: gerer((req) => projectService.rouvrir(req.params.id)),
  archiver: gerer((req) => projectService.archiver(req.params.id)),
  supprimer: gerer((req) =>
    projectService.supprimer(req.params.id, {
      force: req.query.force === '1',
      admin: req.admin,
    })
  ),
  listerTermines: gerer(() => projectService.listerTermines()),

  televerserMedia: gerer((req) => mediaService.enregistrer(req.file), { statut: 201 }),
};

export const projectReports = {
  recuperer: gerer((req) => projectReportService.recuperer(req.params.id)),
  contenuPublie: gerer((req) =>
    projectReportService.contenuPublie(req.params.id, req.params.documentId)
  ),
  publier: gerer((req) => projectReportService.publier(req.params.id, req.admin), {
    statut: 201,
  }),

  pdf: gerer(async (req, res) => {
    const { contenu, nomFichier } = await projectReportService.pdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nomFichier)}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(contenu);
  }),
};

export const fund = {
  etat: gerer(() => fundService.etat()),
  listerInvestissements: gerer((req) => fundService.listerInvestissements(req.query)),
  investir: gerer((req) => fundService.investir(req.body, req.admin), { statut: 201 }),
};

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

export const team = {
  lister: gerer(() => teamService.lister()),
  creer: gerer((req) => teamService.creer(req.body, req.admin), { statut: 201 }),
  mettreAJour: gerer((req) => teamService.mettreAJour(req.params.id, req.body, req.admin)),
  reinitialiserMotDePasse: gerer((req) =>
    teamService.reinitialiserMotDePasse(req.params.id, req.body, req.admin)
  ),
  changerSonMotDePasse: gerer(async (req, res) => {
    const resultat = await teamService.changerSonMotDePasse(req.admin, req.body);
    poserSession(res, 'admin', await adminAuthService.jetonNeuf(req.admin.id));
    return resultat;
  }),
  changerSaPhoto: gerer((req) => teamService.changerSaPhoto(req.admin.id, req.body)),
  televerserPhoto: gerer((req) => mediaService.enregistrer(req.file), { statut: 201 }),
  journal: gerer((req) => teamService.journal(req.query)),
  audit: gerer((req) => auditService.lister(req.query)),
};

export const publications = {
  lister: gerer(() => publicationService.lister()),
  commentaires: gerer((req) => reactionsService.commentaires(req.params.id)),
  creer: gerer((req) => publicationService.creer(req.body, req.admin), { statut: 201 }),
  modifier: gerer((req) => publicationService.modifier(req.params.id, req.body, req.admin)),
  supprimer: gerer((req) => publicationService.supprimer(req.params.id, req.admin)),
  televerserPhoto: gerer((req) => publicationService.televerserPhoto(req.file), { statut: 201 }),
  changerStatutInteret: gerer((req) =>
    publicationService.changerStatutInteret(req.params.id, req.body)
  ),
};

export const photosBeneficiaires = {
  lire: gerer(async (req, res) => {
    const adminId = photoBeneficiaireService.verifierSignature(req.params.fichier, req.query);
    const admin = adminId ? await adminRepository.trouverParId(adminId) : null;
    const cheminAbsolu = photoBeneficiaireService.chemin(req.params.fichier);
    if (!admin || admin.status === 'SUSPENDED' || !fs.existsSync(cheminAbsolu)) {
      throw new ErreurIntrouvable('La photo', req.params.fichier);
    }

    await new Promise((resolve, reject) => {
      res.sendFile(
        cheminAbsolu,
        {
          lastModified: false,
          headers: {
            'Content-Type': 'image/jpeg',
            'Content-Disposition': 'inline; filename="beneficiaire.jpg"',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'private, max-age=3600',
            'Referrer-Policy': 'no-referrer',
          },
        },
        (erreur) => (erreur && !res.headersSent ? reject(erreur) : resolve())
      );
    });
  }),
};

export const funders = {
  lister: gerer((req) => funderAccountService.lister(req.query)),
  activer: gerer((req) => funderAccountService.activer(req.params.id, req.admin)),
  changerStatut: gerer((req) =>
    funderAccountService.changerStatut(req.params.id, req.body, req.admin)
  ),
};

export const utilisateurs = {
  lister: gerer((req) => utilisateursService.lister(req.params.onglet, req.query)),
  creerCompte: gerer((req) => compteParEquipeService.creer(req.body, req.admin), { statut: 201 }),
  profilCompte: gerer((req) => utilisateursService.profilCompte(req.params.id)),
  profilFiche: gerer((req) => utilisateursService.profilFiche(req.params.id)),
  modifierCompte: gerer((req) => utilisateursService.modifierCompte(req.params.id, req.body)),
  supprimerCompte: gerer((req) => utilisateursService.supprimerCompte(req.params.id, req.admin)),
  supprimerFiche: gerer((req) =>
    utilisateursService.supprimerFiche(req.params.id, {
      forcer: req.query.forcer === '1',
      avecDons: req.query.avecDons === '1',
    })
  ),
};

export const volunteers = {
  lister: gerer((req) => volunteerService.lister(req.query)),
  activer: gerer((req) => volunteerService.activer(req.params.id, req.admin)),
  changerStatut: gerer((req) =>
    volunteerService.changerStatut(req.params.id, req.body, req.admin)
  ),
};

export const consultation = {
  ouvrir: gerer(async (req, res) => {
    const session = await authService.consulterEspace(req.params.id, req.admin);
    poserSession(res, session.type, session.token, { persistant: false });

    await activityLogRepository.deposer(req.admin, {
      action: 'CONSULT',
      entityType: 'UTILISATEUR',
      entityId: null,
      label: `a consulté l’espace ${session.type} de « ${
        `${session.utilisateur.prenom} ${session.utilisateur.nom}`.trim() || session.utilisateur.email
      } »`,
    });

    return session;
  }),
};

export const fieldProofs = {
  lister: gerer((req) =>
    fieldProofService.lister({
      ...req.query,
      projectId: req.params.projectId ?? req.query.projectId,
    })
  ),
  recuperer: gerer((req) => fieldProofService.recupererParId(req.params.id)),

  creer: gerer(
    async (req) => {
      try {
        return await fieldProofService.creer(req.body, req.admin, req.files ?? []);
      } catch (erreur) {
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
    for (const chemin of resultat.filePaths) {
      await supprimerFichier(path.join(DOSSIER_PREUVES, path.basename(chemin)));
    }
    return { id: resultat.id, deleted: true };
  }),

  telecharger: gerer(async (req, res) => {
    const fichier = await fieldProofService.recupererFichier(req.params.id, req.params.fileId);

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

export const beneficiaries = {
  lister: gerer((req) => beneficiaryService.lister(req.query, req.admin)),
  recuperer: gerer((req) => beneficiaryService.recupererParId(req.params.id, req.admin)),
  creer: gerer((req) => beneficiaryService.creer(req.body, req.admin), { statut: 201 }),
  mettreAJour: gerer((req) => beneficiaryService.mettreAJour(req.params.id, req.body, req.admin)),
  televerserPhoto: gerer((req) => beneficiaryService.televerserPhoto(req.file, req.admin), {
    statut: 201,
  }),
  listerParProjet: gerer((req) => beneficiaryService.listerParProjet(req.params.projectId)),
  rattacherAuProjet: gerer(
    (req) => beneficiaryService.rattacherAuProjet(req.params.projectId, req.body),
    { statut: 201 }
  ),
  mettreAJourRattachement: gerer((req) =>
    beneficiaryService.mettreAJourRattachement(req.params.id, req.body)
  ),
};

export const tasks = {
  listerParProjet: gerer((req) => taskService.listerParProjet(req.params.projectId)),
  listerTout: gerer((req) => taskService.listerPourAdmin(req.query)),
  recuperer: gerer((req) => taskService.recupererPourAdmin(req.params.id)),
  benevoles: gerer(() => taskService.benevolesAffectables()),
  modifier: gerer((req) => taskService.modifier(req.params.id, req.body)),
  affecter: gerer((req) => taskService.affecter(req.params.id, req.body, req.admin)),
  retirer: gerer((req) => taskService.retirer(req.params.id, req.params.benevoleId, req.admin)),
  accepter: gerer((req) => taskService.accepter(req.params.id, req.params.benevoleId, req.admin)),
  refuser: gerer((req) => taskService.refuser(req.params.id, req.params.benevoleId, req.admin)),
  creer: gerer((req) => taskService.creerPourProjet(req.params.projectId, req.body), {
    statut: 201,
  }),
  supprimer: gerer((req) => taskService.supprimer(req.params.id)),
  fichier: gerer(async (req, res) => {
    const fichier = await taskService.fichierDeLivraison(req.params.id, req.params.fileId);
    envoyerFichierLivraison(res, fichier);
  }),
};

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

export const notifications = {
  lister: gerer((req) => notificationService.lister(req.query)),
  marquerLue: gerer((req) => notificationService.marquerLue(req.params.id)),
  toutMarquerLu: gerer(() => notificationService.toutMarquerLu()),
  compteurs: gerer((req) => notificationService.compteurs(req.admin)),
};

export const messages = {
  lister: gerer((req) => messageService.lister(req.query)),
  recuperer: gerer((req) => messageService.recupererParId(req.params.id)),
  creer: gerer((req) => messageService.creer(req.body), { statut: 201 }),
  marquerLu: gerer((req) => messageService.marquerLu(req.params.id)),
  repondre: gerer((req) => messageService.repondre(req.params.id, req.body)),
};

export const backoffice = {
  lister: gerer(() => backofficeService.lister()),
  creer: gerer((req) => backofficeService.creer(req.body), { statut: 201 }),
  modifier: gerer((req) => backofficeService.modifier(req.params.id, req.body)),
  renouvelerAcces: gerer((req) => backofficeService.renouvelerAcces(req.params.id)),
};
