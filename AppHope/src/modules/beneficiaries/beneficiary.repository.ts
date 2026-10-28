import type { Beneficiary, Prisma, ProjectBeneficiary } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { normalizePagination, type DbClient, type PaginationOptions } from '../../shared/types.js';

export class BeneficiaryRepository {
  constructor(private readonly db: DbClient = prisma) {}

  // --- Beneficiaires -------------------------------------------------------

  async create(
    data: Prisma.BeneficiaryUncheckedCreateInput,
    tx?: DbClient,
  ): Promise<Beneficiary> {
    return (tx ?? this.db).beneficiary.create({ data });
  }

  async update(
    id: string,
    data: Prisma.BeneficiaryUncheckedUpdateInput,
    tx?: DbClient,
  ): Promise<Beneficiary> {
    return (tx ?? this.db).beneficiary.update({ where: { id }, data });
  }

  async findById(id: string, tx?: DbClient): Promise<Beneficiary | null> {
    return (tx ?? this.db).beneficiary.findUnique({ where: { id } });
  }

  async findByReference(reference: string, tx?: DbClient): Promise<Beneficiary | null> {
    return (tx ?? this.db).beneficiary.findUnique({ where: { reference } });
  }

  async findMany(
    where: Prisma.BeneficiaryWhereInput = {},
    options: PaginationOptions = {},
    tx?: DbClient,
  ): Promise<Beneficiary[]> {
    const { skip, take } = normalizePagination(options);
    return (tx ?? this.db).beneficiary.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async count(where: Prisma.BeneficiaryWhereInput = {}, tx?: DbClient): Promise<number> {
    return (tx ?? this.db).beneficiary.count({ where });
  }

  // --- Inscriptions aux projets (table de liaison N-N) ---------------------

  async createEnrollment(
    data: Prisma.ProjectBeneficiaryUncheckedCreateInput,
    tx?: DbClient,
  ): Promise<ProjectBeneficiary> {
    return (tx ?? this.db).projectBeneficiary.create({ data });
  }

  async updateEnrollment(
    id: string,
    data: Prisma.ProjectBeneficiaryUncheckedUpdateInput,
    tx?: DbClient,
  ): Promise<ProjectBeneficiary> {
    return (tx ?? this.db).projectBeneficiary.update({ where: { id }, data });
  }

  async findEnrollment(
    projectId: string,
    beneficiaryId: string,
    tx?: DbClient,
  ): Promise<ProjectBeneficiary | null> {
    return (tx ?? this.db).projectBeneficiary.findUnique({
      where: { projectId_beneficiaryId: { projectId, beneficiaryId } },
    });
  }

  async findEnrollmentById(id: string, tx?: DbClient): Promise<ProjectBeneficiary | null> {
    return (tx ?? this.db).projectBeneficiary.findUnique({ where: { id } });
  }

  async findEnrollmentsByBeneficiary(
    beneficiaryId: string,
    tx?: DbClient,
  ): Promise<ProjectBeneficiary[]> {
    return (tx ?? this.db).projectBeneficiary.findMany({
      where: { beneficiaryId },
      orderBy: { joinedAt: 'desc' },
    });
  }

  async findEnrollmentsByProject(
    projectId: string,
    options: PaginationOptions = {},
    tx?: DbClient,
  ): Promise<(ProjectBeneficiary & { beneficiary: Beneficiary })[]> {
    const { skip, take } = normalizePagination({ take: 200, ...options });
    return (tx ?? this.db).projectBeneficiary.findMany({
      where: { projectId },
      include: { beneficiary: true },
      orderBy: { joinedAt: 'asc' },
      skip,
      take,
    });
  }
}
