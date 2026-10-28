import { BudgetStatus, type BudgetItem, type ProjectBudget } from '@prisma/client';
import { BudgetRepository } from './budget.repository.js';
import type {
  BudgetItemBreakdown,
  BudgetSummary,
  CreateBudgetInput,
  CreateBudgetItemInput,
} from './budget.types.js';
import { ExpenseRepository } from '../expenses/expense.repository.js';
import { ProjectService } from '../projects/project.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.types.js';
import { runInTransaction } from '../../database/unit-of-work.js';
import { normalizeCurrency } from '../../shared/currency.js';
import { BusinessRuleError, NotFoundError } from '../../shared/errors.js';
import { ZERO, assertPositiveAmount, formatMoney, type Decimal } from '../../shared/money.js';
import { createStateMachine } from '../../shared/state-machine.js';
import type { DbClient } from '../../shared/types.js';
import {
  assertDateRange,
  optionalDate,
  optionalText,
  requireText,
} from '../../shared/validation.js';

/**
 * Cycle de vie d'un budget.
 *
 *   DRAFT ---> ACTIVE ---> CLOSED
 *     |          |
 *     +----------+------> CANCELLED
 */
export const budgetStateMachine = createStateMachine<BudgetStatus>('ProjectBudget', {
  [BudgetStatus.DRAFT]: [BudgetStatus.ACTIVE, BudgetStatus.CANCELLED],
  [BudgetStatus.ACTIVE]: [BudgetStatus.CLOSED, BudgetStatus.CANCELLED],
  [BudgetStatus.CLOSED]: [],
  [BudgetStatus.CANCELLED]: [],
});

/** Budgets sur lesquels une depense peut etre imputee. */
export const SPENDABLE_BUDGET_STATUSES: readonly BudgetStatus[] = [
  BudgetStatus.DRAFT,
  BudgetStatus.ACTIVE,
];

/**
 * Budgets de projet.
 *
 * Un projet peut porter PLUSIEURS budgets, typiquement un par periode
 * ("Scolarisation 2027", puis "Scolarisation 2028"). Chaque budget se decoupe
 * en lignes (budget_items) : frais scolaires, materiel, transport...
 *
 * DEUX PLAFONDS DIFFERENTS, A NE PAS CONFONDRE
 *   - le BUDGET est une PREVISION : combien on prevoit de depenser ;
 *   - les FONDS DU PROJET sont du CASH : combien a reellement ete recu.
 *   Une depense doit respecter les deux (voir ExpenseService).
 */
export class BudgetService {
  constructor(
    private readonly budgetRepository: BudgetRepository = new BudgetRepository(),
    private readonly expenseRepository: ExpenseRepository = new ExpenseRepository(),
    private readonly projectService: ProjectService = new ProjectService(),
    private readonly auditService: AuditService = new AuditService(),
  ) {}

  // -------------------------------------------------------------------------
  // Budgets
  // -------------------------------------------------------------------------

