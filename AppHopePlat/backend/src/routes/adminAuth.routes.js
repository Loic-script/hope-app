/**
 * Routes d'authentification administrateur, montees sous /api/admin.
 */
import { Router } from 'express';

import * as adminAuthController from '../controllers/adminAuth.controller.js';
import { authenticateAdmin } from '../middleware/auth.middleware.js';
import { limiterTentatives } from '../middleware/rateLimit.middleware.js';

const router = Router();

// Publique : connexion de l'administrateur.
router.post(
  '/login',
  limiterTentatives({ fenetreMs: 60_000, maximum: 10 }),
  adminAuthController.login
);

// Protegees : necessitent un JWT valide.
router.get('/me', authenticateAdmin, adminAuthController.me);
router.post('/logout', authenticateAdmin, adminAuthController.logout);

export default router;
