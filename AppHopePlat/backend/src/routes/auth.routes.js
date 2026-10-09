import { Router } from 'express';

import * as auth from '../controllers/auth.controllers.js';
import { authenticateDonor } from '../middleware/donorAuth.middleware.js';
import { limiterTentatives } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.get('/auth/types', auth.types);

router.post(
  '/auth/inscription',
  limiterTentatives({ fenetreMs: 60_000, maximum: 5 }),
  auth.inscription
);

router.post(
  '/auth/mot-de-passe-oublie',
  limiterTentatives({ fenetreMs: 15 * 60_000, maximum: 5 }),
  auth.motDePasseOublie
);
router.post(
  '/auth/reinitialiser-mot-de-passe',
  limiterTentatives({ fenetreMs: 15 * 60_000, maximum: 10 }),
  auth.reinitialiserMotDePasse
);

router.post(
  '/auth/verifier-courriel',
  limiterTentatives({ fenetreMs: 15 * 60_000, maximum: 20 }),
  auth.verifierCourriel
);

router.post(
  '/auth/login',
  limiterTentatives({ fenetreMs: 60_000, maximum: 10 }),
  auth.login
);

router.get('/donateur/me', authenticateDonor, (req, res) => {
  res.status(200).json({ authenticated: true, donateur: req.donateur });
});

router.post('/donateur/logout', auth.logout);
router.post('/auth/logout', auth.logout);

export default router;
