/**
 * Routes de l'espace benevole, montees sous /api/benevole.
 *
 * Deux routes publiques -- s'inscrire, se connecter -- et deux protegees.
 * Les publiques sont limitees en frequence : sans cela, l'inscription
 * servirait a creer des comptes en masse, et la connexion a essayer des
 * mots de passe l'un apres l'autre.
 */
import { Router } from 'express';

import * as volunteerAuthController from '../controllers/volunteerAuth.controller.js';
import { authenticateVolunteer } from '../middleware/volunteerAuth.middleware.js';
import { limiterTentatives } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.post(
  '/inscription',
  limiterTentatives({ fenetreMs: 60_000, maximum: 5 }),
  volunteerAuthController.inscription
);

router.post(
  '/login',
  limiterTentatives({ fenetreMs: 60_000, maximum: 10 }),
  volunteerAuthController.login
);

router.get('/me', authenticateVolunteer, volunteerAuthController.me);
router.post('/logout', authenticateVolunteer, volunteerAuthController.logout);

export default router;
