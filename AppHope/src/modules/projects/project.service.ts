import {
  ProjectStatus,
  type Prisma,
  type Project,
  type ProjectCategory,
} from '@prisma/client';
import { ProjectCategoryRepository } from './project-category.repository.js';
import { ProjectRepository } from './project.repository.js';
import type {
  CreateProjectCategoryInput,
  CreateProjectInput,
  ProjectFilters,
  ProjectFinancialOverview,
  ProjectFundsByCurrency,
  UpdateProjectInput,
} from './project.types.js';
import { AllocationRepository } from '../allocations/allocation.repository.js';
import { ExpenseRepository } from '../expenses/expense.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.types.js';
import { runInTransaction } from '../../database/unit-of-work.js';
import { normalizeCurrency } from '../../shared/currency.js';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../shared/errors.js';
import { ZERO, type Decimal } from '../../shared/money.js';
import { REFERENCE_PREFIXES, createWithUniqueReference } from '../../shared/reference.js';
import { createStateMachine } from '../../shared/state-machine.js';
import type { DbClient, PaginationOptions } from '../../shared/types.js';
import {
  assertDateRange,
  optionalDate,
  optionalText,
  requireText,
} from '../../shared/validation.js';

/**
 * Cycle de vie d'un projet.
 *
 *   DRAFT ---> ACTIVE ---> COMPLETED
 *     |          |  ^
 *     |          v  |
 *     |      SUSPENDED
 *     +----------+------> CANCELLED
 */
export const projectStateMachine = createStateMachine<ProjectStatus>('Project', {
  [ProjectStatus.DRAFT]: [ProjectStatus.ACTIVE, ProjectStatus.CANCELLED],
  [ProjectStatus.ACTIVE]: [
    ProjectStatus.SUSPENDED,
    ProjectStatus.COMPLETED,
    ProjectStatus.CANCELLED,
  ],
  [ProjectStatus.SUSPENDED]: [ProjectStatus.ACTIVE, ProjectStatus.CANCELLED],
  [ProjectStatus.COMPLETED]: [],
  [ProjectStatus.CANCELLED]: [],
});

/** Statuts de projet pouvant recevoir de nouveaux fonds ou depenses. */
export const FUNDABLE_PROJECT_STATUSES: readonly ProjectStatus[] = [
  ProjectStatus.DRAFT,
  ProjectStatus.ACTIVE,
];

