import { DonationFrequency, DonationStatus, DonationType, TransactionStatus } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { getTestServices, createTestDonation, createTestDonor } from '../helpers/factories.js';
import { useTestDatabase } from '../helpers/database.js';
import type { Services } from '../../container.js';
import {
  BusinessRuleError,
  InvalidStatusTransitionError,
  NotFoundError,
  PaymentProviderError,
  ValidationError,
} from '../../shared/errors.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../modules/audit/audit.types.js';

/**
 * MODULE PRIORITAIRE : tests du cycle de vie des paiements.
 */
describe('PaymentService', () => {
  useTestDatabase();

  let services: Services;

  beforeEach(() => {
    services = getTestServices();
  });

  // -------------------------------------------------------------------------
  describe('creation d’une transaction', () => {
    it('cree une transaction PENDING avec une reference interne lisible', async () => {
      const donation = await createTestDonation({ amount: '100000' });

      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });

      expect(transaction.status).toBe(TransactionStatus.PENDING);
      expect(transaction.amount.toString()).toBe('100000');
      expect(transaction.currency).toBe('MGA');
      expect(transaction.internalReference).toMatch(/^HOPE-TXN-\d{8}-[A-Z2-9]{6}$/);
      expect(transaction.providerReference).toMatch(/^MOCK-MVOLA-/);
      expect(transaction.transactionDate).toBeNull();
    });

    it('reprend par defaut le montant attendu du don', async () => {
      const donation = await createTestDonation({ amount: '75000' });
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });

      expect(transaction.amount.toString()).toBe('75000');
    });

    it('accepte un montant explicite different du montant attendu', async () => {
      const donation = await createTestDonation({ amount: '100000' });
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
        amount: '30000',
      });

      expect(transaction.amount.toString()).toBe('30000');
    });

    it('refuse un montant nul ou negatif', async () => {
      const donation = await createTestDonation();

      await expect(
        services.paymentService.createTransaction({
          donationId: donation.id,
          paymentMethodCode: 'MVOLA',
          amount: '0',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('refuse un don inexistant', async () => {
      await expect(
        services.paymentService.createTransaction({
          donationId: '00000000-0000-4000-8000-000000000000',
          paymentMethodCode: 'MVOLA',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('refuse une methode de paiement desactivee', async () => {
      const donation = await createTestDonation();

      await expect(
        services.paymentService.createTransaction({
          donationId: donation.id,
          paymentMethodCode: 'DISABLED_METHOD',
        }),
      ).rejects.toThrow(BusinessRuleError);
    });

    it('refuse une methode qui n’accepte pas la devise du don', async () => {
      const donation = await createTestDonation({ currency: 'MGA' });

      // CARD n'accepte que EUR et USD.
      await expect(
        services.paymentService.createTransaction({
          donationId: donation.id,
          paymentMethodCode: 'CARD',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('refuse une methode LOCAL pour un donateur etranger', async () => {
      const donor = await createTestDonor({ country: 'FR', preferredCurrency: 'EUR' });
      const donation = await createTestDonation({ donorId: donor.id, currency: 'EUR' });

      await expect(
        services.paymentService.createTransaction({
          donationId: donation.id,
          paymentMethodCode: 'MVOLA',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('accepte une methode INTERNATIONAL pour un donateur etranger', async () => {
      const donor = await createTestDonor({ country: 'FR', preferredCurrency: 'EUR' });
      const donation = await createTestDonation({ donorId: donor.id, currency: 'EUR' });

      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'CARD',
      });

      expect(transaction.status).toBe(TransactionStatus.PENDING);
    });

    it('refuse une methode dont le fournisseur n’est pas enregistre', async () => {
      const donation = await createTestDonation();

      await expect(
        services.paymentService.createTransaction({
          donationId: donation.id,
          paymentMethodCode: 'UNKNOWN_PROVIDER',
        }),
      ).rejects.toThrow(PaymentProviderError);
    });

    it('refuse de creer une transaction sur un don annule', async () => {
      const donation = await createTestDonation();
      await services.donationService.cancelDonation(donation.id);

      await expect(
        services.paymentService.createTransaction({
          donationId: donation.id,
          paymentMethodCode: 'MVOLA',
        }),
      ).rejects.toThrow(BusinessRuleError);
    });

    it('journalise la creation dans l’audit', async () => {
      const donation = await createTestDonation();
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });

      const history = await services.auditService.getEntityHistory(
        AUDIT_ENTITIES.TRANSACTION,
        transaction.id,
      );
      expect(history.map((entry) => entry.action)).toContain(AUDIT_ACTIONS.TRANSACTION_CREATED);
    });
  });

  // -------------------------------------------------------------------------
  describe('confirmation', () => {
    it('passe la transaction en SUCCESS et date le mouvement', async () => {
      const donation = await createTestDonation({ amount: '100000' });
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });

      const confirmed = await services.paymentService.confirmTransaction(transaction.id);

      expect(confirmed.status).toBe(TransactionStatus.SUCCESS);
      expect(confirmed.transactionDate).toBeInstanceOf(Date);
      expect(confirmed.failureReason).toBeNull();
    });

    it('rend l’argent disponible pour le don', async () => {
      const donation = await createTestDonation({ amount: '100000' });
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });

      const before = await services.paymentService.getTotalPaidForDonation(donation.id);
      expect(before.toString()).toBe('0');

      await services.paymentService.confirmTransaction(transaction.id);

      const after = await services.paymentService.getTotalPaidForDonation(donation.id);
      expect(after.toString()).toBe('100000');
    });

    it('accepte une date de mouvement explicite', async () => {
      const donation = await createTestDonation();
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });

      const date = new Date(Date.UTC(2026, 0, 15, 10, 30));
      const confirmed = await services.paymentService.confirmTransaction(transaction.id, {
        transactionDate: date,
      });

      expect(confirmed.transactionDate?.toISOString()).toBe(date.toISOString());
    });

    it('marque la transaction FAILED si le prestataire refuse l’encaissement', async () => {
      const donation = await createTestDonation();

      // La cle mock.confirm cible l'encaissement : l'initialisation reussit,
      // mais la confirmation est refusee. C'est le cas reel d'une provision
      // insuffisante constatee au moment du debit.
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
        metadata: { mock: { confirm: { outcome: 'FAILURE', failureReason: 'Solde insuffisant.' } } },
      });
      expect(transaction.status).toBe(TransactionStatus.PENDING);

      await expect(services.paymentService.confirmTransaction(transaction.id)).rejects.toThrow(
        BusinessRuleError,
      );

      const failed = await services.paymentService.getTransactionById(transaction.id);
      expect(failed.status).toBe(TransactionStatus.FAILED);
      expect(failed.failureReason).toBe('Solde insuffisant.');
    });

    it('echoue des la creation si le prestataire refuse l’initialisation', async () => {
      const donation = await createTestDonation();

      // Refus immediat : numero de telephone invalide, carte expiree...
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
        metadata: { mock: { outcome: 'FAILURE', failureReason: 'Numero MVola inconnu.' } },
      });

      expect(transaction.status).toBe(TransactionStatus.FAILED);
      expect(transaction.failureReason).toBe('Numero MVola inconnu.');

      // Une transaction FAILED est finale : impossible de la confirmer ensuite.
      await expect(services.paymentService.confirmTransaction(transaction.id)).rejects.toThrow(
        InvalidStatusTransitionError,
      );
    });

    it('ne confirme pas une transaction laissee en attente par le prestataire', async () => {
      const donation = await createTestDonation();
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
        metadata: { mock: { confirm: { outcome: 'PENDING' } } },
      });

      await expect(services.paymentService.confirmTransaction(transaction.id)).rejects.toThrow(
        BusinessRuleError,
      );

      const untouched = await services.paymentService.getTransactionById(transaction.id);
      expect(untouched.status).toBe(TransactionStatus.PENDING);
    });

    it('refuse de confirmer deux fois la meme transaction', async () => {
      const donation = await createTestDonation();
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });
      await services.paymentService.confirmTransaction(transaction.id);

      await expect(services.paymentService.confirmTransaction(transaction.id)).rejects.toThrow(
        InvalidStatusTransitionError,
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('echec et annulation', () => {
    it('marque une transaction comme echouee avec un motif', async () => {
      const donation = await createTestDonation();
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });

      const failed = await services.paymentService.failTransaction(transaction.id, {
        reason: 'Numero MVola invalide.',
      });

      expect(failed.status).toBe(TransactionStatus.FAILED);
      expect(failed.failureReason).toBe('Numero MVola invalide.');
    });

    it('exclut une transaction echouee du montant recu', async () => {
      const donation = await createTestDonation({ amount: '100000' });
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });
      await services.paymentService.failTransaction(transaction.id, { reason: 'Echec.' });

      const total = await services.paymentService.getTotalPaidForDonation(donation.id);
      expect(total.toString()).toBe('0');
    });

    it('INTERDIT de faire passer une transaction FAILED en SUCCESS', async () => {
      const donation = await createTestDonation();
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });
      await services.paymentService.failTransaction(transaction.id, { reason: 'Echec.' });

      await expect(services.paymentService.confirmTransaction(transaction.id)).rejects.toThrow(
        InvalidStatusTransitionError,
      );
    });

    it('annule une transaction encore en attente', async () => {
      const donation = await createTestDonation();
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });

      const cancelled = await services.paymentService.cancelTransaction(transaction.id, {
        reason: 'Le donateur s’est retracte.',
      });

      expect(cancelled.status).toBe(TransactionStatus.CANCELLED);
    });

    it('INTERDIT d’annuler une transaction deja encaissee', async () => {
      const donation = await createTestDonation();
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });
      await services.paymentService.confirmTransaction(transaction.id);

      await expect(services.paymentService.cancelTransaction(transaction.id)).rejects.toThrow(
        InvalidStatusTransitionError,
      );
    });

    it('exclut une transaction annulee du montant recu', async () => {
      const donation = await createTestDonation({ amount: '100000' });
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });
      await services.paymentService.cancelTransaction(transaction.id);

      const total = await services.paymentService.getTotalPaidForDonation(donation.id);
      expect(total.toString()).toBe('0');
    });
  });

  // -------------------------------------------------------------------------
  describe('remboursement', () => {
    it('rembourse la totalite et passe la transaction en REFUNDED', async () => {
      const donation = await createTestDonation({ amount: '100000' });
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });
      await services.paymentService.confirmTransaction(transaction.id);

      const refunded = await services.paymentService.refundTransaction(transaction.id, {
        reason: 'Demande du donateur.',
      });

      expect(refunded.status).toBe(TransactionStatus.REFUNDED);
      expect(refunded.refundedAmount.toString()).toBe('100000');
      expect(refunded.refundedAt).toBeInstanceOf(Date);
      expect(refunded.refundReason).toBe('Demande du donateur.');

      const total = await services.paymentService.getTotalPaidForDonation(donation.id);
      expect(total.toString()).toBe('0');
    });

    it('conserve la ligne en base : un remboursement reste tracable', async () => {
      const donation = await createTestDonation({ amount: '100000' });
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });
      await services.paymentService.confirmTransaction(transaction.id);
      await services.paymentService.refundTransaction(transaction.id, { reason: 'Erreur.' });

      // La transaction n'est PAS supprimee (regle n.8).
      const stillThere = await services.paymentService.getTransactionById(transaction.id);
      expect(stillThere.id).toBe(transaction.id);

      const history = await services.auditService.getEntityHistory(
        AUDIT_ENTITIES.TRANSACTION,
        transaction.id,
      );
      expect(history.map((entry) => entry.action)).toContain(AUDIT_ACTIONS.TRANSACTION_REFUNDED);
    });

    it('gere un remboursement partiel en gardant le statut SUCCESS', async () => {
      const donation = await createTestDonation({ amount: '100000' });
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });
      await services.paymentService.confirmTransaction(transaction.id);

      const refunded = await services.paymentService.refundTransaction(transaction.id, {
        amount: '30000',
        reason: 'Trop-percu.',
      });

      expect(refunded.status).toBe(TransactionStatus.SUCCESS);
      expect(refunded.refundedAmount.toString()).toBe('30000');

      const total = await services.paymentService.getTotalPaidForDonation(donation.id);
      expect(total.toString()).toBe('70000');
    });

    it('cumule plusieurs remboursements partiels jusqu’au remboursement total', async () => {
      const donation = await createTestDonation({ amount: '100000' });
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });
      await services.paymentService.confirmTransaction(transaction.id);

      await services.paymentService.refundTransaction(transaction.id, {
        amount: '40000',
        reason: 'Premier remboursement.',
      });
      const second = await services.paymentService.refundTransaction(transaction.id, {
        amount: '60000',
        reason: 'Solde du remboursement.',
      });

      expect(second.status).toBe(TransactionStatus.REFUNDED);
      expect(second.refundedAmount.toString()).toBe('100000');
    });

    it('refuse un remboursement superieur au montant restant', async () => {
      const donation = await createTestDonation({ amount: '100000' });
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });
      await services.paymentService.confirmTransaction(transaction.id);

      await expect(
        services.paymentService.refundTransaction(transaction.id, {
          amount: '150000',
          reason: 'Montant excessif.',
        }),
      ).rejects.toThrow(BusinessRuleError);
    });

    it('refuse de rembourser une transaction non encaissee', async () => {
      const donation = await createTestDonation();
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });

      await expect(
        services.paymentService.refundTransaction(transaction.id, { reason: 'Test.' }),
      ).rejects.toThrow(BusinessRuleError);
    });

    it('exige un motif de remboursement', async () => {
      const donation = await createTestDonation();
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });
      await services.paymentService.confirmTransaction(transaction.id);

      await expect(
        services.paymentService.refundTransaction(transaction.id, { reason: '  ' }),
      ).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  describe('un DON, plusieurs TRANSACTIONS', () => {
    it('rattache douze echeances au meme don mensuel', async () => {
      const donation = await createTestDonation({
        amount: '50000',
        donationType: DonationType.RECURRING,
        frequency: DonationFrequency.MONTHLY,
        startDate: new Date(Date.UTC(2026, 0, 15)),
        endDate: new Date(Date.UTC(2026, 11, 15)),
        status: DonationStatus.ACTIVE,
      });

      for (let month = 1; month <= 12; month += 1) {
        const transaction = await services.paymentService.createTransaction({
          donationId: donation.id,
          paymentMethodCode: 'MVOLA',
        });
        await services.paymentService.confirmTransaction(transaction.id);
      }

      const transactions = await services.paymentService.getTransactionsForDonation(donation.id);
      expect(transactions).toHaveLength(12);

      // UN SEUL don en base.
      const donations = await services.donationService.listDonations({ donorId: donation.donorId });
      expect(donations).toHaveLength(1);

      const total = await services.paymentService.getTotalPaidForDonation(donation.id);
      expect(total.toString()).toBe('600000');
    });

    it('numerote automatiquement les echeances d’un don recurrent', async () => {
      const donation = await createTestDonation({
        amount: '50000',
        donationType: DonationType.RECURRING,
        frequency: DonationFrequency.MONTHLY,
        startDate: new Date(Date.UTC(2026, 0, 15)),
        endDate: new Date(Date.UTC(2026, 2, 15)),
      });

      const first = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });
      const second = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });

      expect(first.installmentNumber).toBe(1);
      expect(second.installmentNumber).toBe(2);
    });

    it('ne compte que les echeances reussies dans le montant recu', async () => {
      const donation = await createTestDonation({
        amount: '50000',
        donationType: DonationType.RECURRING,
        frequency: DonationFrequency.MONTHLY,
        startDate: new Date(Date.UTC(2026, 0, 15)),
        endDate: new Date(Date.UTC(2026, 3, 15)),
      });

      // Echeance 1 : reussie.
      const first = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });
      await services.paymentService.confirmTransaction(first.id);

      // Echeance 2 : echouee.
      const second = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });
      await services.paymentService.failTransaction(second.id, { reason: 'Solde insuffisant.' });

      // Echeance 3 : toujours en attente.
      await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });

      const totals = await services.paymentService.getDonationTotals(donation.id);

      expect(totals.totalReceived.toString()).toBe('50000');
      expect(totals.totalFailed.toString()).toBe('50000');
      expect(totals.totalPending.toString()).toBe('50000');
      expect(totals.transactionCount).toBe(3);
      expect(totals.successfulTransactionCount).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('lectures', () => {
    it('retrouve une transaction par sa reference interne', async () => {
      const donation = await createTestDonation();
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });

      const found = await services.paymentService.getTransactionByReference(
        transaction.internalReference,
      );
      expect(found.id).toBe(transaction.id);
    });

    it('interroge le prestataire sans modifier la transaction', async () => {
      const donation = await createTestDonation();
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });

      const status = await services.paymentService.getProviderStatus(transaction.id);
      expect(status.status).toBe('SUCCEEDED');

      const unchanged = await services.paymentService.getTransactionById(transaction.id);
      expect(unchanged.status).toBe(TransactionStatus.PENDING);
    });

    it('ne propose que les methodes compatibles avec le pays du donateur', async () => {
      const local = await services.paymentService.listPaymentMethodsForCountry('MG');
      expect(local.map((method) => method.code)).toContain('MVOLA');
      expect(local.map((method) => method.code)).not.toContain('CARD');

      const international = await services.paymentService.listPaymentMethodsForCountry('FR');
      expect(international.map((method) => method.code)).toContain('CARD');
      expect(international.map((method) => method.code)).not.toContain('MVOLA');
    });
  });
});
