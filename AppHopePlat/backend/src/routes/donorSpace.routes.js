/**
 * Routes de l'espace donateur, toutes derriere authenticateDonor.
 */
import { Router } from 'express';

import { profil } from '../controllers/donorSpace.controllers.js';
import { authenticateDonor } from '../middleware/donorAuth.middleware.js';

const router = Router();

router.use(authenticateDonor);

// Le parcours d'accueil : la fiche, puis chaque etape.
router.get('/profil', profil.recuperer);
router.put('/profil/etape-1', profil.enregistrerEtape1);
router.put('/profil/etape-2', profil.enregistrerEtape2);
router.put('/profil/etape-3', profil.enregistrerEtape3);
router.put('/profil/etape-4', profil.enregistrerEtape4);

// Les projets que l'on peut soutenir : leur face publique seulement.
router.get('/projets', profil.projets);

export default router;
