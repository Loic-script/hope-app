import { TransactionStatus } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from '../middleware/rate-limit.js';
import { readParam } from '../middleware/validate.js';
import { toDonationDto, toTransactionDto } from '../dto/mappers.js';
import { toOutcome } from '../../modules/checkout/checkout.service.js';
import type { Container } from '../../container.js';
import { BusinessRuleError } from '../../shared/errors.js';

/**
 * Suivi et traitement d'une transaction.
 *
 * POINT CENTRAL : le navigateur ne decide JAMAIS qu'un paiement a reussi.
 * Il demande au backend de traiter la transaction, et lit le statut renvoye.
 */

const writeLimiter = rateLimit({ windowMs: 60_000, max: 20 });

export function createTransactionsRouter(container: Container): Router {
  const router = Router();
  const { services } = container;

  /**
   * Consultation par identifiant OU par reference HOPE-TXN-...
   *
   * La page de confirmation utilise la reference : c'est ce que le donateur a
   * sous les yeux, et ce qu'il citera en cas de question.
   */
  router.get('/:id', async (req, res) => {
    const transaction = await findTransaction(services, readParam(req.params, 'id'));
    const donation = await services.donationService.getDonationById(transaction.donationId);

    res.json({
      data: {
        transaction: toTransactionDto(transaction),
        donation: toDonationDto(donation),
        outcome: toOutcome(transaction.status),
      },
    });
  });

  /**
   * Demande l'encaissement au prestataire.
   *
   * Un refus du prestataire n'est pas une panne : c'est une issue normale du
   * parcours. On repond donc 200 avec `outcome: "FAILED"` et le motif, plutot
   * qu'une erreur 5xx qui ferait croire a un incident technique. Le statut a
   * bien ete ecrit en base par PaymentService avant de nous parvenir.
   */
  router.post('/:id/process', writeLimiter, async (req, res) => {
    const current = await findTransaction(services, readParam(req.params, 'id'));

    try {
      const confirmed = await services.paymentService.confirmTransaction(current.id);
      res.json({
        data: { transaction: toTransactionDto(confirmed), outcome: toOutcome(confirmed.status) },
      });
    } catch (error) {
      if (!(error instanceof BusinessRuleError)) throw error;

      const failed = await services.paymentService.getTransactionById(current.id);
      res.json({
        data: {
          transaction: toTransactionDto(failed),
          outcome: toOutcome(failed.status),
          failureReason: failed.failureReason,
        },
      });
    }
  });

  /** Etat cote prestataire, sans rien modifier en base. */
  router.get('/:id/provider-status', async (req, res) => {
    const transaction = await findTransaction(services, readParam(req.params, 'id'));
    const status = await services.paymentService.getProviderStatus(transaction.id);

    res.json({
      data: {
        providerStatus: status.status,
        localStatus: transaction.status,
        isFinal: isFinalStatus(transaction.status),
      },
    });
  });

  return router;
}

async function findTransaction(services: Container['services'], identifier: string) {
  const value = identifier;
  const isUuid = z.uuid().safeParse(value).success;

  return isUuid
    ? services.paymentService.getTransactionById(value)
    : services.paymentService.getTransactionByReference(value.toUpperCase());
}

/** Statuts au-dela desquels plus rien ne bougera : inutile de continuer a interroger. */
function isFinalStatus(status: TransactionStatus): boolean {
  return (
    status === TransactionStatus.SUCCESS ||
    status === TransactionStatus.FAILED ||
    status === TransactionStatus.CANCELLED ||
    status === TransactionStatus.REFUNDED
  );
}
