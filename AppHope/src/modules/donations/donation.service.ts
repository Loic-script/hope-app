import {
  DonationStatus,
  DonationType,
  type Donation,
  type Prisma,
} from '@prisma/client';
import { DonationRepository } from './donation.repository.js';
import {
  assertDonationTypeConsistency,
  computeExpectedInstallments,
  computeNextPaymentDate,
  donationStateMachine,
} from './donation.rules.js';
import type {
  CreateDonationInput,
  DonationFilters,
  DonationFinancialSummary,
  DonationWithSummary,
  UpdateDonationInput,
} from './donation.types.js';
import { AllocationRepository } from '../allocations/allocation.repository.js';
import { TransactionRepository } from '../payments/transaction.repository.js';
import { DonorRepository } from '../donors/donor.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.types.js';
import { runInTransaction } from '../../database/unit-of-work.js';
import { normalizeCurrency } from '../../shared/currency.js';
import { BusinessRuleError, NotFoundError } from '../../shared/errors.js';
import { ZERO, assertPositiveAmount, toDecimal, type Decimal } from '../../shared/money.js';
import { REFERENCE_PREFIXES, createWithUniqueReference } from '../../shared/reference.js';
import type { DbClient, PaginationOptions } from '../../shared/types.js';
import { assertDateRange, optionalDate, optionalText } from '../../shared/validation.js';

/**
 * Gestion des DONS, c'est-a-dire des ENGAGEMENTS des donateurs.
 *
 * A NE JAMAIS CONFONDRE AVEC LES TRANSACTIONS.
 *   Un don porte une INTENTION : "je donne 50 000 MGA par mois pendant 12 mois".
 *   Les transactions portent l'ARGENT REEL : douze encaissements distincts,
 *   dont certains peuvent echouer ou etre rembourses.
 *
 * C'est pourquoi `expectedAmount` (attendu) et `totalReceived` (recu) sont
 * deux notions differentes, et que seul le second alimente les fonds de HOPE.
 */
export class DonationService {
  constructor(
    private readonly donationRepository: DonationRepository = new DonationRepository(),
    private readonly transactionRepository: TransactionRepository = new TransactionRepository(),
    private readonly allocationRepository: AllocationRepository = new AllocationRepository(),
    private readonly donorRepository: DonorRepository = new DonorRepository(),
    private readonly auditService: AuditService = new AuditService(),
  ) {}

  // -------------------------------------------------------------------------
  // Ecritures
  // -------------------------------------------------------------------------

