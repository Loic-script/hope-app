import type { Impact } from '@prisma/client';
import type { Decimal, DecimalInput } from '../../shared/money.js';

export interface RecordImpactInput {
  projectId: string;
  title: string;
  description: string;
  measuredAt: Date | string;
  /** Nul si l'impact concerne le projet entier et non une personne. */
  beneficiaryId?: string | null;
  /** Indicateur mesurable : women_trained, children_schooled... */
  indicator?: string | null;
  value?: DecimalInput | null;
  unit?: string | null;
}

export interface ImpactFilters {
  projectId?: string;
  beneficiaryId?: string;
  indicator?: string;
  from?: Date;
  to?: Date;
}

/** Total cumule d'un indicateur sur un projet. */
export interface IndicatorTotal {
  indicator: string;
  unit: string | null;
  total: Decimal;
  measurementCount: number;
}

export interface ProjectImpactReport {
  projectId: string;
  indicators: IndicatorTotal[];
  impacts: Impact[];
  totalMeasurements: number;
}
