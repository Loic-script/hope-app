import { BudgetStatus, ExpenseStatus, type Project } from '@prisma/client';
import {
  toBudgetDto,
  toImpactDto,
  toProjectDto,
  toProjectFundingDto,
  toPublicBeneficiaryDto,
  toPublicExpenseDto,
  type BudgetDto,
  type ImpactDto,
  type IndicatorTotalDto,
  type ProjectDto,
  type ProjectFundingDto,
  type PublicBeneficiaryDto,
  type PublicExpenseDto,
} from '../dto/mappers.js';
import type { Services } from '../../container.js';
import { ZERO, toDecimal, type Decimal } from '../../shared/money.js';
import { env } from '../../config/env.js';

/**
 * ASSEMBLAGE DE LA VUE PUBLIQUE D'UN PROJET.
 *
 * Ce presenteur ne calcule aucune regle financiere : il appelle les services
 * existants (`getProjectFunds`, `getBudgetSummary`, `getProjectSpendingReport`)
 * et se contente de rassembler et de formater leurs reponses.
 *
 * L'OBJECTIF DE FINANCEMENT, UN CHOIX A EXPLIQUER
 *   Le modele de donnees n'a pas de colonne "montant a collecter" : un projet
 *   porte des BUDGETS, et un budget est justement ce que le projet prevoit de
 *   depenser. L'objectif affiche sur le site est donc la somme des budgets
 *   encore ouverts (DRAFT + ACTIVE). C'est une donnee reelle, tenue par
 *   l'equipe financiere, et non un nombre decoratif choisi pour le marketing.
 *   Un projet sans budget n'affiche pas d'objectif : la barre de progression
 *   laisse place au simple montant deja collecte.
 */

export interface ProjectSummaryDto extends ProjectDto {
  funding: ProjectFundingDto;
  beneficiaryCount: number;
  impactCount: number;
}

export interface ProjectDetailDto extends ProjectSummaryDto {
  /** Situation par devise : HOPE ne convertit jamais une devise en une autre. */
  fundingByCurrency: ProjectFundingDto[];
  budgets: BudgetDto[];
  expenses: PublicExpenseDto[];
  impacts: ImpactDto[];
  indicators: IndicatorTotalDto[];
  beneficiaries: PublicBeneficiaryDto[];
}

export class ProjectPresenter {
  constructor(private readonly services: Services) {}

  async summarize(project: Project): Promise<ProjectSummaryDto> {
    const [category, funds, budgets, beneficiaryCount, impactCount] = await Promise.all([
      this.services.projectService.getCategoryById(project.categoryId),
      this.services.projectService.getProjectFunds(project.id),
      this.services.budgetService.listBudgetsForProject(project.id),
      this.services.projectService
        .getFinancialOverview(project.id)
        .then((overview) => overview.beneficiaryCount),
      this.services.impactService
        .listImpacts({ projectId: project.id })
        .then((impacts) => impacts.length),
    ]);

    const currency = pickPrimaryCurrency(budgets, funds);
    const fundsForCurrency = funds.find((row) => row.currency === currency) ?? emptyFunds(currency);

    return {
      ...toProjectDto(project, category),
      funding: toProjectFundingDto(fundsForCurrency, sumOpenBudgets(budgets, currency)),
      beneficiaryCount,
      impactCount,
    };
  }

  async summarizeMany(projects: Project[]): Promise<ProjectSummaryDto[]> {
    // Les projets sont peu nombreux (dizaines) : un traitement en parallele
    // suffit, sans requete d'agregation dediee.
    return Promise.all(projects.map((project) => this.summarize(project)));
  }

  async detail(project: Project): Promise<ProjectDetailDto> {
    const [summary, funds, budgets, impacts, indicators, enrollments] = await Promise.all([
      this.summarize(project),
      this.services.projectService.getProjectFunds(project.id),
      this.services.budgetService.listBudgetsForProject(project.id),
      this.services.impactService.listImpacts({ projectId: project.id }),
      this.services.impactService.getIndicatorTotals(project.id),
      this.services.beneficiaryService.getProjectBeneficiaries(project.id, { take: 24 }),
    ]);

    const budgetSummaries = await Promise.all(
      budgets.map((budget) => this.services.budgetService.getBudgetSummary(budget.id)),
    );

    // Seules les depenses reellement engagees sont publiees : un brouillon
    // n'est qu'une intention, l'afficher laisserait croire a une sortie d'argent.
    const committedExpenses = await this.services.expenseService.listExpenses(
      { projectId: project.id },
      { take: 50 },
    );
    const publishable = committedExpenses.filter(
      (expense) =>
        expense.status === ExpenseStatus.VALIDATED || expense.status === ExpenseStatus.PAID,
    );

    const expenses = await Promise.all(
      publishable.map(async (expense) => {
        const documents = await this.services.documentService.getDocumentsForExpense(expense.id);
        return toPublicExpenseDto(expense, documents.length);
      }),
    );

    return {
      ...summary,
      fundingByCurrency: funds.map((row) =>
        toProjectFundingDto(row, sumOpenBudgets(budgets, row.currency)),
      ),
      budgets: budgetSummaries.map(toBudgetDto),
      expenses,
      impacts: impacts.map(toImpactDto),
      indicators: indicators.map((indicator) => ({
        indicator: indicator.indicator,
        unit: indicator.unit,
        total: indicator.total.toString(),
        measurementCount: indicator.measurementCount,
      })),
      beneficiaries: enrollments.map((entry) => toPublicBeneficiaryDto(entry.beneficiary)),
    };
  }
}

// ---------------------------------------------------------------------------
// Fonctions pures
// ---------------------------------------------------------------------------

interface BudgetLike {
  currency: string;
  status: BudgetStatus;
  totalAmount: Decimal;
}

interface FundsLike {
  currency: string;
  totalAllocated: Decimal;
}

/** Budgets encore ouverts : les budgets clos ou annules ne sont plus un objectif. */
export const OPEN_BUDGET_STATUSES: readonly BudgetStatus[] = [
  BudgetStatus.DRAFT,
  BudgetStatus.ACTIVE,
];

export function sumOpenBudgets(budgets: BudgetLike[], currency: string): Decimal | null {
  const relevant = budgets.filter(
    (budget) => budget.currency === currency && OPEN_BUDGET_STATUSES.includes(budget.status),
  );
  if (relevant.length === 0) return null;

  return relevant.reduce<Decimal>((total, budget) => total.plus(toDecimal(budget.totalAmount)), ZERO);
}

/**
 * Devise principale d'un projet.
 *
 * Priorite au budget ouvert : c'est la devise dans laquelle l'equipe a
 * effectivement planifie. A defaut, la devise ayant recu le plus de dons.
 * En dernier recours, la devise par defaut de l'organisation.
 */
export function pickPrimaryCurrency(budgets: BudgetLike[], funds: FundsLike[]): string {
  const openBudget = budgets.find((budget) => OPEN_BUDGET_STATUSES.includes(budget.status));
  if (openBudget) return openBudget.currency;

  const richest = [...funds].sort((left, right) =>
    right.totalAllocated.comparedTo(left.totalAllocated),
  )[0];
  if (richest) return richest.currency;

  return env.defaultCurrency;
}

function emptyFunds(currency: string) {
  return {
    currency,
    totalAllocated: ZERO,
    totalSpent: ZERO,
    totalDraftExpenses: ZERO,
    availableFunds: ZERO,
    allocationCount: 0,
  };
}
