import { AllocationType, type DonationAllocation } from '@prisma/client';
import { AllocationRepository } from './allocation.repository.js';
import type {
  AllocateDonationInput,
  AllocateManyInput,
  AllocationSplit,
  DonationAllocationSummary,
} from './allocation.types.js';
import { DonationRepository } from '../donations/donation.repository.js';
import { TransactionRepository } from '../payments/transaction.repository.js';
import { ProjectRepository } from '../projects/project.repository.js';
import { FUNDABLE_PROJECT_STATUSES } from '../projects/project.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.types.js';
import { runInTransaction } from '../../database/unit-of-work.js';
import { normalizeCurrency } from '../../shared/currency.js';
import {
  BusinessRuleError,
  InsufficientFundsError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.js';
import {
  ZERO,
  assertPositiveAmount,
  formatMoney,
  sumDecimals,
  type Decimal,
} from '../../shared/money.js';
import type { DbClient } from '../../shared/types.js';
import { optionalDate, optionalText, requireText } from '../../shared/validation.js';

/**
 * AFFECTATION DES DONS AUX PROJETS.
 *
 * Un don peut etre :
 *   - AFFECTE      : le donateur designe le projet (DONOR_DESIGNATED) ;
 *   - NON AFFECTE  : HOPE repartit librement l'argent (HOPE_ALLOCATED).
 *
 * Un meme don peut financer plusieurs projets :
 *   Don de 1 000 EUR -> 400 Education + 300 Sante + 300 Alimentation.
 *
 * REGLE CENTRALE (regle financiere n.5)
 *   La somme des affectations d'un don ne peut JAMAIS depasser le montant
 *   NET REELLEMENT RECU (transactions SUCCESS, remboursements deduits).
 *   Ni les transactions PENDING ni les FAILED n'ouvrent de droit a affecter.
 *
 * CONCURRENCE
 *   Le controle "lire le disponible puis ecrire" est protege par une
 *   transaction PostgreSQL SERIALIZABLE doublee d'un verrou explicite sur la
 *   ligne du don (SELECT ... FOR UPDATE). Deux affectations simultanees ne
 *   peuvent donc pas depasser ensemble le disponible.
 */
export class AllocationService {
  constructor(
    private readonly allocationRepository: AllocationRepository = new AllocationRepository(),
    private readonly donationRepository: DonationRepository = new DonationRepository(),
    private readonly transactionRepository: TransactionRepository = new TransactionRepository(),
    private readonly projectRepository: ProjectRepository = new ProjectRepository(),
    private readonly auditService: AuditService = new AuditService(),
  ) {}

  /** Affecte une partie (ou la totalite) d'un don a un projet. */
  async allocate(input: AllocateDonationInput): Promise<DonationAllocation> {
    const [allocation] = await this.allocateMany({
      donationId: input.donationId,
      allocatedAt: input.allocatedAt,
      splits: [
        {
          projectId: input.projectId,
          amount: input.amount,
          allocationType: input.allocationType,
          notes: input.notes,
        },
      ],
    });

    // allocateMany renvoie toujours autant d'affectations que de parts.
    if (!allocation) {
      throw new BusinessRuleError("L'affectation n'a pas pu etre creee.", {
        donationId: input.donationId,
      });
    }
    return allocation;
  }

  /**
   * Repartit un don entre plusieurs projets EN UNE SEULE OPERATION ATOMIQUE.
   *
   * Soit toutes les parts sont enregistrees, soit aucune : on ne veut jamais
   * d'une repartition a moitie ecrite apres une erreur sur la troisieme part.
   */
  async allocateMany(input: AllocateManyInput): Promise<DonationAllocation[]> {
    if (!Array.isArray(input.splits) || input.splits.length === 0) {
      throw new ValidationError('Aucune part fournie : `splits` doit contenir au moins un projet.', {
        donationId: input.donationId,
      });
    }

    return runInTransaction(async (tx) => {
      const donation = await this.donationRepository.findById(input.donationId, tx);
      if (!donation) throw new NotFoundError('Don', input.donationId);

      // Verrou : serialise les affectations concurrentes sur le meme don.
      await this.donationRepository.lockForUpdate(donation.id, tx);

      const currency = normalizeCurrency(donation.currency);
      const allocatedAt = optionalDate(input.allocatedAt, 'allocatedAt') ?? new Date();

      const prepared = await this.prepareSplits(input, currency, tx);
      const requestedTotal = sumDecimals(prepared.map((split) => split.amount));

      const available = await this.computeAvailable(donation.id, tx);

      if (requestedTotal.greaterThan(available)) {
        throw new InsufficientFundsError(
          `Affectation refusee : vous tentez d'affecter ` +
            `${formatMoney(requestedTotal, currency)} alors que le don ` +
            `${donation.reference} ne dispose que de ${formatMoney(available, currency)}. ` +
            `Seules les transactions SUCCESS alimentent les fonds affectables.`,
          {
            donationId: donation.id,
            requested: requestedTotal.toString(),
            available: available.toString(),
            currency,
          },
        );
      }

      const created: DonationAllocation[] = [];

      for (const split of prepared) {
        const allocation = await this.allocationRepository.create(
          {
            donationId: donation.id,
            projectId: split.projectId,
            amount: split.amount,
            currency,
            allocationType: split.allocationType,
            allocatedAt,
            notes: split.notes,
          },
          tx,
        );

        await this.auditService.record(
          {
            entityType: AUDIT_ENTITIES.DONATION_ALLOCATION,
            entityId: allocation.id,
            action: AUDIT_ACTIONS.DONATION_ALLOCATED,
            newData: {
              donationId: donation.id,
              donationReference: donation.reference,
              projectId: split.projectId,
              amount: split.amount.toString(),
              currency,
              allocationType: split.allocationType,
            },
          },
          tx,
        );

        created.push(allocation);
      }

      return created;
    });
  }

  /**
   * Annule une affectation et libere les fonds correspondants.
   *
   * Contrairement a une transaction financiere, une affectation est une
   * decision interne de repartition : elle peut etre defaite, a condition que
   * le projet n'ait pas deja depense les fonds concernes.
   */
  async reverseAllocation(allocationId: string, reason: string): Promise<DonationAllocation> {
    const justification = requireText(reason, 'reason');

    return runInTransaction(async (tx) => {
      const allocation = await this.allocationRepository.findById(allocationId, tx);
      if (!allocation) throw new NotFoundError('Affectation', allocationId);

      await this.assertProjectCanReleaseFunds(allocation, tx);

      const removed = await this.allocationRepository.delete(allocationId, tx);

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.DONATION_ALLOCATION,
          entityId: allocationId,
          action: AUDIT_ACTIONS.DONATION_ALLOCATION_REVERSED,
          oldData: {
            donationId: removed.donationId,
            projectId: removed.projectId,
            amount: removed.amount.toString(),
            currency: removed.currency,
          },
          newData: { reason: justification },
        },
        tx,
      );

      return removed;
    });
  }

  // -------------------------------------------------------------------------
  // Lectures
  // -------------------------------------------------------------------------

  async getAllocationsForDonation(donationId: string): Promise<DonationAllocation[]> {
    return this.allocationRepository.findByDonationId(donationId);
  }

  async getAllocationsForProject(projectId: string): Promise<DonationAllocation[]> {
    return this.allocationRepository.findByProjectId(projectId);
  }

  /** Montant encore affectable pour ce don. */
  async getUnallocatedAmount(donationId: string, tx?: DbClient): Promise<Decimal> {
    return this.computeAvailable(donationId, tx);
  }

  async getDonationAllocationSummary(donationId: string): Promise<DonationAllocationSummary> {
    const donation = await this.donationRepository.findById(donationId);
    if (!donation) throw new NotFoundError('Don', donationId);

    const [totalReceived, totalAllocated, allocations] = await Promise.all([
      this.transactionRepository.sumNetReceived(donationId),
      this.allocationRepository.sumByDonation(donationId),
      this.allocationRepository.findByDonationId(donationId),
    ]);

    const unallocated = totalReceived.minus(totalAllocated);

    return {
      donationId,
      currency: donation.currency,
      totalReceived,
      totalAllocated,
      unallocatedAmount: unallocated.greaterThan(0) ? unallocated : ZERO,
      allocations,
      isFullyAllocated: totalReceived.greaterThan(0) && unallocated.lessThanOrEqualTo(0),
    };
  }

  // -------------------------------------------------------------------------
  // Internes
  // -------------------------------------------------------------------------

  /** disponible = recu net - deja affecte. Jamais negatif. */
  private async computeAvailable(donationId: string, tx?: DbClient): Promise<Decimal> {
    const [received, allocated] = await Promise.all([
      this.transactionRepository.sumNetReceived(donationId, tx),
      this.allocationRepository.sumByDonation(donationId, tx),
    ]);
    const available = received.minus(allocated);
    return available.greaterThan(0) ? available : ZERO;
  }

  /** Valide chaque part : projet finançable, montant positif, pas de doublon. */
  private async prepareSplits(
    input: AllocateManyInput,
    currency: string,
    tx: DbClient,
  ): Promise<{ projectId: string; amount: Decimal; allocationType: AllocationType; notes: string | null }[]> {
    const defaultType = input.defaultAllocationType ?? AllocationType.HOPE_ALLOCATED;
    const seen = new Set<string>();
    const prepared: {
      projectId: string;
      amount: Decimal;
      allocationType: AllocationType;
      notes: string | null;
    }[] = [];

    for (const [index, split] of input.splits.entries()) {
      assertSplitShape(split, index);

      if (seen.has(split.projectId)) {
        throw new ValidationError(
          `Le projet ${split.projectId} apparait deux fois dans la meme repartition : ` +
            `regroupez les montants en une seule part.`,
          { projectId: split.projectId },
        );
      }
      seen.add(split.projectId);

      const project = await this.projectRepository.findById(split.projectId, tx);
      if (!project) throw new NotFoundError('Projet', split.projectId);

      if (!FUNDABLE_PROJECT_STATUSES.includes(project.status)) {
        throw new BusinessRuleError(
          `Le projet ${project.code} est ${project.status} : il ne peut plus recevoir de fonds.`,
          { projectId: project.id, status: project.status },
        );
      }

      prepared.push({
        projectId: split.projectId,
        amount: assertPositiveAmount(split.amount, currency, `splits[${index}].amount`),
        allocationType: split.allocationType ?? defaultType,
        notes: optionalText(split.notes, `splits[${index}].notes`),
      });
    }

    return prepared;
  }

  /**
   * Refuse de liberer des fonds deja consommes par le projet : sinon on
   * obtiendrait un projet ayant depense plus qu'il n'a recu.
   */
  private async assertProjectCanReleaseFunds(
    allocation: DonationAllocation,
    tx: DbClient,
  ): Promise<void> {
    const currentlyAllocated = await this.allocationRepository.sumByProjectAndCurrency(
      allocation.projectId,
      allocation.currency,
      tx,
    );

    const spent = await tx.expense.aggregate({
      where: {
        projectId: allocation.projectId,
        currency: allocation.currency,
        status: { in: ['VALIDATED', 'PAID'] },
      },
      _sum: { amount: true },
    });

    const totalSpent = spent._sum.amount ?? ZERO;
    const fundsLeft = currentlyAllocated.minus(allocation.amount);

    if (fundsLeft.lessThan(totalSpent)) {
      throw new InsufficientFundsError(
        `Annulation impossible : le projet a deja depense ` +
          `${formatMoney(totalSpent, allocation.currency)} et ne conserverait que ` +
          `${formatMoney(fundsLeft, allocation.currency)} de fonds affectes.`,
        {
          allocationId: allocation.id,
          projectId: allocation.projectId,
          spent: totalSpent.toString(),
          fundsAfterReversal: fundsLeft.toString(),
        },
      );
    }
  }
}

function assertSplitShape(split: AllocationSplit, index: number): void {
  if (!split || typeof split.projectId !== 'string' || split.projectId.trim() === '') {
    throw new ValidationError(`splits[${index}].projectId est obligatoire.`, { index });
  }
}
