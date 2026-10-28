import type { Prisma, ProjectCategory } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { DbClient } from '../../shared/types.js';

export class ProjectCategoryRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async create(
    data: Prisma.ProjectCategoryUncheckedCreateInput,
    tx?: DbClient,
  ): Promise<ProjectCategory> {
    return (tx ?? this.db).projectCategory.create({ data });
  }

  async findById(id: string, tx?: DbClient): Promise<ProjectCategory | null> {
    return (tx ?? this.db).projectCategory.findUnique({ where: { id } });
  }

  async findByName(name: string, tx?: DbClient): Promise<ProjectCategory | null> {
    return (tx ?? this.db).projectCategory.findUnique({ where: { name } });
  }

  async findAll(tx?: DbClient): Promise<ProjectCategory[]> {
    return (tx ?? this.db).projectCategory.findMany({ orderBy: { name: 'asc' } });
  }

  /** Idempotent : utilise par les seeds. */
  async upsertByName(
    name: string,
    description: string | null,
    tx?: DbClient,
  ): Promise<ProjectCategory> {
    return (tx ?? this.db).projectCategory.upsert({
      where: { name },
      create: { name, description },
      update: { description },
    });
  }
}
