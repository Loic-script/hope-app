import type { Prisma, Project, ProjectStatus } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { normalizePagination, type DbClient, type PaginationOptions } from '../../shared/types.js';

export type CreateProjectData = Prisma.ProjectUncheckedCreateInput;
export type UpdateProjectData = Prisma.ProjectUncheckedUpdateInput;

export class ProjectRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async create(data: CreateProjectData, tx?: DbClient): Promise<Project> {
    return (tx ?? this.db).project.create({ data });
  }

  async update(id: string, data: UpdateProjectData, tx?: DbClient): Promise<Project> {
    return (tx ?? this.db).project.update({ where: { id }, data });
  }

  async updateStatus(id: string, status: ProjectStatus, tx?: DbClient): Promise<Project> {
    return (tx ?? this.db).project.update({ where: { id }, data: { status } });
  }

  async findById(id: string, tx?: DbClient): Promise<Project | null> {
    return (tx ?? this.db).project.findUnique({ where: { id } });
  }

  async findByCode(code: string, tx?: DbClient): Promise<Project | null> {
    return (tx ?? this.db).project.findUnique({ where: { code } });
  }

  async findMany(
    where: Prisma.ProjectWhereInput = {},
    options: PaginationOptions = {},
    tx?: DbClient,
  ): Promise<Project[]> {
    const { skip, take } = normalizePagination(options);
    return (tx ?? this.db).project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async count(where: Prisma.ProjectWhereInput = {}, tx?: DbClient): Promise<number> {
    return (tx ?? this.db).project.count({ where });
  }

  async countBeneficiaries(projectId: string, tx?: DbClient): Promise<number> {
    return (tx ?? this.db).projectBeneficiary.count({ where: { projectId } });
  }

  async countImpacts(projectId: string, tx?: DbClient): Promise<number> {
    return (tx ?? this.db).impact.count({ where: { projectId } });
  }

  /**
   * Verrouille le projet pendant une operation financiere (depense,
   * affectation) afin que deux ecritures concurrentes ne puissent pas
   * depasser ensemble les fonds disponibles.
   */
  async lockForUpdate(id: string, tx: DbClient): Promise<void> {
    await tx.$queryRaw`SELECT id FROM projects WHERE id = ${id}::uuid FOR UPDATE`;
  }
}
