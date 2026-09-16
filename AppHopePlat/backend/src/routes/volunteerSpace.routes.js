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

import { profil, projets, taches } from '../controllers/volunteerSpace.controllers.js';
import { televerserMedia } from '../middleware/upload.middleware.js';
import { authenticateVolunteer } from '../middleware/volunteerAuth.middleware.js';

const router = Router();

router.use(authenticateVolunteer);

// --- Vue d'ensemble ---------------------------------------------------
router.get('/apercu', taches.apercu);

// --- Projets ----------------------------------------------------------
// Ce que HOPE mene, et ce qu'il y a a y faire. C'est l'entree de
// l'espace : les taches y sont rattachees.
router.get('/projets', projets.lister);
router.get('/projets/:id', projets.recuperer);

// --- Taches -----------------------------------------------------------
router.get('/taches/libres', taches.libres);
router.get('/taches', taches.miennes);
router.post('/taches/:id/prendre', taches.prendre);
router.post('/taches/:id/relacher', taches.relacher);
router.post('/taches/:id/livrer', taches.livrer);

// --- Profil et journal ------------------------------------------------
// Completion apres la premiere connexion : meme contenu que la mise a
// jour, plus le marqueur qui evite de le redemander.
router.post('/profil/completer', profil.completer);
router.get('/profil', profil.recuperer);
router.patch('/profil', profil.mettreAJour);
router.get('/journal', profil.journal);
// La photo de profil : televersee ici, rattachee par un PATCH du profil.
router.post('/profil/photo', televerserMedia, profil.televerserPhoto);

export default router;
