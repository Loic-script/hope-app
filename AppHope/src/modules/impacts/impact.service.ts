import type { Impact, Prisma } from '@prisma/client';
import { ImpactRepository } from './impact.repository.js';
import type {
  ImpactFilters,
  IndicatorTotal,
  ProjectImpactReport,
  RecordImpactInput,
} from './impact.types.js';
import { BeneficiaryRepository } from '../beneficiaries/beneficiary.repository.js';
import { ProjectService } from '../projects/project.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.types.js';
import { runInTransaction } from '../../database/unit-of-work.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { ZERO, toDecimal } from '../../shared/money.js';
import type { DbClient, PaginationOptions } from '../../shared/types.js';
import { optionalText, requireDate, requireText } from '../../shared/validation.js';

/**
 * Mesure de l'impact des projets.
 *
 * Un impact peut etre :
 *   - COLLECTIF : "25 meres celibataires formees" (beneficiaryId = null) ;
 *   - INDIVIDUEL : rattache a un beneficiaire precis.
 *
 * Le trio indicator / value / unit rend l'impact AGREGEABLE :
 *   indicator = "women_trained", value = 25, unit = "persons".
 * On peut alors totaliser un indicateur sur tout un projet.
 *
 * NOTE : `value` est un Decimal(18, 4) et non un entier, afin de pouvoir
 * mesurer aussi des taux (ex : taux de reussite scolaire = 87,5 %).
 */
export class ImpactService {
  constructor(
    private readonly impactRepository: ImpactRepository = new ImpactRepository(),
    private readonly beneficiaryRepository: BeneficiaryRepository = new BeneficiaryRepository(),
    private readonly projectService: ProjectService = new ProjectService(),
    private readonly auditService: AuditService = new AuditService(),
  ) {}

  async recordImpact(input: RecordImpactInput): Promise<Impact> {
    return runInTransaction(async (tx) => {
      const project = await this.projectService.getProjectById(input.projectId, tx);

      if (input.beneficiaryId) {
        const beneficiary = await this.beneficiaryRepository.findById(input.beneficiaryId, tx);
        if (!beneficiary) throw new NotFoundError('Beneficiaire', input.beneficiaryId);
      }

      const indicator = optionalText(input.indicator, 'indicator', 120);
      const value = input.value == null ? null : toDecimal(input.value, 'value');

      // Un indicateur sans valeur n'est pas mesurable : autant ne rien indexer.
      if (indicator && value === null) {
        throw new ValidationError(
          `L'indicateur "${indicator}" doit etre accompagne d'une valeur numerique.`,
          { indicator },
        );
      }
      if (value !== null && value.lessThan(0)) {
        throw new ValidationError('La valeur d\'un indicateur ne peut pas etre negative.', {
          value: value.toString(),
        });
      }

      const impact = await this.impactRepository.create(
        {
          projectId: project.id,
          beneficiaryId: input.beneficiaryId ?? null,
          title: requireText(input.title, 'title', 180),
          description: requireText(input.description, 'description'),
          indicator,
          value,
          unit: optionalText(input.unit, 'unit', 60),
          measuredAt: requireDate(input.measuredAt, 'measuredAt'),
        },
        tx,
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.IMPACT,
          entityId: impact.id,
          action: AUDIT_ACTIONS.IMPACT_RECORDED,
          newData: {
            projectId: project.id,
            projectCode: project.code,
            title: impact.title,
            indicator: impact.indicator,
            value: impact.value?.toString() ?? null,
            unit: impact.unit,
          },
        },
        tx,
      );

      return impact;
    });
  }

  async getImpactById(id: string, tx?: DbClient): Promise<Impact> {
    const impact = await this.impactRepository.findById(id, tx);
    if (!impact) throw new NotFoundError('Impact', id);
    return impact;
  }

  async listImpacts(
    filters: ImpactFilters = {},
    options: PaginationOptions = {},
  ): Promise<Impact[]> {
    return this.impactRepository.findMany(buildImpactWhere(filters), options);
  }

  /** Indicateurs cumules d'un projet : "43 femmes formees", "12 enfants scolarises". */
  async getIndicatorTotals(projectId: string): Promise<IndicatorTotal[]> {
    const rows = await this.impactRepository.sumIndicatorsByProject(projectId);

    return rows
      .filter((row): row is typeof row & { indicator: string } => row.indicator !== null)
      .map((row) => ({
        indicator: row.indicator,
        unit: row.unit,
        total: row.total == null ? ZERO : toDecimal(row.total as string),
        measurementCount: row.count,
      }))
      .sort((left, right) => left.indicator.localeCompare(right.indicator));
  }

  /**
   * Indicateurs cumules sur TOUS les projets : "300 enfants accompagnes",
   * "100 meres formees". Ces chiffres viennent de la base, jamais du code.
   */
  async getGlobalIndicatorTotals(): Promise<IndicatorTotal[]> {
    const rows = await this.impactRepository.sumIndicatorsGlobally();

    return rows
      .filter((row): row is typeof row & { indicator: string } => row.indicator !== null)
      .map((row) => ({
        indicator: row.indicator,
        unit: row.unit,
        total: row.total == null ? ZERO : toDecimal(row.total as string),
        measurementCount: row.count,
      }))
      .sort((left, right) => right.total.comparedTo(left.total));
  }

  async getProjectImpactReport(projectId: string): Promise<ProjectImpactReport> {
    await this.projectService.getProjectById(projectId);

    const [indicators, impacts, totalMeasurements] = await Promise.all([
      this.getIndicatorTotals(projectId),
      this.impactRepository.findMany({ projectId }),
      this.impactRepository.count({ projectId }),
    ]);

    return { projectId, indicators, impacts, totalMeasurements };
  }
}

export function buildImpactWhere(filters: ImpactFilters): Prisma.ImpactWhereInput {
  const where: Prisma.ImpactWhereInput = {};

  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.beneficiaryId) where.beneficiaryId = filters.beneficiaryId;
  if (filters.indicator) where.indicator = filters.indicator;

  if (filters.from || filters.to) {
    where.measuredAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  return where;
}
