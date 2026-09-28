/**
 * Routes de l'espace benevole connecte, montees sous /api/benevole.
 *
 * SECURITE : authenticateVolunteer est applique une fois en tete de ce
 * routeur. Toute route ajoutee ici est donc protegee par defaut, et un
 * appel sans jeton de benevole recoit 401 avant tout controleur.
 *
 * Le jeton d'un administrateur ne passe pas : son audience differe.
 */
import { Router } from 'express';

import { actualites, benevoles, dons, profil, projets, taches } from '../controllers/volunteerSpace.controllers.js';
import { controleursCarte } from '../controllers/paiementCarte.controllers.js';
import { identiteBenevole } from '../services/promesseDon.service.js';
import { televerserMedia, televerserPreuve } from '../middleware/upload.middleware.js';
import {
  authenticateVolunteer,
  authenticateVolunteerACompleter,
} from '../middleware/volunteerAuth.middleware.js';

const router = Router();

// Le paiement par carte : un benevole donne une fois.
const carte = controleursCarte((req) => identiteBenevole(req.benevole), { mensuelPermis: false });

/*
 * SEULE EXCEPTION au verrou pose juste en dessous.
 *
 * Remplir sa fiche se fait avant la validation de HOPE : c'est elle qui
 * permet de decider. La route a donc son propre verrou, qui accepte un
 * compte en attente -- mais uniquement avec le jeton limite remis a
 * l'inscription, et uniquement tant que la fiche n'est pas enregistree.
 *
 * Elle est declaree avant "router.use" pour etre atteinte en premier :
 * tout ce qui suit reste protege par defaut.
 */
router.post('/profil/completer', authenticateVolunteerACompleter, profil.completer);

router.use(authenticateVolunteer);

// --- Vue d'ensemble ---------------------------------------------------
router.get('/apercu', taches.apercu);

// --- Projets ----------------------------------------------------------
// Ce que HOPE mene, et ce qu'il y a a y faire. C'est l'entree de
// l'espace : les taches y sont rattachees.
router.get('/projets', projets.lister);
router.get('/projets/:id', projets.recuperer);
// Les photos et videos des preuves terrain du projet (onglet Impact).
router.get('/projets/:id/preuves/:preuveId/fichiers/:fileId', projets.fichierPreuve);
// Ajouter une preuve terrain (photos, videos, document sous "files"), et
// retirer la sienne.
router.post('/projets/:id/preuves', televerserPreuve, projets.ajouterPreuve);
router.delete('/projets/:id/preuves/:preuveId', projets.supprimerPreuve);

// --- Actualites -------------------------------------------------------
// Les nouvelles publiees par l'equipe. Les appels a financement n'y
// figurent pas, et aucune ligne ne porte de montant.
router.get('/actualites', actualites.lister);

// --- Dons ---------------------------------------------------------------
// Faire un don a un projet : une promesse ponctuelle, que l'equipe
// confirme a reception.
router.get('/dons/options', dons.options);
router.post('/dons', dons.faire);
router.get('/paiement/coordonnees', dons.coordonnees);
// La carte, encaissee en ligne par Stripe -- un don ponctuel.
router.get('/paiement/carte', carte.reglages);
router.post('/paiement/carte/session', carte.ouvrir);
router.get('/paiement/carte/session/:id', carte.etat);
router.patch('/dons/:id/justificatif', dons.declarer);

// --- Taches -----------------------------------------------------------
router.get('/taches/libres', taches.libres);
router.get('/taches', taches.miennes);
// Prendre une tache, c'est la demander : l'equipe HOPE valide.
router.post('/taches/:id/demander', taches.demander);
router.post('/taches/:id/annuler-demande', taches.annulerDemande);
// Quitter l'equipe de la tache.
router.post('/taches/:id/relacher', taches.relacher);
// Livrer, c'est joindre la preuve : photos et videos sous "files".
router.post('/taches/:id/livrer', televerserPreuve, taches.livrer);
router.get('/taches/:id/fichiers/:fileId', taches.fichier);

// --- Les benevoles -----------------------------------------------------
// L'annuaire des autres membres et leur profil public. Pour leur ecrire,
// la messagerie (/api/espace/conversations/depuis-fiche).
router.get('/benevoles', benevoles.lister);
router.get('/benevoles/:id', benevoles.profil);

// --- Profil et journal ------------------------------------------------
// Completion apres la premiere connexion : meme contenu que la mise a
// jour, plus le marqueur qui evite de le redemander.
router.get('/profil', profil.recuperer);
router.patch('/profil', profil.mettreAJour);
router.get('/journal', profil.journal);
// La photo de profil : televersee ici, rattachee par un PATCH du profil.
router.post('/profil/photo', televerserMedia, profil.televerserPhoto);

export default router;
