/**
 * Routes de l'espace bailleur, montees sous /api/bailleur.
 *
 * Trois routes publiques -- s'inscrire, se connecter, lire la liste des
 * types d'organisation -- et tout le reste derriere le jeton.
 *
 * SECURITE : aucune route de ce fichier ne cree ni ne modifie un
 * engagement, un versement ou une affectation. L'espace est en lecture
 * seule sur les montants ; les seules ecritures sont la fiche de
 * contact et la manifestation d'interet, qui ne debite rien.
 */
import { Router } from 'express';

import * as funder from '../controllers/funder.controllers.js';
import {
  authenticateFunder,
  exigerConsultation,
  exigerOrganisation,
} from '../middleware/funderAuth.middleware.js';
import { limiterTentatives } from '../middleware/rateLimit.middleware.js';
import { televerserMedia } from '../middleware/upload.middleware.js';

const router = Router();

/* ---------------------------- Public ---------------------------------- */

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

/* ---------------------------- Protege --------------------------------- */

router.get('/me', authenticateFunder, funder.me);
router.post('/logout', authenticateFunder, funder.logout);

// Le verrou vaut pour tout ce qui suit : jeton valide, puis droit de
// consultation. Un contact desactive par HOPE ne passe pas.
router.use(authenticateFunder, exigerConsultation);

// Declarer son organisation : accessible AVANT le verrou ci-dessous,
// puisque c'est precisement ce qui manque a ce moment-la.
router.post('/organisation', funder.espace.declarerOrganisation);

// Tout ce qui suit a besoin d'un bailleur_id sur quoi filtrer.
router.use(exigerOrganisation);

router.get('/tableau-de-bord', funder.espace.tableauDeBord);
router.get('/partenariat', funder.espace.partenariat);
router.get('/versements', funder.espace.versements);

router.get('/documents', funder.espace.documents);
router.post('/documents/:id/telechargement', funder.espace.telecharger);
router.post('/certificat', funder.espace.certificat);

router.get('/preuves', funder.espace.preuves);
// Le fichier d'une preuve : le service verifie que le projet est bien
// finance par ce bailleur avant de l'ouvrir.
router.get('/preuves/:id/fichiers/:fileId', funder.espace.telechargerPreuve);

router.get('/fil', funder.espace.fil);
router.post('/interet', funder.espace.manifesterUnInteret);

router.get('/profil', funder.espace.profil);
router.patch('/profil/contact', funder.espace.mettreAJourContact);

// La photo de contact : televersee ici, rattachee par le PATCH ci-dessus.
router.post('/profil/photo', televerserMedia, funder.espace.televerserPhoto);

export default router;
