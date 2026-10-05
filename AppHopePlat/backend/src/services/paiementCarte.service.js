/**
 * Le don par carte bancaire, encaisse par Stripe.
 *
 * C'est le seul moyen de paiement que HOPE encaisse en ligne. Les autres
 * -- MVola, virement, especes... -- sont declaratifs : le donateur paie
 * de son cote, et l'equipe rapproche de son releve. La carte, elle, se
 * paie sur la page meme.
 *
 * Le chemin d'un don :
 *
 *   1. le donateur choisit son montant ; HOPE enregistre la promesse
 *      (un don en attente, avec sa reference DON-2026-0042) ;
 *   2. HOPE ouvre chez Stripe une session de paiement pour ce don, et
 *      rend au navigateur un "client secret" -- le laissez-passer du
 *      cadre de saisie de Stripe ;
 *   3. le donateur tape sa carte DANS le cadre de Stripe. Le numero ne
 *      passe ni par le serveur de HOPE, ni par sa base : c'est la regle
 *      qui evite a l'association toute la charge de la norme PCI-DSS ;
 *   4. Stripe encaisse, puis le dit deux fois : a la page de retour du
 *      donateur, et au serveur par un message signe (webhook). La
 *      premiere des deux annonces passe le don a "recu" ; la seconde ne
 *      fait rien -- voir confirmerPaiementEnLigne.
 *
 * Le montant encaisse est toujours celui enregistre en base, jamais
 * celui que le navigateur annonce : la session est ouverte a partir du
 * don, et l'annonce de Stripe est verifiee contre lui.
 */
import Stripe from 'stripe';

import { config } from '../config/env.js';
import * as donationRepository from '../repositories/donation.repository.js';
import * as donorSpaceRepository from '../repositories/donorSpace.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';
import { centimesVersTexte, enCentimes } from '../shared/money.js';
import { presenter, promettreUnDon } from './promesseDon.service.js';
import * as courrielsAuto from './courrielsAutomatiques.service.js';

/** Le mode de paiement, tel que le parcours et la base le nomment. */
const MODE = 'carte_bancaire';

/**
 * Les devises sans centimes : Stripe y attend des unites entieres.
 * L'ariary en fait partie -- 25 000 Ar s'envoient comme 25000, quand
 * 25 EUR s'envoient comme 2500.
 */
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

/** Le paiement par carte est-il ouvert sur cette installation ? */
export function estDisponible() {
  return Boolean(config.stripe.cleSecrete && config.stripe.clePublique);
}

/**
 * Ce que la page de paiement a besoin de savoir avant d'ouvrir : si la
 * carte est acceptee, et la cle publique du cadre de Stripe. La cle
 * secrete, elle, ne sort jamais d'ici.
 */
export function reglages() {
  return {
    disponible: estDisponible(),
    clePublique: config.stripe.clePublique || null,
  };
}

let stripe = null;

/** Le client Stripe, ouvert a la premiere demande. */
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

/** 25 000 Ar -> 25000 ; 25,50 EUR -> 2550. Le montant tel que Stripe le lit. */
function montantPourStripe(centimes, devise) {
  if (!SANS_CENTIMES.has(devise)) return centimes;
  if (centimes % 100 !== 0) {
    throw new ErreurValidation(`Un don en ${devise} se donne en unités entières.`, {
      montant: 'Montant sans décimales',
    });
  }
  return centimes / 100;
}

/** Le montant d'un don, en centimes : la base le garde en "25000.00". */
function centimesDuDon(don) {
  return enCentimes(don.amount ?? don.montant, 'montant', { minimum: 1 });
}

/**
 * L'adresse ou Stripe ramene le donateur apres une verification de sa
 * banque (3-D Secure).
 *
 * Elle doit etre absolue. En developpement, on suit l'origine d'ou vient
 * la demande -- un telephone qui ouvre le site par le reseau local n'a
 * que faire de "localhost". En production, seule l'adresse du site
 * configuree est acceptee : une adresse soufflee par le navigateur
 * enverrait le donateur ailleurs.
 */
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

