import { ExpenseStatus, type Expense, type Prisma } from '@prisma/client';
import { ExpenseRepository } from './expense.repository.js';
import type {
  CreateExpenseInput,
  ExpenseAffordability,
  ExpenseFilters,
  ProjectSpendingReport,
} from './expense.types.js';
import { BudgetRepository } from '../budgets/budget.repository.js';
import { BudgetService } from '../budgets/budget.service.js';
import { ProjectRepository } from '../projects/project.repository.js';
import { ProjectService } from '../projects/project.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.types.js';
import { runInTransaction } from '../../database/unit-of-work.js';
import { assertSameCurrency, normalizeCurrency } from '../../shared/currency.js';
import {
  InsufficientFundsError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.js';
import { ZERO, assertPositiveAmount, formatMoney, type Decimal } from '../../shared/money.js';
import { REFERENCE_PREFIXES, createWithUniqueReference } from '../../shared/reference.js';
import { createStateMachine } from '../../shared/state-machine.js';
import type { DbClient, PaginationOptions } from '../../shared/types.js';
import { requireDate, requireText } from '../../shared/validation.js';

/**
 * Cycle de vie d'une depense.
 *
 *   DRAFT ---> VALIDATED ---> PAID
 *     |            |
 *     +------------+------> CANCELLED
 *
 * PAID est final : l'argent est sorti, on ne "decommande" pas un paiement
 * deja effectue. Une correction se fait par une ecriture compensatoire.
 */
export const expenseStateMachine = createStateMachine<ExpenseStatus>('Expense', {
  [ExpenseStatus.DRAFT]: [ExpenseStatus.VALIDATED, ExpenseStatus.CANCELLED],
  [ExpenseStatus.VALIDATED]: [ExpenseStatus.PAID, ExpenseStatus.CANCELLED],
  [ExpenseStatus.PAID]: [],
  [ExpenseStatus.CANCELLED]: [],
});

/**
 * Gestion des depenses de projet.
 *
 * DEUX PLAFONDS INDEPENDANTS SONT VERIFIES
 *   1. LE BUDGET (une prevision) : la depense ne doit pas faire depasser
 *      l'enveloppe du budget, ni celle de la ligne budgetaire visee ;
 *   2. LA TRESORERIE (du cash reel) : la depense ne doit pas depasser les
 *      fonds effectivement affectes au projet, lesquels ne proviennent que
 *      de transactions SUCCESS (regle financiere n.6).
 *
 * Un projet peut donc avoir un budget vote de 5 000 EUR mais ne pouvoir
 * depenser que 1 200 EUR s'il n'a recu que 1 200 EUR.
 *
 * QUAND LE CONTROLE EST-IL BLOQUANT ?
 *   Le controle est rejoue a chaque etape (creation, validation) et il est
 *   BLOQUANT a chaque fois. Une depense DRAFT ne consomme cependant pas
 *   encore les fonds : seuls les statuts VALIDATED et PAID les consomment.
 *   Verifier des la creation permet de signaler l'incoherence tout de suite
 *   plutot qu'au moment de la validation.
 */
export class ExpenseService {
  constructor(
    private readonly expenseRepository: ExpenseRepository = new ExpenseRepository(),
    private readonly budgetRepository: BudgetRepository = new BudgetRepository(),
    private readonly budgetService: BudgetService = new BudgetService(),
    private readonly projectService: ProjectService = new ProjectService(),
    private readonly projectRepository: ProjectRepository = new ProjectRepository(),
    private readonly auditService: AuditService = new AuditService(),
  ) {}

  // -------------------------------------------------------------------------
  // Ecritures
  // -------------------------------------------------------------------------

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    return runInTransaction(async (tx) => {
      const project = await this.projectService.assertProjectIsFundable(input.projectId, tx);
      const currency = normalizeCurrency(input.currency);
      const amount = assertPositiveAmount(input.amount, currency, 'amount');
      const expenseDate = requireDate(input.expenseDate, 'expenseDate');

      const { budgetId, budgetItemId } = await this.resolveBudgetLinks(input, currency, tx);

      const affordability = await this.checkAffordability(
        { projectId: project.id, currency, amount, budgetId, budgetItemId },
        tx,
      );
      assertAffordable(affordability, project.code);

      const expense = await createWithUniqueReference(REFERENCE_PREFIXES.EXPENSE, (reference) =>
        this.expenseRepository.create(
          {
            reference,
            projectId: project.id,
            budgetId,
            budgetItemId,
            amount,
            currency,
            description: requireText(input.description, 'description'),
            expenseDate,
            status: input.status ?? ExpenseStatus.DRAFT,
          },
          tx,
        ),
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.EXPENSE,
          entityId: expense.id,
          action: AUDIT_ACTIONS.EXPENSE_CREATED,
          newData: auditView(expense),
        },
        tx,
      );

      return expense;
    });
  }

  /**
   * DRAFT -> VALIDATED : la depense est approuvee et consomme desormais
   * reellement le budget et la tresorerie du projet.
   */
  async validateExpense(id: string): Promise<Expense> {
    return runInTransaction(async (tx) => {
      const current = await this.getExpenseById(id, tx);
      expenseStateMachine.assert(current.status, ExpenseStatus.VALIDATED);

      const project = await this.projectService.assertProjectIsFundable(current.projectId, tx);
      if (current.budgetId) {
        await this.budgetService.assertBudgetIsSpendable(current.budgetId, tx);
        await this.budgetRepository.lockForUpdate(current.budgetId, tx);
      }
      await this.projectRepository.lockForUpdate(project.id, tx);

      // Le controle exclut la depense elle-meme : elle n'est pas encore engagee.
      const affordability = await this.checkAffordability(
        {
          projectId: current.projectId,
          currency: current.currency,
          amount: current.amount,
          budgetId: current.budgetId,
          budgetItemId: current.budgetItemId,
          excludeExpenseId: current.id,
        },
        tx,
      );
      assertAffordable(affordability, project.code);

      const updated = await this.expenseRepository.update(
        id,
        { status: ExpenseStatus.VALIDATED, validatedAt: new Date() },
        tx,
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.EXPENSE,
          entityId: id,
          action: AUDIT_ACTIONS.EXPENSE_VALIDATED,
          oldData: auditView(current),
          newData: auditView(updated),
        },
        tx,
      );

      return updated;
    });
  }

  /** VALIDATED -> PAID : l'argent est sorti. Statut final. */
  async markExpensePaid(id: string, paidAt?: Date | string): Promise<Expense> {
    return runInTransaction(async (tx) => {
      const current = await this.getExpenseById(id, tx);
      expenseStateMachine.assert(current.status, ExpenseStatus.PAID);

      const updated = await this.expenseRepository.update(
        id,
        {
          status: ExpenseStatus.PAID,
          paidAt: paidAt ? requireDate(paidAt, 'paidAt') : new Date(),
        },
        tx,
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.EXPENSE,
          entityId: id,
          action: AUDIT_ACTIONS.EXPENSE_PAID,
          oldData: auditView(current),
          newData: auditView(updated),
        },
        tx,
      );

      return updated;
    });
  }

  async cancelExpense(id: string, reason?: string): Promise<Expense> {
    return runInTransaction(async (tx) => {
      const current = await this.getExpenseById(id, tx);
      expenseStateMachine.assert(current.status, ExpenseStatus.CANCELLED);

      const updated = await this.expenseRepository.update(
        id,
        { status: ExpenseStatus.CANCELLED },
        tx,
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.EXPENSE,
          entityId: id,
          action: AUDIT_ACTIONS.EXPENSE_CANCELLED,
          oldData: auditView(current),
          newData: { ...auditView(updated), reason: reason ?? null },
        },
        tx,
      );

      return updated;
    });
  }

  // -------------------------------------------------------------------------
  // Lectures et calculs
  // -------------------------------------------------------------------------

  async getExpenseById(id: string, tx?: DbClient): Promise<Expense> {
    const expense = await this.expenseRepository.findById(id, tx);
    if (!expense) throw new NotFoundError('Depense', id);
    return expense;
  }

  async getExpenseByReference(reference: string): Promise<Expense> {
    const expense = await this.expenseRepository.findByReference(reference);
    if (!expense) throw new NotFoundError('Depense', reference);
    return expense;
  }

  async listExpenses(
    filters: ExpenseFilters = {},
    options: PaginationOptions = {},
  ): Promise<Expense[]> {
    return this.expenseRepository.findMany(buildExpenseWhere(filters), options);
  }

  /** Total reellement depense par un projet dans une devise (VALIDATED + PAID). */
  async getTotalSpent(projectId: string, currency: string, tx?: DbClient): Promise<Decimal> {
    return this.expenseRepository.sumCommittedByProjectAndCurrency(
      projectId,
      normalizeCurrency(currency),
      tx,
    );
  }

  /** Fonds encore depensables par le projet dans cette devise. */
  async getRemainingProjectFunds(
    projectId: string,
    currency: string,
    tx?: DbClient,
  ): Promise<Decimal> {
    return this.projectService.getAvailableFunds(projectId, currency, tx);
  }

  async getProjectSpendingReport(
    projectId: string,
    currency: string,
  ): Promise<ProjectSpendingReport> {
    const code = normalizeCurrency(currency);
    const [spending, availableFunds, expenses] = await Promise.all([
      this.expenseRepository.sumByProject(projectId),
      this.projectService.getAvailableFunds(projectId, code),
      this.expenseRepository.findMany({ projectId, currency: code }, { take: 200 }),
    ]);

    const row = spending.find((entry) => entry.currency === code);

    return {
      projectId,
      currency: code,
      totalSpent: row?.committed ?? ZERO,
      totalDraft: row?.draft ?? ZERO,
      availableFunds,
      expenseCount: row?.expenseCount ?? 0,
      expenses,
    };
  }

  /**
   * Calcule les plafonds applicables sans rien ecrire.
   * Utile pour prevenir l'utilisateur AVANT qu'il ne saisisse une depense.
   */
  async checkAffordability(
    input: {
      projectId: string;
      currency: string;
      amount: Decimal;
      budgetId?: string | null;
      budgetItemId?: string | null;
      excludeExpenseId?: string;
    },
    tx?: DbClient,
  ): Promise<ExpenseAffordability> {
    const currency = normalizeCurrency(input.currency);

    const projectAvailableFunds = await this.projectService.getAvailableFunds(
      input.projectId,
      currency,
      tx,
      input.excludeExpenseId,
    );

    const budgetRemaining = input.budgetId
      ? await this.budgetService.getRemainingBudget(input.budgetId, tx, input.excludeExpenseId)
      : null;

    const budgetItemRemaining = input.budgetItemId
      ? await this.budgetService.getRemainingBudgetItem(
          input.budgetItemId,
          tx,
          input.excludeExpenseId,
        )
      : null;

    const isAffordable =
      input.amount.lessThanOrEqualTo(projectAvailableFunds) &&
      (budgetRemaining === null || input.amount.lessThanOrEqualTo(budgetRemaining)) &&
      (budgetItemRemaining === null || input.amount.lessThanOrEqualTo(budgetItemRemaining));

    return {
      currency,
      amount: input.amount,
      projectAvailableFunds,
      budgetRemaining,
      budgetItemRemaining,
      isAffordable,
    };
  }

  // -------------------------------------------------------------------------
  // Internes
  // -------------------------------------------------------------------------

  /** Verifie la coherence budget / ligne budgetaire / projet / devise. */
  private async resolveBudgetLinks(
    input: CreateExpenseInput,
    currency: string,
    tx: DbClient,
  ): Promise<{ budgetId: string | null; budgetItemId: string | null }> {
    const budgetId = input.budgetId ?? null;
    const budgetItemId = input.budgetItemId ?? null;

    if (budgetItemId && !budgetId) {
      throw new ValidationError(
        'budgetItemId fourni sans budgetId : precisez le budget auquel appartient la ligne.',
        { budgetItemId },
      );
    }

    if (!budgetId) return { budgetId: null, budgetItemId: null };

    const budget = await this.budgetService.assertBudgetIsSpendable(budgetId, tx);

    if (budget.projectId !== input.projectId) {
      throw new ValidationError(
        `Le budget "${budget.name}" appartient a un autre projet : une depense ne peut ` +
          `pas etre imputee au budget d'un projet different.`,
        { budgetId, budgetProjectId: budget.projectId, projectId: input.projectId },
      );
    }

    assertSameCurrency(budget.currency, currency, `depense imputee au budget "${budget.name}"`);

    if (budgetItemId) {
      const item = await this.budgetService.getBudgetItemById(budgetItemId, tx);
      if (item.budgetId !== budgetId) {
        throw new ValidationError(
          `La ligne budgetaire "${item.name}" n'appartient pas au budget indique.`,
          { budgetItemId, itemBudgetId: item.budgetId, budgetId },
        );
      }
    }

    return { budgetId, budgetItemId };
  }
}

