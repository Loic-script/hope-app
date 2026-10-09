import * as paiementCarteService from '../services/paiementCarte.service.js';
import { gerer } from './handler.js';

export function controleursCarte(identiteDe, { mensuelPermis = true } = {}) {
  return {
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

export const webhookStripe = gerer(async (req, res) => {
  try {
    const resultat = await paiementCarteService.traiterEvenement(
      req.corpsBrut ?? req.body,
      req.get('stripe-signature') ?? ''
    );
    res.status(200).json(resultat);
  } catch (echec) {
    console.error('[HOPE] Webhook Stripe refuse :', echec?.message ?? echec);
    res.status(400).json({ erreur: 'Message Stripe refusé.' });
  }
});