  async createDonation(input: CreateDonationInput): Promise<Donation> {
    return runInTransaction(async (tx) => {
      const donor = await this.donorRepository.findById(input.donorId, tx);
      if (!donor) throw new NotFoundError('Donateur', input.donorId);

      const currency = normalizeCurrency(input.currency);
      const expectedAmount = assertPositiveAmount(input.expectedAmount, currency, 'expectedAmount');
      const frequency = input.frequency ?? null;

      assertDonationTypeConsistency(input.donationType, frequency);

      const startDate = optionalDate(input.startDate, 'startDate');
      const endDate = optionalDate(input.endDate, 'endDate');
      assertDateRange(startDate, endDate, 'don');

      // Pour un don recurrent, la premiere echeance est la date de debut.
      const nextPaymentDate =
        optionalDate(input.nextPaymentDate, 'nextPaymentDate') ??
        (input.donationType === DonationType.RECURRING ? startDate : null);

      const donation = await createWithUniqueReference(REFERENCE_PREFIXES.DONATION, (reference) =>
        this.donationRepository.create(
          {
            reference,
            donorId: donor.id,
            donationType: input.donationType,
            status: input.status ?? DonationStatus.DRAFT,
            currency,
            expectedAmount,
            frequency,
            startDate,
            endDate,
            nextPaymentDate,
            notes: optionalText(input.notes, 'notes'),
          },
          tx,
        ),
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.DONATION,
          entityId: donation.id,
          action: AUDIT_ACTIONS.DONATION_CREATED,
          newData: auditView(donation),
        },
        tx,
      );

      return donation;
    });
  }

  async updateDonation(id: string, input: UpdateDonationInput): Promise<Donation> {
    return runInTransaction(async (tx) => {
      const current = await this.getDonationById(id, tx);

      if (
        current.status === DonationStatus.CANCELLED ||
        current.status === DonationStatus.COMPLETED
      ) {
        throw new BusinessRuleError(
          `Le don ${current.reference} est ${current.status} : il n'est plus modifiable.`,
          { donationId: id, status: current.status },
        );
      }

      const data: Prisma.DonationUncheckedUpdateInput = {};

      if (input.expectedAmount !== undefined) {
        data.expectedAmount = assertPositiveAmount(
          input.expectedAmount,
          current.currency,
          'expectedAmount',
        );
      }
      if (input.frequency !== undefined) {
        assertDonationTypeConsistency(current.donationType, input.frequency);
        data.frequency = input.frequency;
      }
      if (input.notes !== undefined) data.notes = optionalText(input.notes, 'notes');

      const startDate =
        input.startDate !== undefined
          ? optionalDate(input.startDate, 'startDate')
          : current.startDate;
      const endDate =
        input.endDate !== undefined ? optionalDate(input.endDate, 'endDate') : current.endDate;
      assertDateRange(startDate, endDate, 'don');

      if (input.startDate !== undefined) data.startDate = startDate;
      if (input.endDate !== undefined) data.endDate = endDate;
      if (input.nextPaymentDate !== undefined) {
        data.nextPaymentDate = optionalDate(input.nextPaymentDate, 'nextPaymentDate');
      }

      return this.donationRepository.update(id, data, tx);
    });
  }

  /** DRAFT -> ACTIVE : l'engagement devient effectif. */
  async activateDonation(id: string): Promise<Donation> {
    return this.changeStatus(id, DonationStatus.ACTIVE, AUDIT_ACTIONS.DONATION_ACTIVATED);
  }

  /** ACTIVE -> COMPLETED : l'engagement est arrive a son terme. */
  async completeDonation(id: string): Promise<Donation> {
    return this.changeStatus(id, DonationStatus.COMPLETED, AUDIT_ACTIONS.DONATION_COMPLETED);
  }

  /**
   * Annule un don.
   *
   * Les transactions deja encaissees ne sont PAS effacees : l'argent recu
   * reste recu, et les affectations existantes restent valides. Annuler un
   * don signifie "plus aucune echeance a venir".
   */
  async cancelDonation(id: string, reason?: string): Promise<Donation> {
    return this.changeStatus(id, DonationStatus.CANCELLED, AUDIT_ACTIONS.DONATION_CANCELLED, {
      nextPaymentDate: null,
      ...(reason ? { notes: reason } : {}),
    });
  }

  /**
   * Fait avancer l'echeance d'un don recurrent apres un encaissement.
   * Si l'echeance depasse la date de fin, le don passe en COMPLETED.
   */
  async advanceNextPaymentDate(id: string): Promise<Donation> {
    return runInTransaction(async (tx) => {
      const donation = await this.getDonationById(id, tx);

      if (donation.donationType !== DonationType.RECURRING || !donation.frequency) {
        throw new BusinessRuleError(
          `Le don ${donation.reference} n'est pas recurrent : il n'a pas d'echeance suivante.`,
          { donationId: id, donationType: donation.donationType },
        );
      }

      const from = donation.nextPaymentDate ?? donation.startDate ?? new Date();
      const next = computeNextPaymentDate(from, donation.frequency);

      if (donation.endDate && next.getTime() > donation.endDate.getTime()) {
        const completed = await this.donationRepository.update(
          id,
          { status: DonationStatus.COMPLETED, nextPaymentDate: null },
          tx,
        );
        await this.auditService.record(
          {
            entityType: AUDIT_ENTITIES.DONATION,
            entityId: id,
            action: AUDIT_ACTIONS.DONATION_COMPLETED,
            oldData: auditView(donation),
            newData: auditView(completed),
          },
          tx,
        );
        return completed;
      }

      return this.donationRepository.update(id, { nextPaymentDate: next }, tx);
    });
  }

  // -------------------------------------------------------------------------
  // Lectures
  // -------------------------------------------------------------------------

  async getDonationById(id: string, tx?: DbClient): Promise<Donation> {
    const donation = await this.donationRepository.findById(id, tx);
    if (!donation) throw new NotFoundError('Don', id);
    return donation;
  }

  async getDonationByReference(reference: string): Promise<Donation> {
    const donation = await this.donationRepository.findByReference(reference);
    if (!donation) throw new NotFoundError('Don', reference);
    return donation;
  }

  async listDonations(
    filters: DonationFilters = {},
    options: PaginationOptions = {},
  ): Promise<Donation[]> {
    return this.donationRepository.findMany(buildDonationWhere(filters), options);
  }

  async countDonations(filters: DonationFilters = {}): Promise<number> {
    return this.donationRepository.count(buildDonationWhere(filters));
  }

  /** Dons recurrents dont l'echeance est due (utile pour un futur planificateur). */
  async listDueDonations(dueBefore: Date = new Date()): Promise<Donation[]> {
    return this.donationRepository.findMany({
      status: DonationStatus.ACTIVE,
      donationType: DonationType.RECURRING,
      nextPaymentDate: { lte: dueBefore },
    });
  }

  // -------------------------------------------------------------------------
  // Vue financiere
  // -------------------------------------------------------------------------

  /**
   * Photographie financiere complete d'un don.
   *
   * C'est la source de verite utilisee par AllocationService pour savoir
   * combien peut encore etre affecte a des projets.
   */
  async getFinancialSummary(
    donationId: string,
    tx?: DbClient,
  ): Promise<DonationFinancialSummary> {
    const donation = await this.getDonationById(donationId, tx);

    const [totals, totalAllocated] = await Promise.all([
      this.transactionRepository.getDonationTotals(donationId, tx),
      this.allocationRepository.sumByDonation(donationId, tx),
    ]);

    const expectedAmountPerInstallment = toDecimal(donation.expectedAmount);
    const expectedInstallments = computeExpectedInstallments(donation);
    const totalCommitted =
      expectedInstallments === null
        ? null
        : expectedAmountPerInstallment.times(expectedInstallments);

    const availableForAllocation = subtractFloorZero(totals.totalReceived, totalAllocated);
    const remainingCommitment =
      totalCommitted === null ? null : subtractFloorZero(totalCommitted, totals.totalReceived);

    return {
      donationId: donation.id,
      reference: donation.reference,
      currency: donation.currency,
      donationType: donation.donationType,
      status: donation.status,

      expectedAmountPerInstallment,
      expectedInstallments,
      totalCommitted,

      totalReceived: totals.totalReceived,
      totalPending: totals.totalPending,
      totalFailed: totals.totalFailed,
      totalCancelled: totals.totalCancelled,
      totalRefunded: totals.totalRefunded,

      totalAllocated,
      availableForAllocation,
      unallocatedAmount: availableForAllocation,

      remainingCommitment,
      isFullyFunded: remainingCommitment !== null && remainingCommitment.isZero(),

      transactionCount: totals.transactionCount,
      successfulTransactionCount: totals.successfulTransactionCount,
    };
  }

  async getDonationWithSummary(donationId: string): Promise<DonationWithSummary> {
    const donation = await this.getDonationById(donationId);
    const summary = await this.getFinancialSummary(donationId);
    return { donation, summary };
  }

  /** Montant net reellement encaisse (regles n.2, n.3 et n.4). */
  async getTotalReceived(donationId: string, tx?: DbClient): Promise<Decimal> {
    return this.transactionRepository.sumNetReceived(donationId, tx);
  }

  /** Plafond absolu d'une nouvelle affectation vers un projet (regle n.5). */
  async getAvailableForAllocation(donationId: string, tx?: DbClient): Promise<Decimal> {
    const [received, allocated] = await Promise.all([
      this.transactionRepository.sumNetReceived(donationId, tx),
      this.allocationRepository.sumByDonation(donationId, tx),
    ]);
    return subtractFloorZero(received, allocated);
  }

  /** Reste a payer sur l'engagement. null = engagement recurrent sans fin. */
  async getRemainingCommitment(donationId: string): Promise<Decimal | null> {
    const summary = await this.getFinancialSummary(donationId);
    return summary.remainingCommitment;
  }

  // -------------------------------------------------------------------------
  // Internes
  // -------------------------------------------------------------------------

  private async changeStatus(
    id: string,
    target: DonationStatus,
    action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
    extraData: Prisma.DonationUncheckedUpdateInput = {},
  ): Promise<Donation> {
    return runInTransaction(async (tx) => {
      const current = await this.getDonationById(id, tx);
      donationStateMachine.assert(current.status, target);

      const updated = await this.donationRepository.update(
        id,
        { status: target, ...extraData },
        tx,
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.DONATION,
          entityId: id,
          action,
          oldData: auditView(current),
          newData: auditView(updated),
        },
        tx,
      );

      return updated;
    });
  }
}

