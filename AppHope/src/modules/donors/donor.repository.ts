import type { Donor, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { normalizePagination, type DbClient, type PaginationOptions } from '../../shared/types.js';

export type CreateDonorData = Prisma.DonorUncheckedCreateInput;
export type UpdateDonorData = Prisma.DonorUncheckedUpdateInput;

export class DonorRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async create(data: CreateDonorData, tx?: DbClient): Promise<Donor> {
    return (tx ?? this.db).donor.create({ data });
  }

  async update(id: string, data: UpdateDonorData, tx?: DbClient): Promise<Donor> {
    return (tx ?? this.db).donor.update({ where: { id }, data });
  }

  async findById(id: string, tx?: DbClient): Promise<Donor | null> {
    return (tx ?? this.db).donor.findUnique({ where: { id } });
  }

  async findByEmail(email: string, tx?: DbClient): Promise<Donor | null> {
    return (tx ?? this.db).donor.findUnique({ where: { email } });
  }

  async findMany(
    where: Prisma.DonorWhereInput = {},
    options: PaginationOptions = {},
    tx?: DbClient,
  ): Promise<Donor[]> {
    const { skip, take } = normalizePagination(options);
    return (tx ?? this.db).donor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async count(where: Prisma.DonorWhereInput = {}, tx?: DbClient): Promise<number> {
    return (tx ?? this.db).donor.count({ where });
  }

  /** Nombre de dons rattaches : sert a interdire une suppression destructrice. */
  async countDonations(donorId: string, tx?: DbClient): Promise<number> {
    return (tx ?? this.db).donation.count({ where: { donorId } });
  }
}
