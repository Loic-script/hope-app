import { AllocationType, ProjectStatus } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/database.js';
import {
  createConfirmedTransaction,
  createFundedDonation,
  createTestDonation,
  createTestProject,
  getTestServices,
} from '../helpers/factories.js';
import type { Services } from '../../container.js';
import {
  BusinessRuleError,
  InsufficientFundsError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../modules/audit/audit.types.js';

describe('AllocationService', () => {
  useTestDatabase();

  let services: Services;

  beforeEach(() => {
    services = getTestServices();
  });

  // -------------------------------------------------------------------------
  describe('affectation simple', () => {
    it('affecte une partie du don a un projet', async () => {
      const { donation } = await createFundedDonation({ amount: '100000' });
      const project = await createTestProject();

      const allocation = await services.allocationService.allocate({
        donationId: donation.id,
        projectId: project.id,
        amount: '70000',
        allocationType: AllocationType.DONOR_DESIGNATED,
      });

      expect(allocation.amount.toString()).toBe('70000');
      expect(allocation.currency).toBe('MGA');
      expect(allocation.allocationType).toBe(AllocationType.DONOR_DESIGNATED);
    });

    it('laisse le reste non affecte', async () => {
      const { donation } = await createFundedDonation({ amount: '100000' });
      const project = await createTestProject();

      await services.allocationService.allocate({
        donationId: donation.id,
        projectId: project.id,
        amount: '70000',
        allocationType: AllocationType.DONOR_DESIGNATED,
      });

      const summary = await services.allocationService.getDonationAllocationSummary(donation.id);

      expect(summary.totalReceived.toString()).toBe('100000');
      expect(summary.totalAllocated.toString()).toBe('70000');
      expect(summary.unallocatedAmount.toString()).toBe('30000');
      expect(summary.isFullyAllocated).toBe(false);
    });

    it('signale un don entierement affecte', async () => {
      const { donation } = await createFundedDonation({ amount: '100000' });
      const project = await createTestProject();

      await services.allocationService.allocate({
        donationId: donation.id,
        projectId: project.id,
        amount: '100000',
        allocationType: AllocationType.HOPE_ALLOCATED,
      });

      const summary = await services.allocationService.getDonationAllocationSummary(donation.id);
      expect(summary.unallocatedAmount.toString()).toBe('0');
      expect(summary.isFullyAllocated).toBe(true);
    });

    it('journalise l’affectation dans l’audit', async () => {
      const { donation } = await createFundedDonation({ amount: '100000' });
      const project = await createTestProject();

      const allocation = await services.allocationService.allocate({
        donationId: donation.id,
        projectId: project.id,
        amount: '50000',
        allocationType: AllocationType.HOPE_ALLOCATED,
      });

      const history = await services.auditService.getEntityHistory(
        AUDIT_ENTITIES.DONATION_ALLOCATION,
        allocation.id,
      );
      expect(history.map((entry) => entry.action)).toContain(AUDIT_ACTIONS.DONATION_ALLOCATED);
    });
  });

  // -------------------------------------------------------------------------
  describe('repartition sur plusieurs projets', () => {
    it('repartit un don entre trois projets', async () => {
      const { donation } = await createFundedDonation({ amount: '100000' });
      const education = await createTestProject();
      const sante = await createTestProject();
      const alimentation = await createTestProject();

      const allocations = await services.allocationService.allocateMany({
        donationId: donation.id,
        defaultAllocationType: AllocationType.HOPE_ALLOCATED,
        splits: [
          { projectId: education.id, amount: '40000' },
          { projectId: sante.id, amount: '30000' },
          { projectId: alimentation.id, amount: '30000' },
        ],
      });

      expect(allocations).toHaveLength(3);

      const summary = await services.allocationService.getDonationAllocationSummary(donation.id);
      expect(summary.totalAllocated.toString()).toBe('100000');
      expect(summary.unallocatedAmount.toString()).toBe('0');

      const educationFunds = await services.projectService.getAvailableFunds(education.id, 'MGA');
      expect(educationFunds.toString()).toBe('40000');
    });

    it('n’ecrit AUCUNE part si le total depasse les fonds disponibles', async () => {
      const { donation } = await createFundedDonation({ amount: '100000' });
      const first = await createTestProject();
      const second = await createTestProject();

      await expect(
        services.allocationService.allocateMany({
          donationId: donation.id,
          splits: [
            { projectId: first.id, amount: '60000' },
            { projectId: second.id, amount: '60000' },
          ],
        }),
      ).rejects.toThrow(InsufficientFundsError);

      // L'operation est atomique : rien ne doit avoir ete ecrit.
      const allocations = await services.allocationService.getAllocationsForDonation(donation.id);
      expect(allocations).toHaveLength(0);
    });

    it('refuse deux parts pour le meme projet', async () => {
      const { donation } = await createFundedDonation({ amount: '100000' });
      const project = await createTestProject();

      await expect(
        services.allocationService.allocateMany({
          donationId: donation.id,
          splits: [
            { projectId: project.id, amount: '30000' },
            { projectId: project.id, amount: '20000' },
          ],
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('refuse une liste de parts vide', async () => {
      const { donation } = await createFundedDonation();

      await expect(
        services.allocationService.allocateMany({ donationId: donation.id, splits: [] }),
      ).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  describe('plafond : on n’affecte que l’argent REELLEMENT recu', () => {
    it('refuse une affectation superieure au montant recu', async () => {
      const { donation } = await createFundedDonation({ amount: '100000' });
      const project = await createTestProject();

      await expect(
        services.allocationService.allocate({
          donationId: donation.id,
          projectId: project.id,
          amount: '150000',
          allocationType: AllocationType.HOPE_ALLOCATED,
        }),
      ).rejects.toThrow(InsufficientFundsError);
    });

    it('refuse toute affectation si la transaction est restee PENDING', async () => {
      const donation = await createTestDonation({ amount: '100000' });
      await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });
      const project = await createTestProject();

      await expect(
        services.allocationService.allocate({
          donationId: donation.id,
          projectId: project.id,
          amount: '10000',
          allocationType: AllocationType.HOPE_ALLOCATED,
        }),
      ).rejects.toThrow(InsufficientFundsError);
    });

    it('refuse toute affectation si la transaction a echoue', async () => {
      const donation = await createTestDonation({ amount: '100000' });
      const transaction = await services.paymentService.createTransaction({
        donationId: donation.id,
        paymentMethodCode: 'MVOLA',
      });
      await services.paymentService.failTransaction(transaction.id, { reason: 'Echec.' });
      const project = await createTestProject();

      await expect(
        services.allocationService.allocate({
          donationId: donation.id,
          projectId: project.id,
          amount: '10000',
          allocationType: AllocationType.HOPE_ALLOCATED,
        }),
      ).rejects.toThrow(InsufficientFundsError);
    });

    it('refuse une seconde affectation qui depasserait le solde restant', async () => {
      const { donation } = await createFundedDonation({ amount: '100000' });
      const project = await createTestProject();

      await services.allocationService.allocate({
        donationId: donation.id,
        projectId: project.id,
        amount: '70000',
        allocationType: AllocationType.HOPE_ALLOCATED,
      });

      await expect(
        services.allocationService.allocate({
          donationId: donation.id,
          projectId: project.id,
          amount: '50000',
          allocationType: AllocationType.HOPE_ALLOCATED,
        }),
      ).rejects.toThrow(InsufficientFundsError);
    });

    it('tient compte des echeances successives d’un don mensuel', async () => {
      const donation = await createTestDonation({ amount: '50000' });
      const project = await createTestProject();

      await createConfirmedTransaction({ donationId: donation.id });
      expect((await services.allocationService.getUnallocatedAmount(donation.id)).toString()).toBe(
        '50000',
      );

      await createConfirmedTransaction({ donationId: donation.id });
      expect((await services.allocationService.getUnallocatedAmount(donation.id)).toString()).toBe(
        '100000',
      );

      await services.allocationService.allocate({
        donationId: donation.id,
        projectId: project.id,
        amount: '100000',
        allocationType: AllocationType.HOPE_ALLOCATED,
      });

      expect((await services.allocationService.getUnallocatedAmount(donation.id)).toString()).toBe(
        '0',
      );
    });

    it('reduit les fonds affectables apres un remboursement partiel', async () => {
      const { donation, transaction } = await createFundedDonation({ amount: '100000' });

      await services.paymentService.refundTransaction(transaction.id, {
        amount: '40000',
        reason: 'Trop-percu.',
      });

      const available = await services.allocationService.getUnallocatedAmount(donation.id);
      expect(available.toString()).toBe('60000');
    });

    it('refuse un montant nul ou negatif', async () => {
      const { donation } = await createFundedDonation();
      const project = await createTestProject();

      await expect(
        services.allocationService.allocate({
          donationId: donation.id,
          projectId: project.id,
          amount: '0',
          allocationType: AllocationType.HOPE_ALLOCATED,
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  describe('coherence avec les projets', () => {
    it('refuse un projet inexistant', async () => {
      const { donation } = await createFundedDonation();

      await expect(
        services.allocationService.allocate({
          donationId: donation.id,
          projectId: '00000000-0000-4000-8000-000000000000',
          amount: '1000',
          allocationType: AllocationType.HOPE_ALLOCATED,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('refuse un projet annule', async () => {
      const { donation } = await createFundedDonation();
      const project = await createTestProject({ status: ProjectStatus.DRAFT });
      await services.projectService.changeProjectStatus(project.id, ProjectStatus.CANCELLED);

      await expect(
        services.allocationService.allocate({
          donationId: donation.id,
          projectId: project.id,
          amount: '1000',
          allocationType: AllocationType.HOPE_ALLOCATED,
        }),
      ).rejects.toThrow(BusinessRuleError);
    });

    it('refuse un don inexistant', async () => {
      const project = await createTestProject();

      await expect(
        services.allocationService.allocate({
          donationId: '00000000-0000-4000-8000-000000000000',
          projectId: project.id,
          amount: '1000',
          allocationType: AllocationType.HOPE_ALLOCATED,
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('ne melange pas les devises d’un meme projet', async () => {
      // Un projet finance en MGA et en EUR possede deux soldes distincts :
      // HOPE ne convertit aucune devise.
      const project = await createTestProject();

      const { donation: mgaDonation } = await createFundedDonation({ amount: '100000' });
      await services.allocationService.allocate({
        donationId: mgaDonation.id,
        projectId: project.id,
        amount: '100000',
        allocationType: AllocationType.HOPE_ALLOCATED,
      });

      const euroDonor = await services.donorService.createDonor({
        firstName: 'Claire',
        lastName: 'Moreau',
        email: `claire.${Date.now()}@example.fr`,
        phone: '+33 6 00 00 00 00',
        donorType: 'INDIVIDUAL',
        country: 'FR',
        preferredCurrency: 'EUR',
      });
      const { donation: eurDonation } = await createFundedDonation({
        amount: '500',
        currency: 'EUR',
        donorId: euroDonor.id,
        paymentMethodCode: 'CARD',
      });
      await services.allocationService.allocate({
        donationId: eurDonation.id,
        projectId: project.id,
        amount: '500',
        allocationType: AllocationType.HOPE_ALLOCATED,
      });

      const funds = await services.projectService.getProjectFunds(project.id);
      const eur = funds.find((row) => row.currency === 'EUR');
      const mga = funds.find((row) => row.currency === 'MGA');

      expect(mga?.totalAllocated.toString()).toBe('100000');
      expect(eur?.totalAllocated.toString()).toBe('500');
    });
  });

  // -------------------------------------------------------------------------
  describe('annulation d’une affectation', () => {
    it('libere les fonds si le projet n’a rien depense', async () => {
      const { donation } = await createFundedDonation({ amount: '100000' });
      const project = await createTestProject();

      const allocation = await services.allocationService.allocate({
        donationId: donation.id,
        projectId: project.id,
        amount: '100000',
        allocationType: AllocationType.HOPE_ALLOCATED,
      });

      await services.allocationService.reverseAllocation(allocation.id, 'Erreur de saisie.');

      const available = await services.allocationService.getUnallocatedAmount(donation.id);
      expect(available.toString()).toBe('100000');
    });

    it('refuse de liberer des fonds deja depenses par le projet', async () => {
      const { donation } = await createFundedDonation({ amount: '100000' });
      const project = await createTestProject();

      const allocation = await services.allocationService.allocate({
        donationId: donation.id,
        projectId: project.id,
        amount: '100000',
        allocationType: AllocationType.HOPE_ALLOCATED,
      });

      const expense = await services.expenseService.createExpense({
        projectId: project.id,
        amount: '60000',
        currency: 'MGA',
        description: 'Achat de fournitures.',
        expenseDate: new Date(),
      });
      await services.expenseService.validateExpense(expense.id);

      await expect(
        services.allocationService.reverseAllocation(allocation.id, 'Tentative de retrait.'),
      ).rejects.toThrow(InsufficientFundsError);
    });

    it('exige un motif d’annulation', async () => {
      const { donation } = await createFundedDonation({ amount: '100000' });
      const project = await createTestProject();

      const allocation = await services.allocationService.allocate({
        donationId: donation.id,
        projectId: project.id,
        amount: '10000',
        allocationType: AllocationType.HOPE_ALLOCATED,
      });

      await expect(
        services.allocationService.reverseAllocation(allocation.id, '   '),
      ).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  describe('interaction avec les remboursements', () => {
    it('refuse un remboursement qui rendrait les affectations invalides', async () => {
      const { donation, transaction } = await createFundedDonation({ amount: '100000' });
      const project = await createTestProject();

      await services.allocationService.allocate({
        donationId: donation.id,
        projectId: project.id,
        amount: '70000',
        allocationType: AllocationType.HOPE_ALLOCATED,
      });

      // 30 000 restent libres : un remboursement de 40 000 casserait la regle.
      await expect(
        services.paymentService.refundTransaction(transaction.id, {
          amount: '40000',
          reason: 'Demande du donateur.',
        }),
      ).rejects.toThrow(InsufficientFundsError);
    });

    it('autorise un remboursement dans la limite des fonds non affectes', async () => {
      const { donation, transaction } = await createFundedDonation({ amount: '100000' });
      const project = await createTestProject();

      await services.allocationService.allocate({
        donationId: donation.id,
        projectId: project.id,
        amount: '70000',
        allocationType: AllocationType.HOPE_ALLOCATED,
      });

      const refunded = await services.paymentService.refundTransaction(transaction.id, {
        amount: '30000',
        reason: 'Remboursement de la part non affectee.',
      });

      expect(refunded.refundedAmount.toString()).toBe('30000');

      const summary = await services.allocationService.getDonationAllocationSummary(donation.id);
      expect(summary.totalReceived.toString()).toBe('70000');
      expect(summary.unallocatedAmount.toString()).toBe('0');
    });
  });
});
