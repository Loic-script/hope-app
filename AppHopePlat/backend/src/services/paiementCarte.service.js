import Stripe from 'stripe';

import { config } from '../config/env.js';
import * as donationRepository from '../repositories/donation.repository.js';
import * as donorSpaceRepository from '../repositories/donorSpace.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';
import { centimesVersTexte, enCentimes } from '../shared/money.js';
import { presenter, promettreUnDon } from './promesseDon.service.js';
import * as courrielsAuto from './courrielsAutomatiques.service.js';

const MODE = 'carte_bancaire';

const SANS_CENTIMES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

export function estDisponible() {
  return Boolean(config.stripe.cleSecrete && config.stripe.clePublique);
}

export function reglages() {
  return {
    disponible: estDisponible(),
    clePublique: config.stripe.clePublique || null,
  };
}

let stripe = null;

function chezStripe() {
  if (!estDisponible()) {
    throw new ErreurValidation(
      'Le paiement par carte n’est pas disponible pour le moment. Choisissez un autre moyen.',
      { mode: 'Carte indisponible' }
    );
  }
  if (!stripe) {
    stripe = new Stripe(config.stripe.cleSecrete, {
      appInfo: { name: 'HOPE', url: config.siteUrl },
      maxNetworkRetries: 2,
      timeout: 20_000,
    });
  }
  return stripe;
}

function montantPourStripe(centimes, devise) {
  if (!SANS_CENTIMES.has(devise)) return centimes;
  if (centimes % 100 !== 0) {
    throw new ErreurValidation(`Un don en ${devise} se donne en unités entières.`, {
      montant: 'Montant sans décimales',
    });
  }
  return centimes / 100;
}

function centimesDuDon(don) {
  return enCentimes(don.amount ?? don.montant, 'montant', { minimum: 1 });
}

function adresseDeRetour(origine, chemin) {
  const autorisees = [config.siteUrl, ...config.corsOrigin.split(',')]
    .map((valeur) => String(valeur).trim().replace(/\/$/, ''))
    .filter(Boolean);
  const demandee = String(origine ?? '')
    .trim()
    .replace(/\/$/, '');
  const base =
    demandee && (autorisees.includes(demandee) || config.env !== 'production')
      ? demandee
      : autorisees[0];
  return `${base}${chemin}`;
}

export async function creerSession(
  identite,
  corps = {},
  { origine = '', mensuelPermis = true } = {}
) {
  const client = chezStripe();

  const { don } = await promettreUnDon(
    identite,
    { ...corps, mode: MODE },
    { mensuelPermis, enLigne: true }
  );

  const centimes = centimesDuDon(don);
  const devise = String(don.devise ?? don.currency ?? 'MGA').toUpperCase();
  const retour = adresseDeRetour(
    origine,
    `${cheminDeRetour(corps.retour)}?session={CHECKOUT_SESSION_ID}`
  );

  let session;
  try {
    session = await client.checkout.sessions.create(
      {
        mode: 'payment',
        ui_mode: 'elements',
        return_url: retour,
        customer_email: identite.email || undefined,
        billing_address_collection: 'auto',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: devise.toLowerCase(),
              unit_amount: montantPourStripe(centimes, devise),
              product_data: {
                name: `Don à HOPE — ${don.projetNom || 'projets de HOPE'}`,
                description: `Référence ${don.reference}`,
              },
            },
          },
        ],
        payment_intent_data: {
          description: `Don ${don.reference} — HOPE`,
          metadata: { donId: String(don.id), reference: don.reference },
        },
        metadata: { donId: String(don.id), reference: don.reference },
      },
      { idempotencyKey: `don-${don.reference}` }
    );
  } catch (echec) {
    throw erreurLisible(echec);
  }

  await donationRepository.mettreAJour(don.id, {
    payment_provider: 'stripe',
    provider_session_id: session.id,
    provider_status: session.status,
    provider_updated_at: new Date(),
  });

  return {
    clientSecret: session.client_secret,
    clePublique: config.stripe.clePublique,
    sessionId: session.id,
    don,
  };
}

function cheminDeRetour(chemin) {
  const propre = String(chemin ?? '').trim();
  return /^\/[A-Za-z0-9\-/_]{0,120}$/.test(propre) && !propre.startsWith('//')
    ? propre
    : '/donateur/payer/carte/retour';
}

