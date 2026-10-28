import type { DonationAllocation, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ZERO, toDecimal, type Decimal } from '../../shared/money.js';
import { normalizePagination, type DbClient, type PaginationOptions } from '../../shared/types.js';

export type CreateAllocationData = Prisma.DonationAllocationUncheckedCreateInput;

/** Total affecte a un projet, pour une devise donnee. */
export interface ProjectAllocationTotal {
  currency: string;
  amount: Decimal;
  allocationCount: number;
}

export class AllocationRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async create(data: CreateAllocationData, tx?: DbClient): Promise<DonationAllocation> {
    return (tx ?? this.db).donationAllocation.create({ data });
  }

  async createMany(data: CreateAllocationData[], tx?: DbClient): Promise<number> {
    const result = await (tx ?? this.db).donationAllocation.createMany({ data });
    return result.count;
  }

  async findById(id: string, tx?: DbClient): Promise<DonationAllocation | null> {
    return (tx ?? this.db).donationAllocation.findUnique({ where: { id } });
  }

  async delete(id: string, tx?: DbClient): Promise<DonationAllocation> {
    return (tx ?? this.db).donationAllocation.delete({ where: { id } });
  }

  async findByDonationId(donationId: string, tx?: DbClient): Promise<DonationAllocation[]> {
    return (tx ?? this.db).donationAllocation.findMany({
      where: { donationId },
      orderBy: { allocatedAt: 'asc' },
    });
  }

  async findByProjectId(
    projectId: string,
    options: PaginationOptions = {},
    tx?: DbClient,
  ): Promise<DonationAllocation[]> {
    const { skip, take } = normalizePagination(options);
    return (tx ?? this.db).donationAllocation.findMany({
      where: { projectId },
      orderBy: { allocatedAt: 'desc' },
      skip,
      take,
    });
  }

  /** Somme deja affectee pour un don (toutes devises confondues : un don a une seule devise). */
  async sumByDonation(donationId: string, tx?: DbClient): Promise<Decimal> {
    const result = await (tx ?? this.db).donationAllocation.aggregate({
      where: { donationId },
      _sum: { amount: true },
    });
    return toDecimal(result._sum.amount ?? ZERO);
  }

  /**
   * Fonds recus par un projet, ventiles par devise.
   * HOPE ne convertit pas les devises : chaque devise est un compte separe.
   */
  async sumByProject(projectId: string, tx?: DbClient): Promise<ProjectAllocationTotal[]> {
    const rows = await (tx ?? this.db).donationAllocation.groupBy({
      by: ['currency'],
      where: { projectId },
      _sum: { amount: true },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      currency: row.currency,
      amount: toDecimal(row._sum.amount ?? ZERO),
      allocationCount: row._count._all,
    }));
  }

  async sumByProjectAndCurrency(
    projectId: string,
    currency: string,
    tx?: DbClient,
  ): Promise<Decimal> {
    const result = await (tx ?? this.db).donationAllocation.aggregate({
      where: { projectId, currency: currency.toUpperCase() },
      _sum: { amount: true },
    });
    return toDecimal(result._sum.amount ?? ZERO);
  }

  /**
   * Total affecte a des projets, toutes affectations confondues, par devise.
   * Alimente les chiffres de transparence affiches sur le site public.
   */
  async sumAllByCurrency(tx?: DbClient): Promise<ProjectAllocationTotal[]> {
    const rows = await (tx ?? this.db).donationAllocation.groupBy({
      by: ['currency'],
      _sum: { amount: true },
      _count: { _all: true },
    });
    return rows.map((row) => ({
      currency: row.currency,
      amount: toDecimal(row._sum.amount ?? ZERO),
      allocationCount: row._count._all,
    }));
  }

  async countByDonation(donationId: string, tx?: DbClient): Promise<number> {
    return (tx ?? this.db).donationAllocation.count({ where: { donationId } });
  }
}