// ---------------------------------------------------------------------------
// Fonctions pures
// ---------------------------------------------------------------------------

/** Traduit un resultat de plafond en erreur metier explicite. */
export function assertAffordable(
  affordability: ExpenseAffordability,
  projectCode: string,
): void {
  if (affordability.isAffordable) return;

  const { amount, currency } = affordability;

  if (
    affordability.budgetItemRemaining !== null &&
    amount.greaterThan(affordability.budgetItemRemaining)
  ) {
    throw new InsufficientFundsError(
      `Depense refusee : ${formatMoney(amount, currency)} depasse le reste de la ligne ` +
        `budgetaire (${formatMoney(affordability.budgetItemRemaining, currency)}).`,
      {
        amount: amount.toString(),
        budgetItemRemaining: affordability.budgetItemRemaining.toString(),
      },
    );
  }

  if (affordability.budgetRemaining !== null && amount.greaterThan(affordability.budgetRemaining)) {
    throw new InsufficientFundsError(
      `Depense refusee : ${formatMoney(amount, currency)} depasse le budget restant ` +
        `(${formatMoney(affordability.budgetRemaining, currency)}).`,
      { amount: amount.toString(), budgetRemaining: affordability.budgetRemaining.toString() },
    );
  }

  throw new InsufficientFundsError(
    `Depense refusee : ${formatMoney(amount, currency)} depasse les fonds disponibles du ` +
      `projet ${projectCode} (${formatMoney(affordability.projectAvailableFunds, currency)}). ` +
      `Rappel : seuls les dons encaisses et affectes a ce projet constituent des fonds.`,
    {
      amount: amount.toString(),
      projectAvailableFunds: affordability.projectAvailableFunds.toString(),
      projectCode,
    },
  );
}

export function buildExpenseWhere(filters: ExpenseFilters): Prisma.ExpenseWhereInput {
  const where: Prisma.ExpenseWhereInput = {};

  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.budgetId) where.budgetId = filters.budgetId;
  if (filters.budgetItemId) where.budgetItemId = filters.budgetItemId;
  if (filters.status) where.status = filters.status;
  if (filters.currency) where.currency = normalizeCurrency(filters.currency);

  if (filters.from || filters.to) {
    where.expenseDate = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  return where;
}

function auditView(expense: Expense): Record<string, unknown> {
  return {
    id: expense.id,
    reference: expense.reference,
    projectId: expense.projectId,
    budgetId: expense.budgetId,
    budgetItemId: expense.budgetItemId,
    amount: expense.amount.toString(),
    currency: expense.currency,
    status: expense.status,
    expenseDate: expense.expenseDate,
  };
}

