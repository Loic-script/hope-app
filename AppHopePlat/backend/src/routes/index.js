/**
 * Point d'entree du routeur de l'API : rassemble tous les modules sous /api.
 */
import { Router } from 'express';

import adminAuthRoutes from './adminAuth.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

// Sonde de sante, pratique pour verifier que l'API repond.
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hope-api', timestamp: new Date().toISOString() });
});

// Authentification : /login est public, /me et /logout sont proteges.
router.use('/admin', adminAuthRoutes);

// Espace administrateur : tout est protege par authenticateAdmin.
router.use('/admin', adminRoutes);

export default router;
