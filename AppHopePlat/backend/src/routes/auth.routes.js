/**
 * Routes d'authentification des utilisateurs, montees sous /api/auth,
 * et l'amorce de l'espace donateur sous /api/donateur.
 *
 * L'administrateur n'est pas concerne : il garde /api/admin/login, son
 * compte n'etant pas cree par inscription.
 *
 * Les routes publiques sont limitees en frequence : sans cela
 * l'inscription servirait a creer des comptes en masse, et la connexion
 * a essayer des mots de passe l'un apres l'autre.
 */
import { Router } from 'express';

import * as auth from '../controllers/auth.controllers.js';
import { authenticateDonor } from '../middleware/donorAuth.middleware.js';
import { limiterTentatives } from '../middleware/rateLimit.middleware.js';

const router = Router();

/* ------------------------------- Public -------------------------------- */

router.get('/auth/types', auth.types);

router.post(
  '/auth/inscription',
  limiterTentatives({ fenetreMs: 60_000, maximum: 5 }),
  auth.inscription
);

router.post(
  '/auth/login',
  limiterTentatives({ fenetreMs: 60_000, maximum: 10 }),
  auth.login
);

/* -------------------------- Espace donateur ---------------------------- */

/**
 * L'espace donateur n'est pas construit : une page de bienvenue, et le
 * profil du compte connecte pour l'alimenter. Le reste viendra.
 */
router.get('/donateur/me', authenticateDonor, (req, res) => {
  res.status(200).json({ authenticated: true, donateur: req.donateur });
});

router.post('/donateur/logout', authenticateDonor, (_req, res) => {
  res.status(200).json({ success: true, message: 'Déconnexion effectuée.' });
});

export default router;
