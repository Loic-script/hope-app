import { BeneficiaryType, ProjectStatus } from '@prisma/client';
import type { Services } from '../../container.js';
import type { Repositories } from '../../container.js';
import type { IndicatorTotalDto } from '../dto/mappers.js';

/**
 * CHIFFRES CLES DU SITE PUBLIC.
 *
 * Tout vient de PostgreSQL. Aucun nombre n'est ecrit en dur : si HOPE
 * accompagne 312 orphelins, le site affiche 312, pas un "300" arrondi laisse
 * dans le code il y a deux ans.
 */

export interface BeneficiaryCountDto {
  type: string;
  count: number;
}

export interface CurrencyTotalDto {
  currency: string;
  totalAllocated: string;
  allocationCount: number;
}

export interface PublicStatsDto {
  beneficiaries: {
    total: number;
    byType: BeneficiaryCountDto[];
  };
  projects: {
    total: number;
    active: number;
    completed: number;
  };
  /** Indicateurs d'impact cumules sur tous les projets. */
  indicators: IndicatorTotalDto[];
  /** Montants collectes et affectes, par devise (aucune conversion). */
  funding: CurrencyTotalDto[];
}

export class StatsPresenter {
  constructor(
    private readonly services: Services,
    private readonly repositories: Repositories,
  ) {}

  async build(): Promise<PublicStatsDto> {
    const beneficiaryTypes = Object.values(BeneficiaryType);

    const [total, counts, projectTotal, active, completed, indicators, funding] = await Promise.all(
      [
        this.services.beneficiaryService.countBeneficiaries(),
        Promise.all(
          beneficiaryTypes.map(async (type) => ({
            type,
            count: await this.services.beneficiaryService.countBeneficiaries({
              beneficiaryType: type,
            }),
          })),
        ),
        this.services.projectService.countProjects(),
        this.services.projectService.countProjects({ status: ProjectStatus.ACTIVE }),
        this.services.projectService.countProjects({ status: ProjectStatus.COMPLETED }),
        this.services.impactService.getGlobalIndicatorTotals(),
        this.repositories.allocationRepository.sumAllByCurrency(),
      ],
    );

    return {
      beneficiaries: {
        total,
        // Les types sans aucun beneficiaire ne sont pas affiches : mieux vaut
        // trois chiffres vrais qu'une grille remplie de zeros.
        byType: counts.filter((entry) => entry.count > 0),
      },
      projects: { total: projectTotal, active, completed },
      indicators: indicators.map((indicator) => ({
        indicator: indicator.indicator,
        unit: indicator.unit,
        total: indicator.total.toString(),
        measurementCount: indicator.measurementCount,
      })),
      funding: funding.map((row) => ({
        currency: row.currency,
        totalAllocated: row.amount.toString(),
        allocationCount: row.allocationCount,
      })),
    };
  }
}
