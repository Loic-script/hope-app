import { Router } from 'express';

import {
  authenticateAdmin,
  exigerEcriture,
  exigerRole,
  verrouEcriture,
} from '../middleware/auth.middleware.js';
import {
  televerserJustificatif,
  televerserMedia,
  televerserPreuve,
} from '../middleware/upload.middleware.js';

import { conversations } from '../controllers/conversation.controllers.js';
import { televerserGroupe, televerserMessage } from '../middleware/upload.middleware.js';
import {
  beneficiaries,
  catalog,
  dashboard,
  documents,
  donations,
  donors,
  expenses,
  fieldProofs,
  funders,
  fund,
  impacts,
  messages,
  messagesEspaces,
  notifications,
  projects,
  projectReports,
  publications,
  statistics,
  tasks,
  team,
  utilisateurs,
  backoffice,
  volunteers,
  consultation,
} from '../controllers/admin.controllers.js';

import { journaliserAdmin } from '../services/audit.service.js';
const router = Router();

router.use(authenticateAdmin);

router.use(journaliserAdmin);

router.post('/me/password', team.changerSonMotDePasse);
router.post('/me/photo', televerserMedia, team.televerserPhoto);
router.patch('/me/photo', team.changerSaPhoto);

router.use(verrouEcriture);

router.get('/dashboard', dashboard.recuperer);
router.get('/catalog', catalog.recuperer);
router.get('/categories', catalog.listerCategories);
router.post('/categories', catalog.creerCategorie);
router.get('/statistics', statistics.recuperer);

router.get('/projects', projects.lister);
router.post('/projects', projects.creer);
router.get('/projects/completed', projects.listerTermines);
router.post('/projects/media', televerserMedia, projects.televerserMedia);
router.get('/projects/:id', projects.recuperer);
router.get('/projects/:id/overview', projects.recupererApercu);
router.patch('/projects/:id', projects.mettreAJour);
router.patch('/projects/:id/complete', projects.terminer);
router.patch('/projects/:id/reopen', projects.rouvrir);
router.patch('/projects/:id/archive', projects.archiver);

router.get('/projects/:id/rapport', projectReports.recuperer);
router.get('/projects/:id/rapport/pdf', projectReports.pdf);
router.get('/projects/:id/rapport/publies/:documentId', projectReports.contenuPublie);
router.post('/projects/:id/rapport/publication', exigerEcriture, projectReports.publier);
router.delete('/projects/:id', exigerRole('ADMIN'), projects.supprimer);

router.get('/projects/:projectId/beneficiaries', beneficiaries.listerParProjet);
router.post('/projects/:projectId/beneficiaries', beneficiaries.rattacherAuProjet);
router.get('/projects/:projectId/impacts', impacts.listerParProjet);

router.get('/projects/:projectId/tasks', tasks.listerParProjet);
router.post('/projects/:projectId/tasks', exigerEcriture, tasks.creer);
router.delete('/tasks/:id', exigerEcriture, tasks.supprimer);
router.get('/tasks/:id/files/:fileId', tasks.fichier);

router.get('/taches', tasks.listerTout);
router.get('/taches/benevoles', tasks.benevoles);
router.get('/taches/:id', tasks.recuperer);
router.patch('/taches/:id', exigerEcriture, tasks.modifier);
router.post('/taches/:id/equipe', tasks.affecter);
router.delete('/taches/:id/equipe/:benevoleId', tasks.retirer);
router.post('/taches/:id/demandes/:benevoleId/accepter', tasks.accepter);
router.post('/taches/:id/demandes/:benevoleId/refuser', tasks.refuser);

router.get('/conversations/joignables', conversations.joignables);
router.get('/conversations/non-lus', conversations.nonLus);
router.get('/conversations', conversations.lister);
router.post('/conversations/groupes', televerserGroupe, conversations.creerGroupe);
router.post('/conversations/depuis-fiche', conversations.depuisFiche);
router.post('/conversations', conversations.ouvrir);
router.get('/conversations/:id', conversations.recuperer);
router.get('/conversations/:id/fichiers', conversations.fichiers);
router.post('/conversations/:id/lu', conversations.marquerLu);
router.post('/conversations/:id/participants', conversations.ajouterAuGroupe);
router.post('/conversations/:id/quitter', conversations.quitterGroupe);
router.post('/conversations/:id/messages', televerserMessage, conversations.envoyer);
router.patch('/conversations/:id/messages/:messageId', conversations.modifier);
router.delete('/conversations/:id/messages/:messageId', conversations.supprimer);
router.post('/conversations/:id/messages/:messageId/transfert', conversations.transferer);

router.get('/espace-messages', messagesEspaces.lister);
router.post('/espace-messages/:id/reponse', exigerEcriture, messagesEspaces.repondre);
router.patch('/espace-messages/:id/lu', messagesEspaces.marquerLu);

router.get('/impacts', impacts.lister);
router.post('/impacts', impacts.creer);
router.get('/impacts/:id', impacts.recuperer);
router.patch('/impacts/:id', impacts.mettreAJour);
router.delete('/impacts/:id', impacts.supprimer);

