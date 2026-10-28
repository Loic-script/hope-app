import { TransactionStatus, type Prisma, type Transaction } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ZERO, toDecimal, type Decimal } from '../../shared/money.js';
import { normalizePagination, type DbClient, type PaginationOptions } from '../../shared/types.js';
import type { DonationTransactionTotals, TransactionFilters } from './payment.types.js';
import { IN_FLIGHT_STATUSES } from './transaction-status.js';

export type CreateTransactionData = Prisma.TransactionUncheckedCreateInput;
export type UpdateTransactionData = Prisma.TransactionUncheckedUpdateInput;

/**
 * Acces base de donnees pour les transactions financieres.
 *
 * Aucune regle metier ici : le repository ne fait que lire et ecrire.
 * Les regles (transitions de statut, plafonds) vivent dans PaymentService.
 */
export class TransactionRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async create(data: CreateTransactionData, tx?: DbClient): Promise<Transaction> {
    return (tx ?? this.db).transaction.create({ data });
  }

  async update(id: string, data: UpdateTransactionData, tx?: DbClient): Promise<Transaction> {
    return (tx ?? this.db).transaction.update({ where: { id }, data });
  }

  async findById(id: string, tx?: DbClient): Promise<Transaction | null> {
    return (tx ?? this.db).transaction.findUnique({ where: { id } });
  }

  async findByInternalReference(reference: string, tx?: DbClient): Promise<Transaction | null> {
    return (tx ?? this.db).transaction.findUnique({ where: { internalReference: reference } });
  }

  async findByDonationId(
    donationId: string,
    options: PaginationOptions = {},
    tx?: DbClient,
  ): Promise<Transaction[]> {
    const { skip, take } = normalizePagination({ take: 200, ...options });
    return (tx ?? this.db).transaction.findMany({
      where: { donationId },
      orderBy: [{ installmentNumber: 'asc' }, { createdAt: 'asc' }],
      skip,
      take,
    });
  }

  async findMany(
    filters: TransactionFilters = {},
    options: PaginationOptions = {},
    tx?: DbClient,
  ): Promise<Transaction[]> {
    const { skip, take } = normalizePagination(options);
    return (tx ?? this.db).transaction.findMany({
      where: buildTransactionWhere(filters),
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async count(filters: TransactionFilters = {}, tx?: DbClient): Promise<number> {
    return (tx ?? this.db).transaction.count({ where: buildTransactionWhere(filters) });
  }

  /** Numero de la derniere echeance enregistree pour un don recurrent. */
  async getLastInstallmentNumber(donationId: string, tx?: DbClient): Promise<number> {
    const result = await (tx ?? this.db).transaction.aggregate({
      where: { donationId },
      _max: { installmentNumber: true },
    });
    return result._max.installmentNumber ?? 0;
  }

  /**
   * Totaux financiers d'un don, calcules par PostgreSQL en une seule requete
   * (GROUP BY status). Les montants restent des Decimal : aucune conversion
   * en nombre flottant n'a lieu.
   */
  async getDonationTotals(donationId: string, tx?: DbClient): Promise<DonationTransactionTotals> {
    const rows = await (tx ?? this.db).transaction.groupBy({
      by: ['status'],
      where: { donationId },
      _sum: { amount: true, refundedAmount: true },
      _count: { _all: true },
    });

    const countByStatus = Object.fromEntries(
      Object.values(TransactionStatus).map((status) => [status, 0]),
    ) as Record<TransactionStatus, number>;

    let totalSuccessAmount = ZERO;
    let totalSuccessRefunded = ZERO;
    let totalPending = ZERO;
    let totalFailed = ZERO;
    let totalCancelled = ZERO;
    let totalRefunded = ZERO;
    let transactionCount = 0;

    for (const row of rows) {
      const amount = toDecimal(row._sum.amount ?? 0);
      const refunded = toDecimal(row._sum.refundedAmount ?? 0);
      const count = row._count._all;

      countByStatus[row.status] = count;
      transactionCount += count;
      totalRefunded = totalRefunded.plus(refunded);

      switch (row.status) {
        case TransactionStatus.SUCCESS:
          totalSuccessAmount = totalSuccessAmount.plus(amount);
          totalSuccessRefunded = totalSuccessRefunded.plus(refunded);
          break;
        case TransactionStatus.PENDING:
        case TransactionStatus.PROCESSING:
          totalPending = totalPending.plus(amount);
          break;
        case TransactionStatus.FAILED:
          totalFailed = totalFailed.plus(amount);
          break;
        case TransactionStatus.CANCELLED:
          totalCancelled = totalCancelled.plus(amount);
          break;
        case TransactionStatus.REFUNDED:
          // Integralement rembourse : n'alimente aucun fonds.
          break;
      }
    }

    const totalReceived = totalSuccessAmount.minus(totalSuccessRefunded);

    return {
      totalReceived: totalReceived.greaterThan(0) ? totalReceived : ZERO,
      totalPending,
      totalFailed,
      totalCancelled,
      totalRefunded,
      transactionCount,
      successfulTransactionCount: countByStatus[TransactionStatus.SUCCESS],
      countByStatus,
    };
  }

  /**
   * Montant NET reellement encaisse pour un don.
   * Raccourci de getDonationTotals().totalReceived.
   */
  async sumNetReceived(donationId: string, tx?: DbClient): Promise<Decimal> {
    const totals = await this.getDonationTotals(donationId, tx);
    return totals.totalReceived;
  }

  /** Verrouille les transactions d'un don pendant une operation financiere. */
  async lockDonationTransactions(donationId: string, tx: DbClient): Promise<void> {
    await tx.$queryRaw`SELECT id FROM transactions WHERE donation_id = ${donationId}::uuid FOR UPDATE`;
  }
}

export function buildTransactionWhere(filters: TransactionFilters): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = {};

  if (filters.donationId) where.donationId = filters.donationId;
  if (filters.paymentMethodId) where.paymentMethodId = filters.paymentMethodId;
  if (filters.currency) where.currency = filters.currency.toUpperCase();
  if (filters.status) where.status = filters.status;
  if (filters.statuses && filters.statuses.length > 0) where.status = { in: filters.statuses };

  if (filters.from || filters.to) {
    where.transactionDate = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  return where;
}

/** Transactions en attente d'encaissement : ni acquises, ni perdues. */
export function inFlightFilter(donationId: string): TransactionFilters {
  return { donationId, statuses: [...IN_FLIGHT_STATUSES] };
}
