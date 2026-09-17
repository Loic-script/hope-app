/**
 * Point d'entree du routeur de l'API : rassemble tous les modules sous /api.
 */
import { Router } from 'express';

import authRoutes from './auth.routes.js';
import adminAuthRoutes from './adminAuth.routes.js';
import adminRoutes from './admin.routes.js';
import volunteerAuthRoutes from './volunteerAuth.routes.js';
import volunteerSpaceRoutes from './volunteerSpace.routes.js';
import funderRoutes from './funder.routes.js';
import espaceRoutes from './espace.routes.js';
import { fichiers as fichiersMessagerie } from '../controllers/conversation.controllers.js';

const router = Router();

// Sonde de sante, pratique pour verifier que l'API repond.
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hope-api', timestamp: new Date().toISOString() });
});

// Les fichiers de la messagerie : adresses signees, sans session -- une
// balise <img> ou <video> n'en porte pas. Montes avant tout verrou.
router.get('/messagerie/fichiers/piece/:id', fichiersMessagerie.piece);

// Authentification des utilisateurs : un seul formulaire pour les trois
// types (donateur, benevole, bailleur), plus l'amorce de l'espace donateur.
router.use('/', authRoutes);

// Authentification : /login est public, /me et /logout sont proteges.
router.use('/admin', adminAuthRoutes);

// Espace administrateur : tout est protege par authenticateAdmin.
router.use('/admin', adminRoutes);

// Espace benevole : /inscription et /login sont publics...
router.use('/benevole', volunteerAuthRoutes);

// ...le reste de l'espace exige un jeton de benevole. Monte apres les
// routes publiques : son verrou global ne doit pas les couvrir.
router.use('/benevole', volunteerSpaceRoutes);

// Espace bailleur : /inscription, /login et /types-organisation sont
// publics, le reste exige un jeton de bailleur.
router.use('/bailleur', funderRoutes);

// Notifications et messages, communs a tous les espaces utilisateurs :
// le benevole et le bailleur y lisent les leurs avec leur propre jeton.
router.use('/espace', espaceRoutes);

export default router;
