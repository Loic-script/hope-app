import {
  ProjectBeneficiaryStatus,
  type Beneficiary,
  type Prisma,
  type ProjectBeneficiary,
} from '@prisma/client';
import { BeneficiaryRepository } from './beneficiary.repository.js';
import type {
  BeneficiaryFilters,
  BeneficiaryProfile,
  CreateBeneficiaryInput,
  EnrollBeneficiaryInput,
  ProjectBeneficiaryView,
  UpdateBeneficiaryInput,
} from './beneficiary.types.js';
import { ProjectService } from '../projects/project.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.types.js';
import { runInTransaction } from '../../database/unit-of-work.js';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors.js';
import { normalizeCountry } from '../../shared/geography.js';
import { REFERENCE_PREFIXES, createWithUniqueReference } from '../../shared/reference.js';
import type { DbClient, PaginationOptions } from '../../shared/types.js';
import { optionalDate, optionalText } from '../../shared/validation.js';

/**
 * Beneficiaires accompagnes par HOPE : orphelins, meres celibataires,
 * familles, autres profils.
 *
 * RELATION N-N AVEC LES PROJETS
 *   Un projet accompagne plusieurs beneficiaires, et un beneficiaire peut
 *   participer a plusieurs projets (scolarite ET soins, par exemple).
 *   La table de liaison project_beneficiaries porte l'inscription elle-meme :
 *   date d'entree, date de sortie, statut.
 *
 * DONNEES PERSONNELLES
 *   Le nom et le prenom sont facultatifs : chaque beneficiaire recoit une
 *   reference anonyme (HOPE-BEN-...) utilisable dans les rapports publics
 *   sans exposer son identite.
 */
export class BeneficiaryService {
  constructor(
    private readonly beneficiaryRepository: BeneficiaryRepository = new BeneficiaryRepository(),
    private readonly projectService: ProjectService = new ProjectService(),
    private readonly auditService: AuditService = new AuditService(),
  ) {}

  // -------------------------------------------------------------------------
  // Beneficiaires
  // -------------------------------------------------------------------------

