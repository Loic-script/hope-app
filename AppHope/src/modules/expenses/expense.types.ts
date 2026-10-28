import type { Expense, ExpenseStatus } from '@prisma/client';
import type { Decimal, DecimalInput } from '../../shared/money.js';

export interface CreateExpenseInput {
  projectId: string;
  amount: DecimalInput;
  currency: string;
  description: string;
  expenseDate: Date | string;
  /** Budget d'imputation. Facultatif : une depense peut etre hors budget. */
  budgetId?: string | null;
  /** Ligne budgetaire precise. Exige budgetId. */
  budgetItemId?: string | null;
  /** DRAFT par defaut. */
  status?: ExpenseStatus;
}

export interface ExpenseFilters {
  projectId?: string;
  budgetId?: string;
  budgetItemId?: string;
  status?: ExpenseStatus;
  currency?: string;
  from?: Date;
  to?: Date;
}

/** Detail des plafonds verifies avant d'engager une depense. */
export interface ExpenseAffordability {
  currency: string;
  amount: Decimal;
  /** Tresorerie reelle du projet (affectations recues - depenses engagees). */
  projectAvailableFunds: Decimal;
  /** Reste de l'enveloppe budgetaire, si un budget est renseigne. */
  budgetRemaining: Decimal | null;
  /** Reste de la ligne budgetaire, si elle est renseignee. */
  budgetItemRemaining: Decimal | null;
  isAffordable: boolean;
}

export interface ProjectSpendingReport {
  projectId: string;
  currency: string;
  totalSpent: Decimal;
  totalDraft: Decimal;
  availableFunds: Decimal;
  expenseCount: number;
  expenses: Expense[];
}
