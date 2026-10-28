import { DonationFrequency, DonationType, DonorType } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rate-limit.js';
import {
  toAllocationDto,
  toDonationDto,
  toDonationSummaryDto,
  toDonorDto,
  toTransactionDto,
} from '../dto/mappers.js';
import { buildSimulationMetadata } from './donations.routes.js';
import { CheckoutService } from '../../modules/checkout/checkout.service.js';
import { CURRENCY_CODES } from '../../shared/currency.js';
import { isInternational } from '../../shared/geography.js';

/**
 * PARCOURS DE DON COMPLET, EN UNE SEULE REQUETE.
 *
 * Le formulaire du site recueille tout, puis envoie l'ensemble ici. Le serveur
 * enchaine alors : donateur, don, transaction, prestataire, affectation.
 *
 * Pourquoi pas cinq requetes depuis le navigateur ? Parce qu'un parcours qui
 * s'interrompt au milieu laisserait un donateur sans savoir si son argent est
 * parti. L'enchainement appartient au serveur ; le navigateur, lui, envoie une
 * intention et recoit un resultat.
 *
 * Toute la logique vit dans CheckoutService : ce controleur ne fait que
 * valider la forme des donnees et traduire le resultat en JSON.
 */

const amountSchema = z
  .string()
  .trim()
  .regex(/^\d{1,16}(\.\d{1,2})?$/, 'Montant invalide : utilisez un nombre positif, ex. "50000".');

const checkoutSchema = z.object({
  donor: z.object({
    firstName: z.string().trim().min(1, 'Le prenom est obligatoire.').max(120),
    lastName: z.string().trim().min(1, 'Le nom est obligatoire.').max(120),
    email: z.email('Adresse email invalide.').max(180),
    phone: z.string().trim().min(4, 'Numero de telephone trop court.').max(40),
    donorType: z.enum(DonorType),
    country: z.string().trim().length(2, 'Utilisez un code pays sur 2 lettres (MG, FR...).'),
    organizationName: z.string().trim().max(180).nullish(),
    city: z.string().trim().max(120).nullish(),
  }),
  donation: z.object({
    donationType: z.enum(DonationType),
    currency: z.enum(CURRENCY_CODES as [string, ...string[]]),
    amount: amountSchema,
    frequency: z.enum(DonationFrequency).nullish(),
    notes: z.string().trim().max(1000).nullish(),
  }),
  paymentMethodCode: z.string().trim().min(2).max(60),
  /** Nul ou absent = don non affecte : HOPE decidera de la repartition. */
  projectId: z.uuid().nullish(),
  /** Consigne de demonstration transmise au simulateur de paiement. */
  simulate: z.enum(['SUCCESS', 'FAILURE']).optional(),
});

export type CheckoutRequestBody = z.infer<typeof checkoutSchema>;

/**
 * Limite plus stricte que les autres ecritures : ce point d'entree cree un
 * donateur, un don et une transaction a chaque appel.
 */
const checkoutLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: 'Trop de tentatives de don. Patientez une minute avant de reessayer.',
});

export function createCheckoutRouter(): Router {
  const router = Router();
  const checkoutService = new CheckoutService();

  router.post('/', checkoutLimiter, validateBody(checkoutSchema), async (req, res) => {
    const input = req.body as CheckoutRequestBody;

    const result = await checkoutService.processDonation({
      donor: {
        firstName: input.donor.firstName,
        lastName: input.donor.lastName,
        email: input.donor.email,
        phone: input.donor.phone,
        donorType: input.donor.donorType,
        country: input.donor.country,
        organizationName: input.donor.organizationName ?? null,
        city: input.donor.city ?? null,
      },
      donation: {
        donationType: input.donation.donationType,
        currency: input.donation.currency,
        amount: input.donation.amount,
        frequency: input.donation.frequency ?? null,
        notes: input.donation.notes ?? null,
      },
      paymentMethodCode: input.paymentMethodCode,
      projectId: input.projectId ?? null,
      metadata: buildSimulationMetadata(input.simulate),
    });

    // 201 meme lorsque le paiement echoue : les entites ONT ete creees, et
    // l'echec du paiement est une information metier, pas une erreur HTTP.
    res.status(201).json({
      data: {
        outcome: result.outcome,
        failureReason: result.failureReason,
        donor: toDonorDto(result.donor, isInternational(result.donor.country)),
        donation: toDonationDto(result.donation),
        transaction: toTransactionDto(result.transaction),
        allocation: result.allocation ? toAllocationDto(result.allocation) : null,
        summary: toDonationSummaryDto(result.summary),
      },
    });
  });

  return router;
}
