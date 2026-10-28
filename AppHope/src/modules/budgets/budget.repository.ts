import type { BudgetItem, BudgetStatus, Prisma, ProjectBudget } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ZERO, toDecimal, type Decimal } from '../../shared/money.js';
import type { DbClient } from '../../shared/types.js';

export class BudgetRepository {
  constructor(private readonly db: DbClient = prisma) {}

  // --- Budgets -------------------------------------------------------------

  async create(
    data: Prisma.ProjectBudgetUncheckedCreateInput,
    tx?: DbClient,
  ): Promise<ProjectBudget> {
    return (tx ?? this.db).projectBudget.create({ data });
  }

  async update(
    id: string,
    data: Prisma.ProjectBudgetUncheckedUpdateInput,
    tx?: DbClient,
  ): Promise<ProjectBudget> {
    return (tx ?? this.db).projectBudget.update({ where: { id }, data });
  }

  async updateStatus(id: string, status: BudgetStatus, tx?: DbClient): Promise<ProjectBudget> {
    return (tx ?? this.db).projectBudget.update({ where: { id }, data: { status } });
  }

  async findById(id: string, tx?: DbClient): Promise<ProjectBudget | null> {
    return (tx ?? this.db).projectBudget.findUnique({ where: { id } });
  }

  async findByProjectId(projectId: string, tx?: DbClient): Promise<ProjectBudget[]> {
    return (tx ?? this.db).projectBudget.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Verrouille le budget pendant la validation d'une depense. */
  async lockForUpdate(id: string, tx: DbClient): Promise<void> {
    await tx.$queryRaw`SELECT id FROM project_budgets WHERE id = ${id}::uuid FOR UPDATE`;
  }

  // --- Lignes budgetaires --------------------------------------------------

  async createItem(
    data: Prisma.BudgetItemUncheckedCreateInput,
    tx?: DbClient,
  ): Promise<BudgetItem> {
    return (tx ?? this.db).budgetItem.create({ data });
  }

  async findItemById(id: string, tx?: DbClient): Promise<BudgetItem | null> {
    return (tx ?? this.db).budgetItem.findUnique({ where: { id } });
  }

  async findItemsByBudgetId(budgetId: string, tx?: DbClient): Promise<BudgetItem[]> {
    return (tx ?? this.db).budgetItem.findMany({
      where: { budgetId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Somme des montants prevus des lignes d'un budget. */
  async sumPlannedItems(budgetId: string, tx?: DbClient): Promise<Decimal> {
    const result = await (tx ?? this.db).budgetItem.aggregate({
      where: { budgetId },
      _sum: { plannedAmount: true },
    });
    return toDecimal(result._sum.plannedAmount ?? ZERO);
  }
}
