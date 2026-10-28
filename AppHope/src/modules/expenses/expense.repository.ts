import { ExpenseStatus, type Expense, type Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ZERO, toDecimal, type Decimal } from '../../shared/money.js';
import { normalizePagination, type DbClient, type PaginationOptions } from '../../shared/types.js';

export type CreateExpenseData = Prisma.ExpenseUncheckedCreateInput;
export type UpdateExpenseData = Prisma.ExpenseUncheckedUpdateInput;

/**
 * Statuts qui CONSOMMENT reellement des fonds.
 *
 * Une depense DRAFT est une intention : elle n'immobilise pas encore
 * d'argent. Une depense CANCELLED n'en consomme plus.
 */
export const COMMITTED_EXPENSE_STATUSES: readonly ExpenseStatus[] = [
  ExpenseStatus.VALIDATED,
  ExpenseStatus.PAID,
];

/** Depenses d'un projet ventilees par devise. */
export interface ProjectSpendByCurrency {
  currency: string;
  /** VALIDATED + PAID : fonds reellement consommes. */
  committed: Decimal;
  /** DRAFT : prevu mais pas encore engage. */
  draft: Decimal;
  expenseCount: number;
}

export class ExpenseRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async create(data: CreateExpenseData, tx?: DbClient): Promise<Expense> {
    return (tx ?? this.db).expense.create({ data });
  }

  async update(id: string, data: UpdateExpenseData, tx?: DbClient): Promise<Expense> {
    return (tx ?? this.db).expense.update({ where: { id }, data });
  }

  async findById(id: string, tx?: DbClient): Promise<Expense | null> {
    return (tx ?? this.db).expense.findUnique({ where: { id } });
  }

  async findByReference(reference: string, tx?: DbClient): Promise<Expense | null> {
    return (tx ?? this.db).expense.findUnique({ where: { reference } });
  }

  async findMany(
    where: Prisma.ExpenseWhereInput = {},
    options: PaginationOptions = {},
    tx?: DbClient,
  ): Promise<Expense[]> {
    const { skip, take } = normalizePagination(options);
    return (tx ?? this.db).expense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
      skip,
      take,
    });
  }

  async count(where: Prisma.ExpenseWhereInput = {}, tx?: DbClient): Promise<number> {
    return (tx ?? this.db).expense.count({ where });
  }

  /** Depenses d'un projet, par devise et par nature (engagees / brouillon). */
  async sumByProject(projectId: string, tx?: DbClient): Promise<ProjectSpendByCurrency[]> {
    const rows = await (tx ?? this.db).expense.groupBy({
      by: ['currency', 'status'],
      where: { projectId },
      _sum: { amount: true },
      _count: { _all: true },
    });

    const byCurrency = new Map<string, ProjectSpendByCurrency>();

    for (const row of rows) {
      const entry = byCurrency.get(row.currency) ?? {
        currency: row.currency,
        committed: ZERO,
        draft: ZERO,
        expenseCount: 0,
      };

      const amount = toDecimal(row._sum.amount ?? ZERO);
      entry.expenseCount += row._count._all;

      if (COMMITTED_EXPENSE_STATUSES.includes(row.status)) {
        entry.committed = entry.committed.plus(amount);
      } else if (row.status === ExpenseStatus.DRAFT) {
        entry.draft = entry.draft.plus(amount);
      }

      byCurrency.set(row.currency, entry);
    }

    return [...byCurrency.values()];
  }

  /** Total consomme par un projet dans une devise donnee (VALIDATED + PAID). */
  async sumCommittedByProjectAndCurrency(
    projectId: string,
    currency: string,
    tx?: DbClient,
    excludeExpenseId?: string,
  ): Promise<Decimal> {
    const result = await (tx ?? this.db).expense.aggregate({
      where: {
        projectId,
        currency: currency.toUpperCase(),
        status: { in: [...COMMITTED_EXPENSE_STATUSES] },
        ...(excludeExpenseId ? { id: { not: excludeExpenseId } } : {}),
      },
      _sum: { amount: true },
    });
    return toDecimal(result._sum.amount ?? ZERO);
  }

  /** Total consomme sur un budget (VALIDATED + PAID). */
  async sumCommittedByBudget(
    budgetId: string,
    tx?: DbClient,
    excludeExpenseId?: string,
  ): Promise<Decimal> {
    const result = await (tx ?? this.db).expense.aggregate({
      where: {
        budgetId,
        status: { in: [...COMMITTED_EXPENSE_STATUSES] },
        ...(excludeExpenseId ? { id: { not: excludeExpenseId } } : {}),
      },
      _sum: { amount: true },
    });
    return toDecimal(result._sum.amount ?? ZERO);
  }

  /** Total consomme sur une ligne budgetaire (VALIDATED + PAID). */
  async sumCommittedByBudgetItem(
    budgetItemId: string,
    tx?: DbClient,
    excludeExpenseId?: string,
  ): Promise<Decimal> {
    const result = await (tx ?? this.db).expense.aggregate({
      where: {
        budgetItemId,
        status: { in: [...COMMITTED_EXPENSE_STATUSES] },
        ...(excludeExpenseId ? { id: { not: excludeExpenseId } } : {}),
      },
      _sum: { amount: true },
    });
    return toDecimal(result._sum.amount ?? ZERO);
  }

  async countDocuments(expenseId: string, tx?: DbClient): Promise<number> {
    return (tx ?? this.db).supportingDocument.count({ where: { expenseId } });
  }
}
