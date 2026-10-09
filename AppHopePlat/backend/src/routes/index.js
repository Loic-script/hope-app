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
import * as donInvite from '../controllers/donInvite.controllers.js';
import * as contact from '../controllers/contact.controllers.js';
import { limiterTentatives } from '../middleware/rateLimit.middleware.js';
import { fichiers as fichiersMessagerie } from '../controllers/conversation.controllers.js';
import { photosBeneficiaires } from '../controllers/admin.controllers.js';
import * as vitrineService from '../services/vitrine.service.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hope-api', timestamp: new Date().toISOString() });
});

router.get('/messagerie/fichiers/piece/:id', fichiersMessagerie.piece);
router.get('/messagerie/fichiers/groupe/:id', fichiersMessagerie.groupe);

router.get('/fichiers/beneficiaires/:fichier', photosBeneficiaires.lire);

router.post('/paiements/stripe/webhook', webhookStripe);

router.get('/public/contact', (_req, res) => {
  res.json({ email: config.equipe.email || null });
});

router.get('/public/contact/sujets', contact.options);
router.post('/public/contact', limiterTentatives({ fenetreMs: 15 * 60_000, maximum: 6 }), contact.envoyer);

router.get('/public/actualites', async (req, res, next) => {
  try {
    res.json(await vitrineService.actualites(req.query));
  } catch (erreur) {
    next(erreur);
  }
});
router.get('/public/actualites/:id', async (req, res, next) => {
  try {
    res.json(await vitrineService.actualite(req.params.id));
  } catch (erreur) {
    next(erreur);
  }
});

router.get('/public/benevoles', async (_req, res, next) => {
  try {
    res.json(await vitrineService.benevoles());
  } catch (erreur) {
    next(erreur);
  }
});

router.get('/public/projets', async (req, res, next) => {
  try {
    res.json(await vitrineService.projets(req.query));
  } catch (erreur) {
    next(erreur);
  }
});
router.get('/public/projets/:id', async (req, res, next) => {
  try {
    res.json(await vitrineService.projet(req.params.id));
  } catch (erreur) {
    next(erreur);
  }
});

router.get('/public/dons/options', donInvite.options);
router.get('/public/dons/coordonnees', donInvite.coordonnees);
router.post('/public/dons', limiterTentatives({ fenetreMs: 15 * 60_000, maximum: 10 }), donInvite.promettre);
router.patch(
  '/public/dons/:id/justificatif',
  limiterTentatives({ fenetreMs: 15 * 60_000, maximum: 20 }),
  donInvite.declarer
);
router.get('/public/dons/paiement/carte', donInvite.carte.reglages);
router.post(
  '/public/dons/paiement/carte/session',
  limiterTentatives({ fenetreMs: 15 * 60_000, maximum: 10 }),
  donInvite.carte.ouvrir
);
router.get('/public/dons/paiement/carte/session/:id', donInvite.carte.etat);

router.use('/', authRoutes);

router.use('/admin', adminAuthRoutes);

router.use('/admin', adminRoutes);

router.use('/benevole', volunteerAuthRoutes);

router.use('/benevole', volunteerSpaceRoutes);

router.use('/bailleur', funderRoutes);

router.use('/espace', espaceRoutes);

router.use('/donateur', donorSpaceRoutes);

export default router;
