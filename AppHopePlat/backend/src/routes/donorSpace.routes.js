/**
 * Routes de l'espace donateur, toutes derriere authenticateDonor.
 */
import { Router } from 'express';

import { actualites, dons, profil } from '../controllers/donorSpace.controllers.js';
import { controleursCarte } from '../controllers/paiementCarte.controllers.js';
import { identiteDonateur } from '../services/donorSpace.service.js';
import { authenticateDonor } from '../middleware/donorAuth.middleware.js';
import { televerserMedia } from '../middleware/upload.middleware.js';

const router = Router();

// Le paiement par carte : un donateur peut donner une fois ou tous les mois.
const carte = controleursCarte((req) => identiteDonateur(req.donateur));

router.use(authenticateDonor);

// Le parcours d'accueil : la fiche, puis chaque etape.
router.get('/profil', profil.recuperer);
router.put('/profil/etape-1', profil.enregistrerEtape1);
router.put('/profil/etape-2', profil.enregistrerEtape2);
router.put('/profil/etape-3', profil.enregistrerEtape3);
router.put('/profil/etape-4', profil.enregistrerEtape4);
router.put('/profil/etape-5', profil.enregistrerEtape5);

// La photo de profil : televersee, puis rattachee au compte.
router.post('/profil/photo', televerserMedia, profil.televerserPhoto);
router.patch('/profil/photo', profil.changerPhoto);

// Les projets que l'on peut soutenir : leur face publique seulement ; et
// la fiche d'un projet, avec ce que le donateur y a donne.
router.get('/projets', profil.projets);
router.get('/projets/:id', profil.projet);

// Ses dons, et un nouveau don : une promesse, que l'equipe confirme a
// reception du paiement.
router.get('/dons', dons.lister);
// Ou envoyer un don MVola : le numero de HOPE.
router.get('/paiement/mvola', dons.mvola);
router.get('/paiement/orange-money', dons.orangeMoney);
// Les coordonnees de HOPE pour les moyens hors ligne.
router.get('/paiement/coordonnees', dons.coordonnees);
// La carte : le seul moyen encaisse en ligne. La page demande d'abord
// si elle est disponible, ouvre une session de paiement chez Stripe,
// puis lit ce qu'il en est au retour.
router.get('/paiement/carte', carte.reglages);
router.post('/paiement/carte/session', carte.ouvrir);
router.get('/paiement/carte/session/:id', carte.etat);
// Apres coup : "j'ai fait le virement", avec sa reference.
router.patch('/dons/:id/justificatif', dons.declarer);
router.post('/dons', dons.faire);

// Les nouvelles de HOPE.
router.get('/actualites', actualites.lister);

export default router;
