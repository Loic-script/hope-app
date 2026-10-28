import { AllocationType, DonationFrequency, DonationType, DonorType } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { readParam, validateBody } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rate-limit.js';
import {
  toAllocationDto,
  toDonationDto,
  toDonationSummaryDto,
  toDonorDto,
  toTransactionDto,
} from '../dto/mappers.js';
import type { Container } from '../../container.js';
import { CURRENCY_CODES } from '../../shared/currency.js';
import { isInternational } from '../../shared/geography.js';

/**
 * Ecritures liees au don.
 *
 * Ces controleurs ne contiennent aucune regle financiere : ils valident la
 * FORME des donnees recues, puis passent la main aux services. Le montant
 * affectable, la transition de statut autorisee ou la compatibilite d'un
 * moyen de paiement restent decides en profondeur.
 */

/** Un montant transite en chaine : "50000.00", jamais un flottant JavaScript. */
const amountSchema = z
  .string()
  .trim()
  .regex(/^\d{1,16}(\.\d{1,2})?$/, 'Montant invalide : utilisez un nombre positif, ex. "50000".');

const currencySchema = z.enum(CURRENCY_CODES as [string, ...string[]]);

const donorSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  email: z.email().max(180),
  phone: z.string().trim().min(4).max(40),
  donorType: z.enum(DonorType),
  country: z.string().trim().length(2),
  organizationName: z.string().trim().max(180).nullish(),
  city: z.string().trim().max(120).nullish(),
});

const createDonationSchema = z.object({
  donorId: z.uuid(),
  donationType: z.enum(DonationType),
  currency: currencySchema,
  expectedAmount: amountSchema,
  frequency: z.enum(DonationFrequency).nullish(),
  notes: z.string().trim().max(1000).nullish(),
});

const createTransactionSchema = z.object({
  paymentMethodCode: z.string().trim().min(2).max(60),
  amount: amountSchema.optional(),
  /**
   * Pilotage du simulateur de paiement pendant les demonstrations.
   * Un vrai prestataire ignorera ce champ.
   */
  simulate: z.enum(['SUCCESS', 'FAILURE']).optional(),
});

const createAllocationSchema = z.object({
  projectId: z.uuid(),
  amount: amountSchema,
  allocationType: z.enum(AllocationType).default(AllocationType.DONOR_DESIGNATED),
  notes: z.string().trim().max(500).nullish(),
});

/** Les ecritures publiques sont limitees en debit : voir rate-limit.ts. */
const writeLimiter = rateLimit({ windowMs: 60_000, max: 20 });

export function createDonationsRouter(container: Container): Router {
  const router = Router();
  const { services } = container;

  // --- Donateurs ---------------------------------------------------------

  router.post('/donors', writeLimiter, validateBody(donorSchema), async (req, res) => {
    const input = req.body as z.infer<typeof donorSchema>;

    // Un donateur fidele redonne avec le meme email : on le reconnait au lieu
    // de refuser son don pour cause de doublon.
    const existing = await services.donorService.findDonorByEmail(input.email);
    if (existing) {
      res.status(200).json({
        data: toDonorDto(existing, isInternational(existing.country)),
        meta: { created: false },
      });
      return;
    }

    const donor = await services.donorService.createDonor({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      donorType: input.donorType,
      country: input.country,
      preferredCurrency: 'MGA',
      organizationName: input.organizationName ?? null,
      city: input.city ?? null,
      preferredLanguage: 'fr',
      discoverySource: 'Site web HOPE',
    });

    res.status(201).json({
      data: toDonorDto(donor, isInternational(donor.country)),
      meta: { created: true },
    });
  });

  // --- Dons ---------------------------------------------------------------

  router.post('/donations', writeLimiter, validateBody(createDonationSchema), async (req, res) => {
    const input = req.body as z.infer<typeof createDonationSchema>;

    const donation = await services.donationService.createDonation({
      donorId: input.donorId,
      donationType: input.donationType,
      currency: input.currency,
      expectedAmount: input.expectedAmount,
      frequency: input.frequency ?? null,
      status: 'ACTIVE',
      notes: input.notes ?? null,
      ...(input.donationType === DonationType.RECURRING ? { startDate: new Date() } : {}),
    });

    res.status(201).json({ data: toDonationDto(donation) });
  });

  /**
   * Etat complet d'un don : l'engagement, ses echeances, sa repartition.
   *
   * C'est ici que se lit la distinction DON / TRANSACTION : un don mensuel
   * renvoie UN objet `donation` et N objets `transactions`.
   */
  router.get('/donations/:id', async (req, res) => {
    const donationId = z.uuid().parse(readParam(req.params, 'id'));

    const [donation, summary, transactions, allocations] = await Promise.all([
      services.donationService.getDonationById(donationId),
      services.donationService.getFinancialSummary(donationId),
      services.paymentService.getTransactionsForDonation(donationId),
      services.allocationService.getAllocationsForDonation(donationId),
    ]);

    res.json({
      data: {
        donation: toDonationDto(donation),
        summary: toDonationSummaryDto(summary),
        transactions: transactions.map(toTransactionDto),
        allocations: allocations.map(toAllocationDto),
      },
    });
  });

  router.get('/donations/:id/transactions', async (req, res) => {
    const donationId = z.uuid().parse(readParam(req.params, 'id'));
    // Verifie l'existence du don avant de renvoyer une liste vide trompeuse.
    await services.donationService.getDonationById(donationId);

    const transactions = await services.paymentService.getTransactionsForDonation(donationId);
    res.json({ data: transactions.map(toTransactionDto) });
  });

  /**
   * Nouvelle echeance sur un don existant.
   *
   * Sert notamment aux dons mensuels : le don reste unique, chaque appel
   * ajoute une transaction.
   */
  router.post(
    '/donations/:id/transactions',
    writeLimiter,
    validateBody(createTransactionSchema),
    async (req, res) => {
      const donationId = z.uuid().parse(readParam(req.params, 'id'));
      const input = req.body as z.infer<typeof createTransactionSchema>;

      const transaction = await services.paymentService.createTransaction({
        donationId,
        paymentMethodCode: input.paymentMethodCode,
        ...(input.amount ? { amount: input.amount } : {}),
        metadata: buildSimulationMetadata(input.simulate),
      });

      res.status(201).json({ data: toTransactionDto(transaction) });
    },
  );

  router.post(
    '/donations/:id/allocations',
    writeLimiter,
    validateBody(createAllocationSchema),
    async (req, res) => {
      const donationId = z.uuid().parse(readParam(req.params, 'id'));
      const input = req.body as z.infer<typeof createAllocationSchema>;

      const allocation = await services.allocationService.allocate({
        donationId,
        projectId: input.projectId,
        amount: input.amount,
        allocationType: input.allocationType,
        notes: input.notes ?? null,
      });

      res.status(201).json({ data: toAllocationDto(allocation) });
    },
  );

  return router;
}

/**
 * Traduit une consigne de demonstration en metadonnees pour le simulateur.
 *
 * `FAILURE` cible volontairement l'ENCAISSEMENT et non l'initialisation : le
 * parcours reste ainsi realiste, avec une transaction bien creee puis refusee
 * au moment du debit, comme le ferait une provision insuffisante.
 */
export function buildSimulationMetadata(
  simulate: 'SUCCESS' | 'FAILURE' | undefined,
): Record<string, unknown> | null {
  if (simulate !== 'FAILURE') return null;
  return {
    mock: {
      confirm: {
        outcome: 'FAILURE',
        failureReason: 'Solde insuffisant sur le compte du donateur.',
      },
    },
  };
}
