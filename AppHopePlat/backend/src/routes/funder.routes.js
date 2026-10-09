import { Router } from 'express';

import * as funder from '../controllers/funder.controllers.js';
import { controleursCarte } from '../controllers/paiementCarte.controllers.js';
import { identiteBailleur } from '../services/promesseDon.service.js';
import {
  authenticateFunder,
  exigerConsultation,
  exigerOrganisation,
} from '../middleware/funderAuth.middleware.js';
import { limiterTentatives } from '../middleware/rateLimit.middleware.js';
import { televerserMedia } from '../middleware/upload.middleware.js';

const router = Router();

const carte = controleursCarte((req) => identiteBailleur(req.bailleur), { mensuelPermis: false });

router.get('/types-organisation', funder.typesOrganisation);

router.post(
  '/inscription',
  limiterTentatives({ fenetreMs: 60_000, maximum: 5 }),
  funder.inscription
);

router.post(
  '/login',
  limiterTentatives({ fenetreMs: 60_000, maximum: 10 }),
  funder.login
);

router.get('/me', authenticateFunder, funder.me);
router.post('/logout', authenticateFunder, funder.logout);

router.use(authenticateFunder, exigerConsultation);

router.use(exigerOrganisation);

router.get('/tableau-de-bord', funder.espace.tableauDeBord);
router.get('/partenariat', funder.espace.partenariat);
router.get('/versements', funder.espace.versements);
router.get('/paiements', funder.espace.paiements);

router.get('/projets', funder.espace.projets);
router.get('/projets/:id', funder.espace.projet);
router.get('/dons/options', funder.espace.optionsDon);
router.post('/dons', funder.espace.faireUnDon);
router.get('/paiement/coordonnees', funder.espace.coordonneesPaiement);
router.get('/paiement/carte', carte.reglages);
router.post('/paiement/carte/session', carte.ouvrir);
router.get('/paiement/carte/session/:id', carte.etat);
router.patch('/dons/:id/justificatif', funder.espace.declarerPaiement);
router.get('/projets/:id/rapport', funder.espace.rapportProjet);
router.get('/projets/:id/rapport/pdf', funder.espace.pdfRapportProjet);

router.get('/documents', funder.espace.documents);
router.get('/documents/:id/apercu', funder.espace.apercuDocument);
router.post('/documents/:id/telechargement', funder.espace.telecharger);
router.post('/certificat', funder.espace.certificat);

router.get('/fil', funder.espace.fil);
router.post('/interet', funder.espace.manifesterUnInteret);

router.get('/profil', funder.espace.profil);
router.patch('/organisation', funder.espace.mettreAJourOrganisation);
router.patch('/profil/contact', funder.espace.mettreAJourContact);

router.post('/profil/photo', televerserMedia, funder.espace.televerserPhoto);

export default router;
