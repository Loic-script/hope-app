/**
 * Routes communes aux espaces utilisateurs : notifications et messages.
 *
 * Montees sous /api/espace, et non sous /api/benevole ou /api/bailleur :
 * le code serait le meme aux deux endroits, et la table ne distingue pas
 * les roles. Le verrou accepte les trois audiences d'utilisateur.
 */
import { Router } from 'express';

import { conversations } from '../controllers/conversation.controllers.js';
import { televerserGroupe, televerserMessage } from '../middleware/upload.middleware.js';
import * as espace from '../controllers/espace.controllers.js';
import { authenticateEspace } from '../middleware/espaceAuth.middleware.js';
import { limiterTentatives } from '../middleware/rateLimit.middleware.js';

const router = Router();

// Tout l'espace est protege : aucune route publique ici.
router.use(authenticateEspace);

router.get('/badges', espace.badges);

// Le compte : changer son mot de passe, supprimer son compte. Limites :
// le mot de passe actuel y est essaye.
router.post('/compte/mot-de-passe', limiterTentatives({ fenetreMs: 15 * 60_000, maximum: 10 }), espace.changerMotDePasse);
router.post('/compte/suppression', limiterTentatives({ fenetreMs: 15 * 60_000, maximum: 5 }), espace.supprimerCompte);

router.get('/notifications', espace.listerNotifications);
// "lues" avant ":id/lue" : sans cet ordre, Express verrait "lues" comme
// un identifiant.
router.patch('/notifications/lues', espace.marquerToutLu);
router.patch('/notifications/:id/lue', espace.marquerLue);

/*
 * Les conversations : tout le monde ecrit a tout le monde. Montees
 * avant l'ancienne messagerie, qui ne servait qu'a ecrire a l'equipe.
 * "joignables" et "non-lus" avant ":id" : sinon Express les lirait
 * comme des identifiants.
 */
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
