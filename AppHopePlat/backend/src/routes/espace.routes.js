import { Router } from 'express';

import { conversations } from '../controllers/conversation.controllers.js';
import { televerserGroupe, televerserMessage } from '../middleware/upload.middleware.js';
import * as espace from '../controllers/espace.controllers.js';
import { authenticateEspace } from '../middleware/espaceAuth.middleware.js';
import { limiterTentatives } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.use(authenticateEspace);

router.get('/badges', espace.badges);

router.get('/actualites/reactions', espace.reactionsActualites);
router.post('/actualites/:id/jaime', espace.jaimerActualite);
router.post('/actualites/:id/commentaires', limiterTentatives({ fenetreMs: 15 * 60_000, maximum: 20 }), espace.commenterActualite);

router.get('/compte', espace.etatCompte);
router.post('/compte/verification', limiterTentatives({ fenetreMs: 15 * 60_000, maximum: 3 }), espace.renvoyerVerification);
router.post('/compte/mot-de-passe', limiterTentatives({ fenetreMs: 15 * 60_000, maximum: 10 }), espace.changerMotDePasse);
router.post('/compte/suppression', limiterTentatives({ fenetreMs: 15 * 60_000, maximum: 5 }), espace.supprimerCompte);

router.get('/notifications', espace.listerNotifications);
router.patch('/notifications/lues', espace.marquerToutLu);
router.patch('/notifications/:id/lue', espace.marquerLue);

router.get('/conversations/joignables', conversations.joignables);
router.get('/conversations/non-lus', conversations.nonLus);
router.get('/conversations', conversations.lister);
router.post('/conversations/groupes', televerserGroupe, conversations.creerGroupe);
router.post('/conversations/depuis-fiche', conversations.depuisFiche);
router.post('/conversations', conversations.ouvrir);
router.get('/conversations/:id', conversations.recuperer);
router.get('/conversations/:id/fichiers', conversations.fichiers);
router.post('/conversations/:id/lu', conversations.marquerLu);
router.post('/conversations/:id/participants', conversations.ajouterAuGroupe);
router.post('/conversations/:id/quitter', conversations.quitterGroupe);
router.post('/conversations/:id/messages', televerserMessage, conversations.envoyer);
router.patch('/conversations/:id/messages/:messageId', conversations.modifier);
router.delete('/conversations/:id/messages/:messageId', conversations.supprimer);
router.post('/conversations/:id/messages/:messageId/transfert', conversations.transferer);

router.get('/messages', espace.listerMessages);
router.post('/messages', espace.envoyerMessage);
router.post('/messages/:id/reponse', espace.repondre);

export default router;
