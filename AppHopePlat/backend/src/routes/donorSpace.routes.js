import { Router } from 'express';

import { actualites, dons, profil } from '../controllers/donorSpace.controllers.js';
import { controleursCarte } from '../controllers/paiementCarte.controllers.js';
import { identiteDonateur } from '../services/donorSpace.service.js';
import { authenticateDonor } from '../middleware/donorAuth.middleware.js';
import { televerserMedia } from '../middleware/upload.middleware.js';

const router = Router();

const carte = controleursCarte((req) => identiteDonateur(req.donateur));

router.use(authenticateDonor);

router.get('/profil', profil.recuperer);
router.put('/profil/etape-1', profil.enregistrerEtape1);
router.put('/profil/etape-2', profil.enregistrerEtape2);
router.put('/profil/etape-3', profil.enregistrerEtape3);
router.put('/profil/etape-4', profil.enregistrerEtape4);
router.put('/profil/etape-5', profil.enregistrerEtape5);

router.post('/profil/photo', televerserMedia, profil.televerserPhoto);
router.patch('/profil/photo', profil.changerPhoto);

router.get('/projets', profil.projets);
router.get('/projets/:id', profil.projet);

router.get('/dons', dons.lister);
router.get('/paiement/mvola', dons.mvola);
router.get('/paiement/orange-money', dons.orangeMoney);
router.get('/paiement/coordonnees', dons.coordonnees);
router.get('/paiement/carte', carte.reglages);
router.post('/paiement/carte/session', carte.ouvrir);
router.get('/paiement/carte/session/:id', carte.etat);
router.patch('/dons/:id/justificatif', dons.declarer);
router.post('/dons', dons.faire);

router.get('/actualites', actualites.lister);

export default router;