router.get('/fund', fund.etat);
router.get('/investments', fund.listerInvestissements);
router.post('/investments', exigerRole('ADMIN'), fund.investir);

router.get('/badges', notifications.compteurs);
router.get('/notifications', notifications.lister);
router.patch('/notifications/read-all', notifications.toutMarquerLu);
router.patch('/notifications/:id/read', notifications.marquerLue);

router.get('/donors', donors.lister);
router.post('/donors', donors.creer);
router.get('/donor-accounts', donors.listerComptes);
router.get('/donors/:id', donors.recuperer);
router.patch('/donors/:id', donors.mettreAJour);
router.post('/donors/:id/account', donors.ouvrirCompte);
router.patch('/donor-accounts/:id/status', donors.changerStatutCompte);

router.get('/donations', donations.lister);
router.post('/donations', donations.creer);
router.get('/donations/:id', donations.recuperer);
router.patch('/donations/:id/status', donations.changerStatut);
router.post('/donations/generate-monthly', donations.genererEcheances);

router.get('/messages', messages.lister);
router.post('/messages', messages.creer);
router.get('/messages/:id', messages.recuperer);
router.patch('/messages/:id/read', messages.marquerLu);
router.patch('/messages/:id/reply', messages.repondre);

router.get('/expenses', expenses.lister);
router.post('/expenses', expenses.creer);
router.get('/expenses/:id', expenses.recuperer);
router.patch('/expenses/:id', expenses.mettreAJour);
router.patch('/expenses/:id/cancel', expenses.annuler);

router.get('/expenses/:expenseId/documents', documents.listerParDepense);
router.post('/expenses/:expenseId/documents', televerserJustificatif, documents.creer);
router.get('/documents', documents.lister);
router.get('/documents/:id', documents.recuperer);
router.get('/documents/:id/download', documents.telecharger);
router.delete('/documents/:id', documents.supprimer);

router.get('/field-proofs', fieldProofs.lister);
router.post('/field-proofs', televerserPreuve, fieldProofs.creer);
router.get('/field-proofs/:id', fieldProofs.recuperer);
router.get('/field-proofs/:id/files/:fileId', fieldProofs.telecharger);
router.delete('/field-proofs/:id', fieldProofs.supprimer);
router.get('/projects/:projectId/field-proofs', fieldProofs.lister);

router.get('/team', exigerRole('ADMIN'), team.lister);
router.post('/team', exigerRole('ADMIN'), team.creer);
router.patch('/team/:id', exigerRole('ADMIN'), team.mettreAJour);
router.patch('/team/:id/password', exigerRole('ADMIN'), team.reinitialiserMotDePasse);

router.get('/activity', team.journal);
router.get('/audit', exigerRole('ADMIN'), team.audit);

router.get('/backoffice', exigerRole('ADMIN'), backoffice.lister);
router.post('/backoffice', exigerRole('ADMIN'), backoffice.creer);
router.patch('/backoffice/:id', exigerRole('ADMIN'), backoffice.modifier);
router.post('/backoffice/:id/acces', exigerRole('ADMIN'), backoffice.renouvelerAcces);

router.post('/utilisateurs/comptes', utilisateurs.creerCompte);
router.get('/utilisateurs/comptes/:id', utilisateurs.profilCompte);
router.patch('/utilisateurs/comptes/:id', utilisateurs.modifierCompte);
router.delete('/utilisateurs/comptes/:id', utilisateurs.supprimerCompte);
router.get('/utilisateurs/fiches/:id', utilisateurs.profilFiche);
router.delete('/utilisateurs/fiches/:id', utilisateurs.supprimerFiche);
router.get('/utilisateurs/:onglet', utilisateurs.lister);

router.get('/volunteers', volunteers.lister);
router.post('/volunteers/:id/activate', exigerEcriture, volunteers.activer);
router.patch('/volunteers/:id/status', exigerEcriture, volunteers.changerStatut);

router.post('/consulter/:id', exigerRole('ADMIN'), consultation.ouvrir);

router.get('/funders', funders.lister);

router.get('/publications', publications.lister);
router.post('/publications', publications.creer);
router.post('/publications/photo', televerserMedia, publications.televerserPhoto);
router.get('/publications/:id/commentaires', publications.commentaires);
router.patch('/publications/:id', publications.modifier);
router.delete('/publications/:id', publications.supprimer);
router.patch('/publications/interets/:id', publications.changerStatutInteret);

router.post('/funders/:id/activate', exigerEcriture, funders.activer);
router.patch('/funders/:id/status', exigerEcriture, funders.changerStatut);

router.get('/beneficiaries', beneficiaries.lister);
router.post('/beneficiaries', beneficiaries.creer);
router.post('/beneficiaries/photo', televerserGroupe, beneficiaries.televerserPhoto);
router.get('/beneficiaries/:id', beneficiaries.recuperer);
router.patch('/beneficiaries/:id', beneficiaries.mettreAJour);
router.patch('/project-beneficiaries/:id', beneficiaries.mettreAJourRattachement);

export default router;