/**
 * Ouvre une session de paiement pour un nouveau don.
 *
 * @param {object} identite qui donne (voir promesseDon.service)
 * @param {{ affectation, projetId?, montant, devise?, frequence?, message?, retour? }} corps
 * @param {{ origine?: string, mensuelPermis?: boolean }} contexte
 */
export async function creerSession(
  identite,
  corps = {},
  { origine = '', mensuelPermis = true } = {}
) {
  const client = chezStripe();

  // La promesse d'abord : le don existe, avec sa reference, avant meme
  // que la carte ne soit tapee. Un paiement abandonne laisse une trace
  // lisible -- et le donateur peut reprendre par un autre moyen.
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
      // Deux clics sur "Donner" ne creent qu'une session : la reference
      // du don sert de garde-fou chez Stripe.
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

/** Le chemin de la page de retour, tel que le navigateur l'a donne. */
function cheminDeRetour(chemin) {
  const propre = String(chemin ?? '').trim();
  // Un chemin du site, et rien d'autre : "//ailleurs.example" sortirait
  // du site, et une adresse complete meme.
  return /^\/[A-Za-z0-9\-/_]{0,120}$/.test(propre) && !propre.startsWith('//')
    ? propre
    : '/donateur/payer/carte/retour';
}

/**
 * Ou en est le paiement d'une session, pour la page de retour.
 *
 * Seul le compte qui a ouvert la session peut la lire ; et c'est Stripe
 * qui dit la verite, pas le navigateur.
 */
export async function etatSession(identite, sessionId) {
  const client = chezStripe();
  const id = String(sessionId ?? '').trim();
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) {
    throw new ErreurValidation('Session de paiement inconnue.', {
      session: 'Identifiant invalide',
    });
  }

  // Le compte qui a ouvert la session ; ou, sans compte, le jeton du don
  // (donInvite.service) qui dit lequel on peut lire.
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
  // Relu comme partout ailleurs : "Mes dons" et la page de retour
  // parlent du meme don, dans les memes mots.
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

/**
 * Le message signe que Stripe envoie au serveur.
 *
 * C'est la seule annonce a laquelle on peut se fier sans navigateur : le
 * donateur peut fermer sa page avant le retour, la banque peut repondre
 * une minute plus tard. La signature est verifiee : sans elle, n'importe
 * qui annoncerait des dons.
 */
export async function traiterEvenement(corpsBrut, signature) {
  const client = chezStripe();
  if (!config.stripe.secretWebhook) {
    throw new ErreurValidation('Le secret du webhook Stripe n’est pas configuré.');
  }

  let evenement;
  try {
    evenement = client.webhooks.constructEvent(corpsBrut, signature, config.stripe.secretWebhook);
  } catch {
    // Signature fausse ou corps modifie : on ne dit rien de plus.
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

/**
 * Met le don au diapason de ce que dit Stripe.
 *
 * Un paiement abouti passe le don a "recu" et previent l'equipe -- une
 * seule fois, meme si l'annonce arrive deux fois. Un paiement refuse ou
 * une session expiree laissent le don en attente : le donateur peut
 * reessayer, ou payer autrement.
 */
async function synchroniser(don, session) {
  const paiement = session.payment_intent;
  const paiementId = typeof paiement === 'string' ? paiement : (paiement?.id ?? null);

  if (session.payment_status !== 'paid') {
    return donationRepository.noterEtatFournisseur(don.id, {
      paiementId,
      statutFournisseur: session.payment_status ?? session.status ?? null,
    });
  }

  // Ce que Stripe a encaisse doit etre ce que le don porte : sinon, on
  // ne confirme rien et l'equipe tranche.
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

/** Ce que la banque a repondu, quand elle a refuse. */
function messageDuRefus(session) {
  const paiement = session.payment_intent;
  if (typeof paiement === 'string' || !paiement?.last_payment_error) return null;
  return paiement.last_payment_error.message ?? null;
}

/**
 * Une erreur de Stripe, dite au donateur sans jargon ni details
 * techniques -- ceux-ci restent dans le journal du serveur.
 */
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
