import { Router } from 'express';

import { actualites, benevoles, dons, profil, projets, taches } from '../controllers/volunteerSpace.controllers.js';
import { controleursCarte } from '../controllers/paiementCarte.controllers.js';
import { identiteBenevole } from '../services/promesseDon.service.js';
import { televerserMedia, televerserPreuve } from '../middleware/upload.middleware.js';
import {
  authenticateVolunteer,
  authenticateVolunteerACompleter,
} from '../middleware/volunteerAuth.middleware.js';

const router = Router();

const carte = controleursCarte((req) => identiteBenevole(req.benevole), { mensuelPermis: false });

router.post('/profil/completer', authenticateVolunteerACompleter, profil.completer);

router.use(authenticateVolunteer);

router.get('/apercu', taches.apercu);

router.get('/projets', projets.lister);
router.get('/projets/:id', projets.recuperer);
router.get('/projets/:id/preuves/:preuveId/fichiers/:fileId', projets.fichierPreuve);
router.post('/projets/:id/preuves', televerserPreuve, projets.ajouterPreuve);
router.delete('/projets/:id/preuves/:preuveId', projets.supprimerPreuve);

router.get('/actualites', actualites.lister);

router.get('/dons/options', dons.options);
router.post('/dons', dons.faire);
router.get('/paiement/coordonnees', dons.coordonnees);
router.get('/paiement/carte', carte.reglages);
router.post('/paiement/carte/session', carte.ouvrir);
router.get('/paiement/carte/session/:id', carte.etat);
router.patch('/dons/:id/justificatif', dons.declarer);

router.get('/taches/libres', taches.libres);
router.get('/taches', taches.miennes);
router.post('/taches/:id/demander', taches.demander);
router.post('/taches/:id/annuler-demande', taches.annulerDemande);
router.post('/taches/:id/relacher', taches.relacher);
router.post('/taches/:id/livrer', televerserPreuve, taches.livrer);
router.get('/taches/:id/fichiers/:fileId', taches.fichier);

router.get('/benevoles', benevoles.lister);
router.get('/benevoles/:id', benevoles.profil);

router.get('/profil', profil.recuperer);
router.patch('/profil', profil.mettreAJour);
router.get('/journal', profil.journal);
router.post('/profil/photo', televerserMedia, profil.televerserPhoto);

export default router;