export async function etatSession(identite, sessionId) {
  const client = chezStripe();
  const id = String(sessionId ?? '').trim();
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) {
    throw new ErreurValidation('Session de paiement inconnue.', {
      session: 'Identifiant invalide',
    });
  }

  const don = await donationRepository.parSessionFournisseur(id);
  const autorise = identite.peutLire ? identite.peutLire(don) : don.utilisateurId === identite.utilisateurId;
  if (!don || !autorise) {
    throw new ErreurIntrouvable('Le paiement', id);
  }

  let session;
  try {
    session = await client.checkout.sessions.retrieve(id, {
      expand: ['payment_intent'],
    });
  } catch (echec) {
    throw erreurLisible(echec);
  }

  await synchroniser(don, session);
  const aJour = identite.relire
    ? await identite.relire(don.id)
    : await donorSpaceRepository.unDeMesDons(identite.utilisateurId, don.id);
  return {
    statut: session.status,
    paiement: session.payment_status,
    erreur: messageDuRefus(session),
    don: aJour ? presenter(aJour) : null,
  };
}

export async function traiterEvenement(corpsBrut, signature) {
  const client = chezStripe();
  if (!config.stripe.secretWebhook) {
    throw new ErreurValidation('Le secret du webhook Stripe n’est pas configuré.');
  }

  let evenement;
  try {
    evenement = client.webhooks.constructEvent(corpsBrut, signature, config.stripe.secretWebhook);
  } catch {
    throw new ErreurValidation('Signature Stripe invalide.');
  }

  const interessants = new Set([
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'checkout.session.expired',
  ]);
  if (!interessants.has(evenement.type)) return { recu: true, ignore: evenement.type };

  const session = evenement.data.object;
  const don = await donationRepository.parSessionFournisseur(session.id);
  if (!don) return { recu: true, ignore: 'don introuvable' };

  await synchroniser(don, session);
  return { recu: true, traite: evenement.type };
}

async function synchroniser(don, session) {
  const paiement = session.payment_intent;
  const paiementId = typeof paiement === 'string' ? paiement : (paiement?.id ?? null);

  if (session.payment_status !== 'paid') {
    return donationRepository.noterEtatFournisseur(don.id, {
      paiementId,
      statutFournisseur: session.payment_status ?? session.status ?? null,
    });
  }

  const devise = String(don.devise ?? don.currency ?? 'MGA').toUpperCase();
  const attendu = montantPourStripe(centimesDuDon(don), devise);
  const recu = Number(session.amount_total);
  const memeDevise = String(session.currency ?? '').toUpperCase() === devise;
  if (!memeDevise || recu !== attendu) {
    await notificationRepository.creer({
      type: 'DONATION',
      label:
        `Paiement par carte à vérifier : le don ${don.reference} porte ` +
        `${centimesVersTexte(centimesDuDon(don))} ${devise}, Stripe annonce ` +
        `${recu} ${String(session.currency ?? '').toUpperCase()} (session ${session.id}).`,
      donationId: don.id,
      donorId: don.donorId ?? null,
      projectId: don.projectId ?? null,
    });
    return donationRepository.noterEtatFournisseur(don.id, {
      paiementId,
      statutFournisseur: 'montant_different',
    });
  }

  const confirme = await donationRepository.confirmerPaiementEnLigne(don.id, {
    paiementId,
    statutFournisseur: session.payment_status,
    referencePaiement: paiementId,
  });
  if (!confirme) return donationRepository.trouverParId(don.id);

  await notificationRepository.creer({
    type: 'DONATION',
    label:
      `Don reçu par carte : ${centimesVersTexte(centimesDuDon(don))} ${devise} ` +
      `de ${don.donorName ?? 'un donateur'}` +
      `${don.projectName ? ` pour « ${don.projectName} »` : ''} — réf. ${don.reference}, ` +
      'encaissé par Stripe.',
    donationId: don.id,
    donorId: don.donorId ?? null,
    projectId: don.projectId ?? null,
  });
  void courrielsAuto.donRecu(don.id);
  return confirme;
}

function messageDuRefus(session) {
  const paiement = session.payment_intent;
  if (typeof paiement === 'string' || !paiement?.last_payment_error) return null;
  return paiement.last_payment_error.message ?? null;
}

function erreurLisible(echec) {
  console.error('[HOPE] Stripe :', echec?.type ?? '', echec?.message ?? echec);
  const messages = {
    StripeCardError: 'Votre carte a été refusée. Essayez-en une autre.',
    StripeInvalidRequestError: 'Le paiement n’a pas pu être préparé. Réessayez dans un instant.',
    StripeAuthenticationError: 'Le paiement par carte n’est pas configuré correctement.',
    StripeConnectionError: 'La liaison avec la banque n’a pas abouti. Réessayez dans un instant.',
  };
  return new ErreurValidation(
    messages[echec?.type] ?? 'Le paiement n’a pas pu être préparé. Réessayez dans un instant.'
  );
}
