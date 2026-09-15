/**
 * Routes communes aux espaces utilisateurs : notifications et messages.
 *
 * Montees sous /api/espace, et non sous /api/benevole ou /api/bailleur :
 * le code serait le meme aux deux endroits, et la table ne distingue pas
 * les roles. Le verrou accepte les trois audiences d'utilisateur.
 */
import { Router } from 'express';

import * as espace from '../controllers/espace.controllers.js';
import { authenticateEspace } from '../middleware/espaceAuth.middleware.js';

const router = Router();

// Tout l'espace est protege : aucune route publique ici.
router.use(authenticateEspace);

router.get('/badges', espace.badges);

router.get('/notifications', espace.listerNotifications);
// "lues" avant ":id/lue" : sans cet ordre, Express verrait "lues" comme
// un identifiant.
router.patch('/notifications/lues', espace.marquerToutLu);
router.patch('/notifications/:id/lue', espace.marquerLue);

router.get('/messages', espace.listerMessages);
router.post('/messages', espace.envoyerMessage);
router.post('/messages/:id/reponse', espace.repondre);

export default router;