export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository = new ProjectRepository(),
    private readonly categoryRepository: ProjectCategoryRepository = new ProjectCategoryRepository(),
    private readonly allocationRepository: AllocationRepository = new AllocationRepository(),
    private readonly expenseRepository: ExpenseRepository = new ExpenseRepository(),
    private readonly auditService: AuditService = new AuditService(),
  ) {}

  // -------------------------------------------------------------------------
  // Categories
  // -------------------------------------------------------------------------

  async createCategory(input: CreateProjectCategoryInput): Promise<ProjectCategory> {
    const name = requireText(input.name, 'name', 120);
    const existing = await this.categoryRepository.findByName(name);
    if (existing) {
      throw new ConflictError(`La categorie "${name}" existe deja.`, { name });
    }
    return this.categoryRepository.create({
      name,
      description: optionalText(input.description, 'description'),
    });
  }

  async getCategoryById(id: string, tx?: DbClient): Promise<ProjectCategory> {
    const category = await this.categoryRepository.findById(id, tx);
    if (!category) throw new NotFoundError('Categorie de projet', id);
    return category;
  }

  async getCategoryByName(name: string): Promise<ProjectCategory> {
    const category = await this.categoryRepository.findByName(name);
    if (!category) throw new NotFoundError('Categorie de projet', name);
    return category;
  }

  async listCategories(): Promise<ProjectCategory[]> {
    return this.categoryRepository.findAll();
  }

  // -------------------------------------------------------------------------
  // Projets
  // -------------------------------------------------------------------------

  async createProject(input: CreateProjectInput): Promise<Project> {
    return runInTransaction(async (tx) => {
      await this.getCategoryById(input.categoryId, tx);

      const startDate = optionalDate(input.startDate, 'startDate');
      const endDate = optionalDate(input.endDate, 'endDate');
      assertDateRange(startDate, endDate, 'projet');

      const project = await createWithUniqueReference(REFERENCE_PREFIXES.PROJECT, (code) =>
        this.projectRepository.create(
          {
            code,
            categoryId: input.categoryId,
            name: requireText(input.name, 'name', 180),
            description: requireText(input.description, 'description'),
            location: optionalText(input.location, 'location', 180),
            managerName: optionalText(input.managerName, 'managerName', 180),
            startDate,
            endDate,
            status: input.status ?? ProjectStatus.DRAFT,
            photoUrl: optionalText(input.photoUrl, 'photoUrl', 500),
            videoUrl: optionalText(input.videoUrl, 'videoUrl', 500),
          },
          tx,
        ),
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.PROJECT,
          entityId: project.id,
          action: AUDIT_ACTIONS.PROJECT_CREATED,
          newData: { id: project.id, code: project.code, name: project.name },
        },
        tx,
      );

      return project;
    });
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
    return runInTransaction(async (tx) => {
      const current = await this.getProjectById(id, tx);
      const data: Prisma.ProjectUncheckedUpdateInput = {};

      if (input.categoryId !== undefined) {
        await this.getCategoryById(input.categoryId, tx);
        data.categoryId = input.categoryId;
      }
      if (input.name !== undefined) data.name = requireText(input.name, 'name', 180);
      if (input.description !== undefined) {
        data.description = requireText(input.description, 'description');
      }
      if (input.location !== undefined) data.location = optionalText(input.location, 'location', 180);
      if (input.managerName !== undefined) {
        data.managerName = optionalText(input.managerName, 'managerName', 180);
      }
      if (input.photoUrl !== undefined) data.photoUrl = optionalText(input.photoUrl, 'photoUrl', 500);
      if (input.videoUrl !== undefined) data.videoUrl = optionalText(input.videoUrl, 'videoUrl', 500);

      const startDate =
        input.startDate !== undefined
          ? optionalDate(input.startDate, 'startDate')
          : current.startDate;
      const endDate =
        input.endDate !== undefined ? optionalDate(input.endDate, 'endDate') : current.endDate;
      assertDateRange(startDate, endDate, 'projet');

      if (input.startDate !== undefined) data.startDate = startDate;
      if (input.endDate !== undefined) data.endDate = endDate;

      return this.projectRepository.update(id, data, tx);
    });
  }

  /** Change le statut en respectant les transitions autorisees. */
  async changeProjectStatus(id: string, target: ProjectStatus): Promise<Project> {
    return runInTransaction(async (tx) => {
      const current = await this.getProjectById(id, tx);
      projectStateMachine.assert(current.status, target);

      const updated = await this.projectRepository.updateStatus(id, target, tx);

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.PROJECT,
          entityId: id,
          action: AUDIT_ACTIONS.PROJECT_STATUS_CHANGED,
          oldData: { status: current.status },
          newData: { status: updated.status },
        },
        tx,
      );

      return updated;
    });
  }

  async activateProject(id: string): Promise<Project> {
    return this.changeProjectStatus(id, ProjectStatus.ACTIVE);
  }

  async getProjectById(id: string, tx?: DbClient): Promise<Project> {
    const project = await this.projectRepository.findById(id, tx);
    if (!project) throw new NotFoundError('Projet', id);
    return project;
  }

  async getProjectByCode(code: string): Promise<Project> {
    const project = await this.projectRepository.findByCode(code);
    if (!project) throw new NotFoundError('Projet', code);
    return project;
  }

  async listProjects(
    filters: ProjectFilters = {},
    options: PaginationOptions = {},
  ): Promise<Project[]> {
    return this.projectRepository.findMany(buildProjectWhere(filters), options);
  }

  async countProjects(filters: ProjectFilters = {}): Promise<number> {
    return this.projectRepository.count(buildProjectWhere(filters));
  }

  /**
   * Verifie qu'un projet peut recevoir des fonds ou des depenses.
   * Un projet CANCELLED ou COMPLETED ne doit plus bouger financierement.
   */
  async assertProjectIsFundable(id: string, tx?: DbClient): Promise<Project> {
    const project = await this.getProjectById(id, tx);
    if (!FUNDABLE_PROJECT_STATUSES.includes(project.status)) {
      throw new BusinessRuleError(
        `Le projet ${project.code} est ${project.status} : il ne peut plus recevoir ` +
          `de fonds ni de depenses.`,
        { projectId: id, status: project.status },
      );
    }
    return project;
  }

  // -------------------------------------------------------------------------
  // Vue financiere
  // -------------------------------------------------------------------------

  /**
   * Fonds d'un projet, ventiles par devise.
   *
   * fondsDisponibles = affectations recues - depenses engagees (VALIDATED + PAID)
   *
   * Les affectations ne peuvent provenir que d'argent REELLEMENT encaisse
   * (AllocationService le garantit) : ce solde est donc bien du cash.
   */
  async getProjectFunds(projectId: string, tx?: DbClient): Promise<ProjectFundsByCurrency[]> {
    const [allocations, spending] = await Promise.all([
      this.allocationRepository.sumByProject(projectId, tx),
      this.expenseRepository.sumByProject(projectId, tx),
    ]);

    const currencies = new Set<string>([
      ...allocations.map((row) => row.currency),
      ...spending.map((row) => row.currency),
    ]);

    return [...currencies].sort().map((currency) => {
      const allocated = allocations.find((row) => row.currency === currency);
      const spent = spending.find((row) => row.currency === currency);

      const totalAllocated = allocated?.amount ?? ZERO;
      const totalSpent = spent?.committed ?? ZERO;
      const available = totalAllocated.minus(totalSpent);

      return {
        currency,
        totalAllocated,
        totalSpent,
        totalDraftExpenses: spent?.draft ?? ZERO,
        availableFunds: available.greaterThan(0) ? available : ZERO,
        allocationCount: allocated?.allocationCount ?? 0,
      };
    });
  }

  /** Fonds disponibles pour une devise precise : plafond d'une depense. */
  async getAvailableFunds(
    projectId: string,
    currency: string,
    tx?: DbClient,
    excludeExpenseId?: string,
  ): Promise<Decimal> {
    const code = normalizeCurrency(currency);

    const [allocated, spent] = await Promise.all([
      this.allocationRepository.sumByProjectAndCurrency(projectId, code, tx),
      this.expenseRepository.sumCommittedByProjectAndCurrency(
        projectId,
        code,
        tx,
        excludeExpenseId,
      ),
    ]);

    const available = allocated.minus(spent);
    return available.greaterThan(0) ? available : ZERO;
  }

  async getFinancialOverview(projectId: string): Promise<ProjectFinancialOverview> {
    const project = await this.getProjectById(projectId);
    const [fundsByCurrency, beneficiaryCount, impactCount] = await Promise.all([
      this.getProjectFunds(projectId),
      this.projectRepository.countBeneficiaries(projectId),
      this.projectRepository.countImpacts(projectId),
    ]);
    return { project, fundsByCurrency, beneficiaryCount, impactCount };
  }
}

export function buildProjectWhere(filters: ProjectFilters): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = {};

  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.status) where.status = filters.status;
  if (filters.search && filters.search.trim() !== '') {
    const search = filters.search.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
}
