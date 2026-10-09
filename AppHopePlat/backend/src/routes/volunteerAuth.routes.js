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
