import { DonationFrequency, DonationStatus, DonationType } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/database.js';
import {
  createConfirmedTransaction,
  createTestDonation,
  createTestDonor,
  getTestServices,
} from '../helpers/factories.js';
import type { Services } from '../../container.js';
import {
  BusinessRuleError,
  InvalidStatusTransitionError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.js';

describe('DonationService', () => {
  useTestDatabase();

  let services: Services;

  beforeEach(() => {
    services = getTestServices();
  });

  // -------------------------------------------------------------------------
  describe('creation', () => {
    it('cree un don ponctuel avec une reference lisible', async () => {
      const donor = await createTestDonor();

      const donation = await services.donationService.createDonation({
        donorId: donor.id,
        donationType: DonationType.ONE_TIME,
        currency: 'MGA',
        expectedAmount: '100000',
      });

      expect(donation.reference).toMatch(/^HOPE-DON-\d{8}-[A-Z2-9]{6}$/);
      expect(donation.status).toBe(DonationStatus.DRAFT);
      expect(donation.expectedAmount.toString()).toBe('100000');
      expect(donation.frequency).toBeNull();
    });

    it('cree un don mensuel avec sa premiere echeance', async () => {
      const donor = await createTestDonor();
      const startDate = new Date(Date.UTC(2026, 0, 15));

      const donation = await services.donationService.createDonation({
        donorId: donor.id,
        donationType: DonationType.RECURRING,
        frequency: DonationFrequency.MONTHLY,
        currency: 'MGA',
        expectedAmount: '50000',
        startDate,
        endDate: new Date(Date.UTC(2026, 11, 15)),
      });

      expect(donation.donationType).toBe(DonationType.RECURRING);
      expect(donation.frequency).toBe(DonationFrequency.MONTHLY);
      expect(donation.nextPaymentDate?.toISOString().slice(0, 10)).toBe('2026-01-15');
    });

    it('refuse un don recurrent sans frequence', async () => {
      const donor = await createTestDonor();

      await expect(
        services.donationService.createDonation({
          donorId: donor.id,
          donationType: DonationType.RECURRING,
          currency: 'MGA',
          expectedAmount: '50000',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('refuse un montant nul ou negatif', async () => {
      const donor = await createTestDonor();

      await expect(
        services.donationService.createDonation({
          donorId: donor.id,
          donationType: DonationType.ONE_TIME,
          currency: 'MGA',
          expectedAmount: '0',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('refuse une devise non supportee', async () => {
      const donor = await createTestDonor();

      await expect(
        services.donationService.createDonation({
          donorId: donor.id,
          donationType: DonationType.ONE_TIME,
          currency: 'XXX',
          expectedAmount: '1000',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('refuse une periode incoherente (fin avant debut)', async () => {
      const donor = await createTestDonor();

      await expect(
        services.donationService.createDonation({
          donorId: donor.id,
          donationType: DonationType.RECURRING,
          frequency: DonationFrequency.MONTHLY,
          currency: 'MGA',
          expectedAmount: '50000',
          startDate: new Date(Date.UTC(2026, 5, 1)),
          endDate: new Date(Date.UTC(2026, 0, 1)),
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('refuse un donateur inexistant', async () => {
      await expect(
        services.donationService.createDonation({
          donorId: '00000000-0000-4000-8000-000000000000',
          donationType: DonationType.ONE_TIME,
          currency: 'MGA',
          expectedAmount: '1000',
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // -------------------------------------------------------------------------
  describe('cycle de vie', () => {
    it('active puis cloture un don', async () => {
      const donation = await createTestDonation({ status: DonationStatus.DRAFT });

      const active = await services.donationService.activateDonation(donation.id);
      expect(active.status).toBe(DonationStatus.ACTIVE);

      const completed = await services.donationService.completeDonation(donation.id);
      expect(completed.status).toBe(DonationStatus.COMPLETED);
    });

    it('refuse de reactiver un don annule', async () => {
      const donation = await createTestDonation({ status: DonationStatus.DRAFT });
      await services.donationService.cancelDonation(donation.id);

      await expect(services.donationService.activateDonation(donation.id)).rejects.toThrow(
        InvalidStatusTransitionError,
      );
    });

    it('refuse de modifier un don cloture', async () => {
      const donation = await createTestDonation({ status: DonationStatus.ACTIVE });
      await services.donationService.completeDonation(donation.id);

      await expect(
        services.donationService.updateDonation(donation.id, { expectedAmount: '200000' }),
      ).rejects.toThrow(BusinessRuleError);
    });

    it('fait avancer l’echeance d’un don mensuel', async () => {
      const donation = await createTestDonation({
        donationType: DonationType.RECURRING,
        frequency: DonationFrequency.MONTHLY,
        startDate: new Date(Date.UTC(2026, 0, 15)),
        endDate: new Date(Date.UTC(2026, 11, 15)),
        status: DonationStatus.ACTIVE,
      });

      const advanced = await services.donationService.advanceNextPaymentDate(donation.id);
      expect(advanced.nextPaymentDate?.toISOString().slice(0, 10)).toBe('2026-02-15');
    });

    it('cloture le don quand la derniere echeance est passee', async () => {
      const donation = await createTestDonation({
        donationType: DonationType.RECURRING,
        frequency: DonationFrequency.MONTHLY,
        startDate: new Date(Date.UTC(2026, 0, 15)),
        endDate: new Date(Date.UTC(2026, 1, 15)),
        status: DonationStatus.ACTIVE,
      });

      await services.donationService.advanceNextPaymentDate(donation.id); // -> 15 fevrier
      const completed = await services.donationService.advanceNextPaymentDate(donation.id);

      expect(completed.status).toBe(DonationStatus.COMPLETED);
      expect(completed.nextPaymentDate).toBeNull();
    });

    it('refuse de faire avancer l’echeance d’un don ponctuel', async () => {
      const donation = await createTestDonation({ donationType: DonationType.ONE_TIME });

      await expect(services.donationService.advanceNextPaymentDate(donation.id)).rejects.toThrow(
        BusinessRuleError,
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('vue financiere : DON n’est pas TRANSACTION', () => {
    it('affiche un montant recu nul tant qu’aucune transaction n’est confirmee', async () => {
      const donation = await createTestDonation({ amount: '100000' });

      const summary = await services.donationService.getFinancialSummary(donation.id);

      expect(summary.expectedAmountPerInstallment.toString()).toBe('100000');
      expect(summary.totalReceived.toString()).toBe('0');
      expect(summary.availableForAllocation.toString()).toBe('0');
      expect(summary.remainingCommitment?.toString()).toBe('100000');
      expect(summary.isFullyFunded).toBe(false);
    });

    it('calcule l’engagement total d’un don mensuel', async () => {
      const donation = await createTestDonation({
        amount: '50000',
        donationType: DonationType.RECURRING,
        frequency: DonationFrequency.MONTHLY,
        startDate: new Date(Date.UTC(2026, 0, 15)),
        endDate: new Date(Date.UTC(2026, 11, 15)),
      });

      const summary = await services.donationService.getFinancialSummary(donation.id);

      expect(summary.expectedInstallments).toBe(12);
      expect(summary.totalCommitted?.toString()).toBe('600000');
      expect(summary.remainingCommitment?.toString()).toBe('600000');
    });

    it('laisse l’engagement indetermine pour un don recurrent sans fin', async () => {
      const donation = await createTestDonation({
        amount: '50000',
        donationType: DonationType.RECURRING,
        frequency: DonationFrequency.MONTHLY,
        startDate: new Date(Date.UTC(2026, 0, 15)),
        endDate: null,
      });

      const summary = await services.donationService.getFinancialSummary(donation.id);

      expect(summary.expectedInstallments).toBeNull();
      expect(summary.totalCommitted).toBeNull();
      expect(summary.remainingCommitment).toBeNull();
      expect(summary.isFullyFunded).toBe(false);
    });

    it('met a jour le reste a payer au fil des encaissements', async () => {
      const donation = await createTestDonation({
        amount: '50000',
        donationType: DonationType.RECURRING,
        frequency: DonationFrequency.MONTHLY,
        startDate: new Date(Date.UTC(2026, 0, 15)),
        endDate: new Date(Date.UTC(2026, 2, 15)),
        status: DonationStatus.ACTIVE,
      });

      await createConfirmedTransaction({ donationId: donation.id });
      await createConfirmedTransaction({ donationId: donation.id });

      const summary = await services.donationService.getFinancialSummary(donation.id);

      expect(summary.expectedInstallments).toBe(3);
      expect(summary.totalCommitted?.toString()).toBe('150000');
      expect(summary.totalReceived.toString()).toBe('100000');
      expect(summary.remainingCommitment?.toString()).toBe('50000');
      expect(summary.successfulTransactionCount).toBe(2);
    });

    it('signale un engagement integralement honore', async () => {
      const donation = await createTestDonation({ amount: '100000' });
      await createConfirmedTransaction({ donationId: donation.id });

      const summary = await services.donationService.getFinancialSummary(donation.id);

      expect(summary.remainingCommitment?.toString()).toBe('0');
      expect(summary.isFullyFunded).toBe(true);
    });

    it('ne descend jamais sous zero, meme en cas de sur-paiement', async () => {
      const donation = await createTestDonation({ amount: '100000' });
      await createConfirmedTransaction({ donationId: donation.id, amount: '150000' });

      const summary = await services.donationService.getFinancialSummary(donation.id);

      expect(summary.totalReceived.toString()).toBe('150000');
      expect(summary.remainingCommitment?.toString()).toBe('0');
    });
  });

  // -------------------------------------------------------------------------
  describe('lectures', () => {
    it('retrouve un don par sa reference', async () => {
      const donation = await createTestDonation();
      const found = await services.donationService.getDonationByReference(donation.reference);
      expect(found.id).toBe(donation.id);
    });

    it('filtre les dons par donateur et par statut', async () => {
      const donor = await createTestDonor();
      await createTestDonation({ donorId: donor.id, status: DonationStatus.ACTIVE });
      await createTestDonation({ donorId: donor.id, status: DonationStatus.DRAFT });
      await createTestDonation();

      const forDonor = await services.donationService.listDonations({ donorId: donor.id });
      expect(forDonor).toHaveLength(2);

      const active = await services.donationService.listDonations({
        donorId: donor.id,
        status: DonationStatus.ACTIVE,
      });
      expect(active).toHaveLength(1);
    });

    it('liste les dons recurrents dont l’echeance est due', async () => {
      await createTestDonation({
        donationType: DonationType.RECURRING,
        frequency: DonationFrequency.MONTHLY,
        startDate: new Date(Date.UTC(2026, 0, 15)),
        endDate: new Date(Date.UTC(2026, 11, 15)),
        status: DonationStatus.ACTIVE,
      });

      const due = await services.donationService.listDueDonations(new Date(Date.UTC(2026, 1, 1)));
      expect(due).toHaveLength(1);

      const notYetDue = await services.donationService.listDueDonations(
        new Date(Date.UTC(2025, 11, 1)),
      );
      expect(notYetDue).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('donateurs', () => {
    it('deduit le caractere international a partir du pays', async () => {
      const local = await createTestDonor({ country: 'MG' });
      const foreign = await createTestDonor({ country: 'FR', preferredCurrency: 'EUR' });

      expect((await services.donorService.getDonorProfile(local.id)).isInternational).toBe(false);
      expect((await services.donorService.getDonorProfile(foreign.id)).isInternational).toBe(true);
    });

    it('filtre les donateurs internationaux sans colonne dediee', async () => {
      await createTestDonor({ country: 'MG' });
      await createTestDonor({ country: 'FR', preferredCurrency: 'EUR' });
      await createTestDonor({ country: 'US', preferredCurrency: 'USD' });

      const international = await services.donorService.listDonors({ international: true });
      expect(international).toHaveLength(2);

      const locals = await services.donorService.listDonors({ international: false });
      expect(locals).toHaveLength(1);
    });

    it('refuse deux donateurs avec la meme adresse email', async () => {
      const donor = await createTestDonor();

      await expect(createTestDonor({ email: donor.email })).rejects.toThrow(/email/i);
    });

    it('normalise l’email en minuscules', async () => {
      const donor = await createTestDonor({ email: 'Test.MAJUSCULE@Example.TEST' });
      expect(donor.email).toBe('test.majuscule@example.test');
    });

    it('affiche la raison sociale pour une organisation', async () => {
      const donor = await createTestDonor({
        donorType: 'COMPANY',
        organizationName: 'Fondation Solidarite',
        firstName: 'Jean',
        lastName: 'Dupont',
      });

      const profile = await services.donorService.getDonorProfile(donor.id);
      expect(profile.displayName).toBe('Fondation Solidarite');
    });
  });
});
