/**
 * Le paiement par carte, pour les trois espaces qui donnent.
 *
 * Un donateur, un bailleur et un benevole paient la meme page ; seule
 * change la facon de dire qui donne. D'ou une fabrique : chaque espace
 * monte ces trois routes avec son identite et ses regles.
 */
import * as paiementCarteService from '../services/paiementCarte.service.js';
import { gerer } from './handler.js';

/**
 * @param {(req) => object} identiteDe  qui donne, depuis la requete
 * @param {{ mensuelPermis?: boolean }} reglages  le mensuel n'est ouvert
 *   qu'au donateur : un bailleur ou un benevole donne une fois.
 */
export function controleursCarte(identiteDe, { mensuelPermis = true } = {}) {
  return {
    // La page en a besoin avant tout : la carte est-elle acceptee ici ?
    reglages: gerer(() => paiementCarteService.reglages()),

    ouvrir: gerer(
      (req) =>
        paiementCarteService.creerSession(identiteDe(req), req.body, {
          origine: req.get('origin') ?? '',
          mensuelPermis,
        }),
      { statut: 201 }
    ),

    etat: gerer((req) => paiementCarteService.etatSession(identiteDe(req), req.params.id)),
  };
}

/**
 * Le message signe que Stripe envoie au serveur, sans session ni jeton :
 * c'est la signature qui fait foi. Le corps brut est garde par
 * express.json (voir app.js) -- une seule virgule deplacee invaliderait
 * la signature.
 */
export const webhookStripe = gerer(async (req, res) => {
  try {
    const resultat = await paiementCarteService.traiterEvenement(
      req.corpsBrut ?? req.body,
      req.get('stripe-signature') ?? ''
    );
    res.status(200).json(resultat);
  } catch (echec) {
    // Stripe reessaie tant qu'il n'a pas de 2xx : on repond clairement,
    // sans rien dire de plus au monde exterieur.
    console.error('[HOPE] Webhook Stripe refuse :', echec?.message ?? echec);
    res.status(400).json({ erreur: 'Message Stripe refusé.' });
  }
});