  async createBeneficiary(input: CreateBeneficiaryInput): Promise<Beneficiary> {
    return runInTransaction(async (tx) => {
      const birthDate = optionalDate(input.birthDate, 'birthDate');
      if (birthDate && birthDate.getTime() > Date.now()) {
        throw new ValidationError('La date de naissance ne peut pas etre dans le futur.', {
          birthDate: birthDate.toISOString(),
        });
      }

      const beneficiary = await createWithUniqueReference(
        REFERENCE_PREFIXES.BENEFICIARY,
        (reference) =>
          this.beneficiaryRepository.create(
            {
              reference,
              beneficiaryType: input.beneficiaryType,
              country: normalizeCountry(input.country),
              firstName: optionalText(input.firstName, 'firstName', 120),
              lastName: optionalText(input.lastName, 'lastName', 120),
              gender: input.gender ?? null,
              birthDate,
              city: optionalText(input.city, 'city', 120),
              ...(input.status ? { status: input.status } : {}),
              notes: optionalText(input.notes, 'notes'),
            },
            tx,
          ),
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.BENEFICIARY,
          entityId: beneficiary.id,
          action: AUDIT_ACTIONS.BENEFICIARY_CREATED,
          newData: {
            reference: beneficiary.reference,
            beneficiaryType: beneficiary.beneficiaryType,
            country: beneficiary.country,
          },
        },
        tx,
      );

      return beneficiary;
    });
  }

  async updateBeneficiary(id: string, input: UpdateBeneficiaryInput): Promise<Beneficiary> {
    const current = await this.getBeneficiaryById(id);
    const data: Prisma.BeneficiaryUncheckedUpdateInput = {};

    if (input.beneficiaryType !== undefined) data.beneficiaryType = input.beneficiaryType;
    if (input.country !== undefined) data.country = normalizeCountry(input.country);
    if (input.firstName !== undefined) {
      data.firstName = optionalText(input.firstName, 'firstName', 120);
    }
    if (input.lastName !== undefined) data.lastName = optionalText(input.lastName, 'lastName', 120);
    if (input.gender !== undefined) data.gender = input.gender;
    if (input.city !== undefined) data.city = optionalText(input.city, 'city', 120);
    if (input.status !== undefined) data.status = input.status;
    if (input.notes !== undefined) data.notes = optionalText(input.notes, 'notes');
    if (input.birthDate !== undefined) data.birthDate = optionalDate(input.birthDate, 'birthDate');

    return this.beneficiaryRepository.update(current.id, data);
  }

  async getBeneficiaryById(id: string, tx?: DbClient): Promise<Beneficiary> {
    const beneficiary = await this.beneficiaryRepository.findById(id, tx);
    if (!beneficiary) throw new NotFoundError('Beneficiaire', id);
    return beneficiary;
  }

  async getBeneficiaryByReference(reference: string): Promise<Beneficiary> {
    const beneficiary = await this.beneficiaryRepository.findByReference(reference);
    if (!beneficiary) throw new NotFoundError('Beneficiaire', reference);
    return beneficiary;
  }

  async listBeneficiaries(
    filters: BeneficiaryFilters = {},
    options: PaginationOptions = {},
  ): Promise<Beneficiary[]> {
    return this.beneficiaryRepository.findMany(buildBeneficiaryWhere(filters), options);
  }

  async countBeneficiaries(filters: BeneficiaryFilters = {}): Promise<number> {
    return this.beneficiaryRepository.count(buildBeneficiaryWhere(filters));
  }

  async getBeneficiaryProfile(id: string): Promise<BeneficiaryProfile> {
    const beneficiary = await this.getBeneficiaryById(id);
    const enrollments = await this.beneficiaryRepository.findEnrollmentsByBeneficiary(id);

    return {
      beneficiary,
      age: computeAge(beneficiary.birthDate),
      enrollments,
      activeProjectCount: enrollments.filter(
        (enrollment) => enrollment.status === ProjectBeneficiaryStatus.ACTIVE,
      ).length,
    };
  }

  // -------------------------------------------------------------------------
  // Inscriptions aux projets
  // -------------------------------------------------------------------------

  /** Inscrit un beneficiaire a un projet (relation N-N). */
  async enrollInProject(input: EnrollBeneficiaryInput): Promise<ProjectBeneficiary> {
    return runInTransaction(async (tx) => {
      const project = await this.projectService.getProjectById(input.projectId, tx);
      const beneficiary = await this.getBeneficiaryById(input.beneficiaryId, tx);

      const existing = await this.beneficiaryRepository.findEnrollment(
        project.id,
        beneficiary.id,
        tx,
      );
      if (existing) {
        throw new ConflictError(
          `Le beneficiaire ${beneficiary.reference} est deja inscrit au projet ${project.code}.`,
          { projectId: project.id, beneficiaryId: beneficiary.id, enrollmentId: existing.id },
        );
      }

      const enrollment = await this.beneficiaryRepository.createEnrollment(
        {
          projectId: project.id,
          beneficiaryId: beneficiary.id,
          joinedAt: optionalDate(input.joinedAt, 'joinedAt') ?? new Date(),
          notes: optionalText(input.notes, 'notes'),
        },
        tx,
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.PROJECT_BENEFICIARY,
          entityId: enrollment.id,
          action: AUDIT_ACTIONS.BENEFICIARY_ENROLLED,
          newData: {
            projectId: project.id,
            projectCode: project.code,
            beneficiaryId: beneficiary.id,
            beneficiaryReference: beneficiary.reference,
          },
        },
        tx,
      );

      return enrollment;
    });
  }

  /** Enregistre la sortie d'un beneficiaire d'un projet. */
  async leaveProject(
    projectId: string,
    beneficiaryId: string,
    options: { leftAt?: Date | string; status?: ProjectBeneficiaryStatus; notes?: string } = {},
  ): Promise<ProjectBeneficiary> {
    return runInTransaction(async (tx) => {
      const enrollment = await this.beneficiaryRepository.findEnrollment(
        projectId,
        beneficiaryId,
        tx,
      );
      if (!enrollment) {
        throw new NotFoundError('Inscription au projet', `${projectId}/${beneficiaryId}`);
      }

      const leftAt = optionalDate(options.leftAt, 'leftAt') ?? new Date();
      if (leftAt.getTime() < enrollment.joinedAt.getTime()) {
        throw new ValidationError(
          "La date de sortie ne peut pas preceder la date d'entree dans le projet.",
          { joinedAt: enrollment.joinedAt.toISOString(), leftAt: leftAt.toISOString() },
        );
      }

      const updated = await this.beneficiaryRepository.updateEnrollment(
        enrollment.id,
        {
          leftAt,
          status: options.status ?? ProjectBeneficiaryStatus.LEFT,
          ...(options.notes ? { notes: options.notes } : {}),
        },
        tx,
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.PROJECT_BENEFICIARY,
          entityId: enrollment.id,
          action: AUDIT_ACTIONS.BENEFICIARY_LEFT_PROJECT,
          oldData: { status: enrollment.status },
          newData: { status: updated.status, leftAt: updated.leftAt },
        },
        tx,
      );

      return updated;
    });
  }

  async getProjectBeneficiaries(
    projectId: string,
    options: PaginationOptions = {},
  ): Promise<ProjectBeneficiaryView[]> {
    const rows = await this.beneficiaryRepository.findEnrollmentsByProject(projectId, options);
    return rows.map(({ beneficiary, ...enrollment }) => ({ enrollment, beneficiary }));
  }

  async getBeneficiaryProjects(beneficiaryId: string): Promise<ProjectBeneficiary[]> {
    return this.beneficiaryRepository.findEnrollmentsByBeneficiary(beneficiaryId);
  }
}

// ---------------------------------------------------------------------------
// Fonctions pures
// ---------------------------------------------------------------------------

/** Age en annees revolues. null si la date de naissance est inconnue. */
export function computeAge(birthDate: Date | null, reference: Date = new Date()): number | null {
  if (!birthDate) return null;

  let age = reference.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = reference.getUTCMonth() - birthDate.getUTCMonth();

  if (monthDiff < 0 || (monthDiff === 0 && reference.getUTCDate() < birthDate.getUTCDate())) {
    age -= 1;
  }
  return age < 0 ? 0 : age;
}

export function buildBeneficiaryWhere(filters: BeneficiaryFilters): Prisma.BeneficiaryWhereInput {
  const where: Prisma.BeneficiaryWhereInput = {};

  if (filters.beneficiaryType) where.beneficiaryType = filters.beneficiaryType;
  if (filters.status) where.status = filters.status;
  if (filters.country) where.country = normalizeCountry(filters.country);
  if (filters.projectId) where.projects = { some: { projectId: filters.projectId } };

  if (filters.search && filters.search.trim() !== '') {
    const search = filters.search.trim();
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { reference: { contains: search, mode: 'insensitive' } },
    ];
  }

  return where;
}
