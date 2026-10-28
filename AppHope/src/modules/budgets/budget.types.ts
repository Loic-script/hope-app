import type { BudgetItem, BudgetStatus, ProjectBudget } from '@prisma/client';
import type { Decimal, DecimalInput } from '../../shared/money.js';

export interface CreateBudgetInput {
  projectId: string;
  name: string;
  totalAmount: DecimalInput;
  currency: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  status?: BudgetStatus;
}

export interface CreateBudgetItemInput {
  budgetId: string;
  name: string;
  plannedAmount: DecimalInput;
  description?: string | null;
}

/** Consommation d'une ligne budgetaire. */
export interface BudgetItemBreakdown {
  item: BudgetItem;
  plannedAmount: Decimal;
  spentAmount: Decimal;
  remainingAmount: Decimal;
  /** Pourcentage consomme, arrondi a 2 decimales. */
  consumptionRate: number;
}

/** Photographie complete d'un budget de projet. */
export interface BudgetSummary {
  budget: ProjectBudget;
  currency: string;
  /** Enveloppe votee. */
  totalAmount: Decimal;
  /** Somme des lignes budgetaires : ne doit jamais depasser totalAmount. */
  totalPlanned: Decimal;
  /** Enveloppe non encore repartie en lignes. */
  unplannedAmount: Decimal;
  /** Depenses VALIDATED + PAID imputees sur ce budget. */
  totalSpent: Decimal;
  /** totalAmount - totalSpent. */
  remainingAmount: Decimal;
  consumptionRate: number;
  items: BudgetItemBreakdown[];
}