  async createBudget(input: CreateBudgetInput): Promise<ProjectBudget> {
    return runInTransaction(async (tx) => {
      await this.projectService.getProjectById(input.projectId, tx);

      const currency = normalizeCurrency(input.currency);
      const totalAmount = assertPositiveAmount(input.totalAmount, currency, 'totalAmount');

      const startDate = optionalDate(input.startDate, 'startDate');
      const endDate = optionalDate(input.endDate, 'endDate');
      assertDateRange(startDate, endDate, 'budget');

      const budget = await this.budgetRepository.create(
        {
          projectId: input.projectId,
          name: requireText(input.name, 'name', 180),
          totalAmount,
          currency,
          startDate,
          endDate,
          status: input.status ?? BudgetStatus.DRAFT,
        },
        tx,
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.PROJECT_BUDGET,
          entityId: budget.id,
          action: AUDIT_ACTIONS.BUDGET_CREATED,
          newData: {
            projectId: budget.projectId,
            name: budget.name,
            totalAmount: budget.totalAmount.toString(),
            currency: budget.currency,
          },
        },
        tx,
      );

      return budget;
    });
  }

  async changeBudgetStatus(id: string, target: BudgetStatus): Promise<ProjectBudget> {
    return runInTransaction(async (tx) => {
      const current = await this.getBudgetById(id, tx);
      budgetStateMachine.assert(current.status, target);

      const updated = await this.budgetRepository.updateStatus(id, target, tx);

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.PROJECT_BUDGET,
          entityId: id,
          action: AUDIT_ACTIONS.BUDGET_STATUS_CHANGED,
          oldData: { status: current.status },
          newData: { status: updated.status },
        },
        tx,
      );

      return updated;
    });
  }

  async activateBudget(id: string): Promise<ProjectBudget> {
    return this.changeBudgetStatus(id, BudgetStatus.ACTIVE);
  }

  async closeBudget(id: string): Promise<ProjectBudget> {
    return this.changeBudgetStatus(id, BudgetStatus.CLOSED);
  }

  async getBudgetById(id: string, tx?: DbClient): Promise<ProjectBudget> {
    const budget = await this.budgetRepository.findById(id, tx);
    if (!budget) throw new NotFoundError('Budget', id);
    return budget;
  }

  async listBudgetsForProject(projectId: string): Promise<ProjectBudget[]> {
    return this.budgetRepository.findByProjectId(projectId);
  }

  // -------------------------------------------------------------------------
  // Lignes budgetaires
  // -------------------------------------------------------------------------

  /**
   * Ajoute une ligne au budget.
   *
   * La somme des lignes ne peut pas depasser l'enveloppe totale : on refuse
   * de planifier plus que ce que le budget autorise.
   */
  async addBudgetItem(input: CreateBudgetItemInput): Promise<BudgetItem> {
    return runInTransaction(async (tx) => {
      const budget = await this.getBudgetById(input.budgetId, tx);
      await this.budgetRepository.lockForUpdate(budget.id, tx);

      const plannedAmount = assertPositiveAmount(
        input.plannedAmount,
        budget.currency,
        'plannedAmount',
      );

      const alreadyPlanned = await this.budgetRepository.sumPlannedItems(budget.id, tx);
      const newTotal = alreadyPlanned.plus(plannedAmount);

      if (newTotal.greaterThan(budget.totalAmount)) {
        throw new BusinessRuleError(
          `Ligne budgetaire refusee : le total des lignes atteindrait ` +
            `${formatMoney(newTotal, budget.currency)} alors que le budget ` +
            `"${budget.name}" est de ${formatMoney(budget.totalAmount, budget.currency)}.`,
          {
            budgetId: budget.id,
            alreadyPlanned: alreadyPlanned.toString(),
            requested: plannedAmount.toString(),
            totalAmount: budget.totalAmount.toString(),
          },
        );
      }

      const item = await this.budgetRepository.createItem(
        {
          budgetId: budget.id,
          name: requireText(input.name, 'name', 180),
          description: optionalText(input.description, 'description'),
          plannedAmount,
        },
        tx,
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.BUDGET_ITEM,
          entityId: item.id,
          action: AUDIT_ACTIONS.BUDGET_ITEM_CREATED,
          newData: {
            budgetId: budget.id,
            name: item.name,
            plannedAmount: item.plannedAmount.toString(),
            currency: budget.currency,
          },
        },
        tx,
      );

      return item;
    });
  }

  async getBudgetItemById(id: string, tx?: DbClient): Promise<BudgetItem> {
    const item = await this.budgetRepository.findItemById(id, tx);
    if (!item) throw new NotFoundError('Ligne budgetaire', id);
    return item;
  }

  async listBudgetItems(budgetId: string): Promise<BudgetItem[]> {
    return this.budgetRepository.findItemsByBudgetId(budgetId);
  }

  // -------------------------------------------------------------------------
  // Calculs
  // -------------------------------------------------------------------------

  /** Budget restant = enveloppe - depenses engagees (VALIDATED + PAID). */
  async getRemainingBudget(
    budgetId: string,
    tx?: DbClient,
    excludeExpenseId?: string,
  ): Promise<Decimal> {
    const budget = await this.getBudgetById(budgetId, tx);
    const spent = await this.expenseRepository.sumCommittedByBudget(budgetId, tx, excludeExpenseId);
    const remaining = budget.totalAmount.minus(spent);
    return remaining.greaterThan(0) ? remaining : ZERO;
  }

  /** Reste disponible sur une ligne budgetaire precise. */
  async getRemainingBudgetItem(
    budgetItemId: string,
    tx?: DbClient,
    excludeExpenseId?: string,
  ): Promise<Decimal> {
    const item = await this.getBudgetItemById(budgetItemId, tx);
    const spent = await this.expenseRepository.sumCommittedByBudgetItem(
      budgetItemId,
      tx,
      excludeExpenseId,
    );
    const remaining = item.plannedAmount.minus(spent);
    return remaining.greaterThan(0) ? remaining : ZERO;
  }

  /** Vue complete : enveloppe, planifie, depense, restant, par ligne. */
  async getBudgetSummary(budgetId: string): Promise<BudgetSummary> {
    const budget = await this.getBudgetById(budgetId);

    const [items, totalPlanned, totalSpent] = await Promise.all([
      this.budgetRepository.findItemsByBudgetId(budgetId),
      this.budgetRepository.sumPlannedItems(budgetId),
      this.expenseRepository.sumCommittedByBudget(budgetId),
    ]);

    const breakdown: BudgetItemBreakdown[] = [];
    for (const item of items) {
      const spent = await this.expenseRepository.sumCommittedByBudgetItem(item.id);
      const remaining = item.plannedAmount.minus(spent);
      breakdown.push({
        item,
        plannedAmount: item.plannedAmount,
        spentAmount: spent,
        remainingAmount: remaining.greaterThan(0) ? remaining : ZERO,
        consumptionRate: percentage(spent, item.plannedAmount),
      });
    }

    const remainingAmount = budget.totalAmount.minus(totalSpent);
    const unplanned = budget.totalAmount.minus(totalPlanned);

    return {
      budget,
      currency: budget.currency,
      totalAmount: budget.totalAmount,
      totalPlanned,
      unplannedAmount: unplanned.greaterThan(0) ? unplanned : ZERO,
      totalSpent,
      remainingAmount: remainingAmount.greaterThan(0) ? remainingAmount : ZERO,
      consumptionRate: percentage(totalSpent, budget.totalAmount),
      items: breakdown,
    };
  }

  /** Verifie qu'un budget accepte encore des depenses. */
  async assertBudgetIsSpendable(budgetId: string, tx?: DbClient): Promise<ProjectBudget> {
    const budget = await this.getBudgetById(budgetId, tx);
    if (!SPENDABLE_BUDGET_STATUSES.includes(budget.status)) {
      throw new BusinessRuleError(
        `Le budget "${budget.name}" est ${budget.status} : aucune depense ne peut ` +
          `plus y etre imputee.`,
        { budgetId, status: budget.status },
      );
    }
    return budget;
  }
}

/** Taux de consommation en pourcentage, arrondi a 2 decimales. */
export function percentage(part: Decimal, total: Decimal): number {
  if (total.isZero()) return 0;
  return Number(part.dividedBy(total).times(100).toDecimalPlaces(2).toString());
}