// ---------------------------------------------------------------------------
// Fonctions pures
// ---------------------------------------------------------------------------

/** Soustraction qui ne descend jamais sous zero (un solde reste positif). */
export function subtractFloorZero(left: Decimal, right: Decimal): Decimal {
  const result = left.minus(right);
  return result.greaterThan(0) ? result : ZERO;
}

export function buildDonationWhere(filters: DonationFilters): Prisma.DonationWhereInput {
  const where: Prisma.DonationWhereInput = {};

  if (filters.donorId) where.donorId = filters.donorId;
  if (filters.status) where.status = filters.status;
  if (filters.donationType) where.donationType = filters.donationType;
  if (filters.currency) where.currency = normalizeCurrency(filters.currency);
  if (filters.dueBefore) where.nextPaymentDate = { lte: filters.dueBefore };

  return where;
}

function auditView(donation: Donation): Record<string, unknown> {
  return {
    id: donation.id,
    reference: donation.reference,
    donorId: donation.donorId,
    donationType: donation.donationType,
    status: donation.status,
    currency: donation.currency,
    expectedAmount: donation.expectedAmount.toString(),
    frequency: donation.frequency,
    startDate: donation.startDate,
    endDate: donation.endDate,
    nextPaymentDate: donation.nextPaymentDate,
  };
}
