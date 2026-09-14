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

import {
  authenticateAdmin,
  exigerEcriture,
  exigerRole,
} from '../middleware/auth.middleware.js';
import {
  televerserJustificatif,
  televerserMedia,
  televerserPreuve,
} from '../middleware/upload.middleware.js';

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
  notifications,
  projects,
  statistics,
  team,
  volunteers,
  consultation,
} from '../controllers/admin.controllers.js';

const router = Router();

// --- Verrou global de l'espace administrateur ------------------------
router.use(authenticateAdmin);

/*
 * Changer SON mot de passe reste ouvert a tous les roles, y compris la
 * lecture seule. Cette route est donc declaree AVANT le verrou d'ecriture
 * ci-dessous : elle repond, et la requete n'atteint jamais le verrou.
 */
router.post('/me/password', team.changerSonMotDePasse);

/*
 * SECURITE : toute ecriture exige au moins le role coordinateur.
 *
 * Le verrou porte sur la methode HTTP plutot que sur chaque route, pour
 * la meme raison qu'authenticateAdmin est monte en tete : une route
 * ajoutee plus bas est protegee par defaut, sans qu'on ait a y penser.
 * Les lectures (GET, HEAD) passent : un compte VIEWER consulte tout.
 */
router.use((req, res, suite) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    suite();
    return;
  }
  exigerEcriture(req, res, suite);
});

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
// Supprimer un projet efface un dossier : decision d'administrateur.
router.delete('/projects/:id', exigerRole('ADMIN'), projects.supprimer);

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
// Investir engage l'argent libre de l'association : decision d'administrateur.
router.post('/investments', exigerRole('ADMIN'), fund.investir);

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
// Genere les occurrences du mois EN ATTENTE : aucun prelevement reel.
router.post('/donations/generate-monthly', donations.genererEcheances);

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

// --- 7. Preuves terrain -----------------------------------------------
// televerserPreuve doit passer avant le controleur : c'est lui qui
// remplit req.body pour un envoi multipart, en plus de req.file.
router.get('/field-proofs', fieldProofs.lister);
router.post('/field-proofs', televerserPreuve, fieldProofs.creer);
router.get('/field-proofs/:id', fieldProofs.recuperer);
router.get('/field-proofs/:id/files/:fileId', fieldProofs.telecharger);
router.delete('/field-proofs/:id', fieldProofs.supprimer);
router.get('/projects/:projectId/field-proofs', fieldProofs.lister);

// --- 8. Equipe HOPE et journal d'activite -----------------------------
// Gerer les comptes est reserve aux administrateurs : c'est la seule
// action qui permet d'en creer d'autres, donc de tout ouvrir.
router.get('/team', exigerRole('ADMIN'), team.lister);
router.post('/team', exigerRole('ADMIN'), team.creer);
router.patch('/team/:id', exigerRole('ADMIN'), team.mettreAJour);
router.patch('/team/:id/password', exigerRole('ADMIN'), team.reinitialiserMotDePasse);

// Le journal se lit ; personne ne l'ecrit a la main.
router.get('/activity', team.journal);

// --- Benevoles --------------------------------------------------------
// Activer un compte ouvre un acces : c'est une ecriture, pas une lecture.
router.get('/volunteers', volunteers.lister);
router.post('/volunteers/:id/activate', exigerEcriture, volunteers.activer);
router.patch('/volunteers/:id/status', exigerEcriture, volunteers.changerStatut);

// --- Bailleurs --------------------------------------------------------
/*
 * Consulter l'espace d'un utilisateur.
 *
 * Reserve au role ADMIN et non a l'ecriture : entrer chez quelqu'un est
 * plus lourd que de modifier une fiche, et un coordinateur n'a pas a
 * pouvoir le faire. POST bien qu'on ne cree rien de durable -- la
 * requete ouvre une session, ce qui n'est pas une lecture.
 */
router.post('/consulter/:id', exigerRole('ADMIN'), consultation.ouvrir);

router.get('/funders', funders.lister);
router.post('/funders/:id/activate', exigerEcriture, funders.activer);
router.patch('/funders/:id/status', exigerEcriture, funders.changerStatut);

// --- Beneficiaires ----------------------------------------------------
router.get('/beneficiaries', beneficiaries.lister);
router.post('/beneficiaries', beneficiaries.creer);
router.get('/beneficiaries/:id', beneficiaries.recuperer);
router.patch('/beneficiaries/:id', beneficiaries.mettreAJour);
router.patch('/project-beneficiaries/:id', beneficiaries.mettreAJourRattachement);

export default router;
