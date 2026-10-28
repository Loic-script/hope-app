import type { Project, ProjectStatus } from '@prisma/client';
import type { Decimal } from '../../shared/money.js';

export interface CreateProjectInput {
  categoryId: string;
  name: string;
  description: string;
  location?: string | null;
  managerName?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  status?: ProjectStatus;
  photoUrl?: string | null;
  videoUrl?: string | null;
}

export type UpdateProjectInput = Partial<Omit<CreateProjectInput, 'categoryId' | 'status'>> & {
  categoryId?: string;
};

export interface ProjectFilters {
  categoryId?: string;
  status?: ProjectStatus;
  search?: string;
}

export interface CreateProjectCategoryInput {
  name: string;
  description?: string | null;
}

/**
 * Situation financiere d'un projet POUR UNE DEVISE donnee.
 *
 * HOPE ne convertit aucune devise en phase 1 : un projet finance en MGA et en
 * EUR possede deux situations distinctes, jamais additionnees.
 */
export interface ProjectFundsByCurrency {
  currency: string;
  /** Somme des affectations recues (argent deja encaisse par HOPE). */
  totalAllocated: Decimal;
  /** Depenses VALIDATED + PAID. */
  totalSpent: Decimal;
  /** Depenses encore en DRAFT : engagees mais pas encore validees. */
  totalDraftExpenses: Decimal;
  /** totalAllocated - totalSpent : ce qui reste reellement depensable. */
  availableFunds: Decimal;
  allocationCount: number;
}

export interface ProjectFinancialOverview {
  project: Project;
  fundsByCurrency: ProjectFundsByCurrency[];
  beneficiaryCount: number;
  impactCount: number;
}
