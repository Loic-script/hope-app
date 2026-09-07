/**
 * Routes de l'espace administrateur, montees sous /api/admin.
 *
 * SECURITE : authenticateAdmin est applique une fois en tete de ce routeur.
 * Toute route ajoutee ici est donc protegee par defaut ; un appel sans jeton
 * valide recoit 401 avant meme d'atteindre un controleur.
 *
 * L'ordre suit celui du menu de l'espace admin : accueil, projets, impact,
 * budget, notifications, donateurs, messages, statistiques.
 */
import { Router } from 'express';

import { authenticateAdmin } from '../middleware/auth.middleware.js';
import { televerserJustificatif, televerserMedia } from '../middleware/upload.middleware.js';

import {
  beneficiaries,
  catalog,
  dashboard,
  documents,
  donations,
  donors,
  expenses,
  fund,
  impacts,
  messages,
  notifications,
  projects,
  statistics,
} from '../controllers/admin.controllers.js';

const router = Router();

// --- Verrou global de l'espace administrateur ------------------------
router.use(authenticateAdmin);

// --- Accueil et donnees de reference ---------------------------------
router.get('/dashboard', dashboard.recuperer);
router.get('/catalog', catalog.recuperer);
router.get('/categories', catalog.listerCategories);
router.post('/categories', catalog.creerCategorie);
router.get('/statistics', statistics.recuperer);

// --- 1. Projets -------------------------------------------------------
router.get('/projects', projects.lister);
router.post('/projects', projects.creer);
router.get('/projects/completed', projects.listerTermines);
// Declaree avant /projects/:id pour ne pas etre capturee par le parametre.
router.post('/projects/media', televerserMedia, projects.televerserMedia);
router.get('/projects/:id', projects.recuperer);
router.get('/projects/:id/overview', projects.recupererApercu);
router.patch('/projects/:id', projects.mettreAJour);
router.patch('/projects/:id/complete', projects.terminer);
router.patch('/projects/:id/reopen', projects.rouvrir);
router.patch('/projects/:id/archive', projects.archiver);
router.delete('/projects/:id', projects.supprimer);

// Sous-ressources d'un projet
router.get('/projects/:projectId/beneficiaries', beneficiaries.listerParProjet);
router.post('/projects/:projectId/beneficiaries', beneficiaries.rattacherAuProjet);
router.get('/projects/:projectId/impacts', impacts.listerParProjet);

// --- 2. Impact --------------------------------------------------------
router.get('/impacts', impacts.lister);
router.post('/impacts', impacts.creer);
router.get('/impacts/:id', impacts.recuperer);
router.patch('/impacts/:id', impacts.mettreAJour);
router.delete('/impacts/:id', impacts.supprimer);

// --- 3. Budget : etat du fonds et investissements ---------------------
router.get('/fund', fund.etat);
router.get('/investments', fund.listerInvestissements);
router.post('/investments', fund.investir);

// --- 4. Notifications -------------------------------------------------
router.get('/badges', notifications.compteurs);
router.get('/notifications', notifications.lister);
router.patch('/notifications/read-all', notifications.toutMarquerLu);
router.patch('/notifications/:id/read', notifications.marquerLue);

// --- 5. Donateurs et dons --------------------------------------------
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

// --- 6. Messages ------------------------------------------------------
router.get('/messages', messages.lister);
router.post('/messages', messages.creer);
router.get('/messages/:id', messages.recuperer);
router.patch('/messages/:id/read', messages.marquerLu);
router.patch('/messages/:id/reply', messages.repondre);

// --- Depenses et justificatifs (geres depuis la fiche projet) ---------
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

// --- Beneficiaires ----------------------------------------------------
router.get('/beneficiaries', beneficiaries.lister);
router.post('/beneficiaries', beneficiaries.creer);
router.get('/beneficiaries/:id', beneficiaries.recuperer);
router.patch('/beneficiaries/:id', beneficiaries.mettreAJour);
router.patch('/project-beneficiaries/:id', beneficiaries.mettreAJourRattachement);

export default router;
