/**
 * Point d'entree du routeur de l'API : rassemble tous les modules sous /api.
 */
import { Router } from 'express';

import { config } from '../config/env.js';

import authRoutes from './auth.routes.js';
import adminAuthRoutes from './adminAuth.routes.js';
import adminRoutes from './admin.routes.js';
import volunteerAuthRoutes from './volunteerAuth.routes.js';
import volunteerSpaceRoutes from './volunteerSpace.routes.js';
import funderRoutes from './funder.routes.js';
import espaceRoutes from './espace.routes.js';
import donorSpaceRoutes from './donorSpace.routes.js';
import { webhookStripe } from '../controllers/paiementCarte.controllers.js';
import { fichiers as fichiersMessagerie } from '../controllers/conversation.controllers.js';
import { photosBeneficiaires } from '../controllers/admin.controllers.js';

const router = Router();

// Sonde de sante, pratique pour verifier que l'API repond.
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hope-api', timestamp: new Date().toISOString() });
});

// Les fichiers de la messagerie : adresses signees, sans session -- une
// balise <img> ou <video> n'en porte pas. Montes avant tout verrou.
router.get('/messagerie/fichiers/piece/:id', fichiersMessagerie.piece);
router.get('/messagerie/fichiers/groupe/:id', fichiersMessagerie.groupe);

// Les photos des beneficiaires : meme principe, adresse signee remise a
// un administrateur. Le dossier est prive, jamais servi sous /media.
router.get('/fichiers/beneficiaires/:fichier', photosBeneficiaires.lire);

/*
 * Ce que Stripe raconte au serveur : un paiement abouti, refuse, ou une
 * session expiree. Sans jeton -- Stripe n'en a pas -- mais signe : la
 * signature est verifiee avant d'en croire un mot.
 */
router.post('/paiements/stripe/webhook', webhookStripe);

// L'adresse de contact de l'association, publique : les pages legales
// l'affichent (EQUIPE_EMAIL). Vide, elles renvoient vers la messagerie.
router.get('/public/contact', (_req, res) => {
  res.json({ email: config.equipe.email || null });
});

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

// Espace donateur : le parcours d'accueil, puis le reste a venir.
router.use('/donateur', donorSpaceRoutes);

export default router;
