import type { Impact, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { normalizePagination, type DbClient, type PaginationOptions } from '../../shared/types.js';

export class ImpactRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async create(data: Prisma.ImpactUncheckedCreateInput, tx?: DbClient): Promise<Impact> {
    return (tx ?? this.db).impact.create({ data });
  }

  async update(
    id: string,
    data: Prisma.ImpactUncheckedUpdateInput,
    tx?: DbClient,
  ): Promise<Impact> {
    return (tx ?? this.db).impact.update({ where: { id }, data });
  }

  async findById(id: string, tx?: DbClient): Promise<Impact | null> {
    return (tx ?? this.db).impact.findUnique({ where: { id } });
  }

  async findMany(
    where: Prisma.ImpactWhereInput = {},
    options: PaginationOptions = {},
    tx?: DbClient,
  ): Promise<Impact[]> {
    const { skip, take } = normalizePagination({ take: 200, ...options });
    return (tx ?? this.db).impact.findMany({
      where,
      orderBy: { measuredAt: 'desc' },
      skip,
      take,
    });
  }

  async count(where: Prisma.ImpactWhereInput = {}, tx?: DbClient): Promise<number> {
    return (tx ?? this.db).impact.count({ where });
  }

  /**
   * Cumule les valeurs par indicateur sur L'ENSEMBLE des projets.
   * Alimente les chiffres cles de la page d'accueil.
   */
  async sumIndicatorsGlobally(
    tx?: DbClient,
  ): Promise<{ indicator: string | null; unit: string | null; total: unknown; count: number }[]> {
    const rows = await (tx ?? this.db).impact.groupBy({
      by: ['indicator', 'unit'],
      where: { indicator: { not: null } },
      _sum: { value: true },
      _count: { _all: true },
    });

    return rows.map((row) => ({
      indicator: row.indicator,
      unit: row.unit,
      total: row._sum.value,
      count: row._count._all,
    }));
  }

  /**
   * Cumule les valeurs par indicateur pour un projet.
   * Exemple : women_trained = 25 + 18 = 43 personnes.
   */
  async sumIndicatorsByProject(
    projectId: string,
    tx?: DbClient,
  ): Promise<{ indicator: string | null; unit: string | null; total: unknown; count: number }[]> {
    const rows = await (tx ?? this.db).impact.groupBy({
      by: ['indicator', 'unit'],
      where: { projectId, indicator: { not: null } },
      _sum: { value: true },
      _count: { _all: true },
    });

    return rows.map((row) => ({
      indicator: row.indicator,
      unit: row.unit,
      total: row._sum.value,
      count: row._count._all,
    }));
  }
}
