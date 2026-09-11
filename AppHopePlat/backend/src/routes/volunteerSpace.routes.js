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

import { missions, profil, taches } from '../controllers/volunteerSpace.controllers.js';
import { authenticateVolunteer } from '../middleware/volunteerAuth.middleware.js';

const router = Router();

router.use(authenticateVolunteer);

// --- Vue d'ensemble ---------------------------------------------------
router.get('/apercu', missions.apercu);

// --- Missions ---------------------------------------------------------
// "/missions/miennes" avant "/missions/:id" : sinon "miennes" serait
// lu comme un identifiant de mission.
router.get('/missions/miennes', missions.mesMissions);
router.get('/missions', missions.lister);
router.get('/missions/:id', missions.recuperer);
router.post('/missions/:id/inscription', missions.sInscrire);
router.delete('/missions/:id/inscription', missions.seDesinscrire);
router.post('/missions/:id/avis', missions.laisserUnAvis);

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

export default router;
