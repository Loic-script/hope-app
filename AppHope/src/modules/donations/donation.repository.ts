import type { Donation, DonationStatus, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { normalizePagination, type DbClient, type PaginationOptions } from '../../shared/types.js';

export type CreateDonationData = Prisma.DonationUncheckedCreateInput;
export type UpdateDonationData = Prisma.DonationUncheckedUpdateInput;

export class DonationRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async create(data: CreateDonationData, tx?: DbClient): Promise<Donation> {
    return (tx ?? this.db).donation.create({ data });
  }

  async update(id: string, data: UpdateDonationData, tx?: DbClient): Promise<Donation> {
    return (tx ?? this.db).donation.update({ where: { id }, data });
  }

  async updateStatus(id: string, status: DonationStatus, tx?: DbClient): Promise<Donation> {
    return (tx ?? this.db).donation.update({ where: { id }, data: { status } });
  }

  async findById(id: string, tx?: DbClient): Promise<Donation | null> {
    return (tx ?? this.db).donation.findUnique({ where: { id } });
  }

  async findByReference(reference: string, tx?: DbClient): Promise<Donation | null> {
    return (tx ?? this.db).donation.findUnique({ where: { reference } });
  }

  async findMany(
    where: Prisma.DonationWhereInput = {},
    options: PaginationOptions = {},
    tx?: DbClient,
  ): Promise<Donation[]> {
    const { skip, take } = normalizePagination(options);
    return (tx ?? this.db).donation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async count(where: Prisma.DonationWhereInput = {}, tx?: DbClient): Promise<number> {
    return (tx ?? this.db).donation.count({ where });
  }

  /**
   * Charge le don AVEC son donateur, en une seule requete.
   *
   * Utilise par PaymentService pour verifier la coherence entre le pays du
   * donateur et la portee de la methode de paiement (LOCAL / INTERNATIONAL).
   */
  async findByIdWithDonor(id: string, tx?: DbClient): Promise<DonationWithDonor | null> {
    return (tx ?? this.db).donation.findUnique({ where: { id }, include: { donor: true } });
  }

  /**
   * Verrouille la ligne du don le temps de la transaction PostgreSQL.
   *
   * Utilise avant toute ecriture financiere liee au don (confirmation de
   * paiement, affectation) pour serialiser les operations concurrentes sur
   * un meme don.
   */
  async lockForUpdate(id: string, tx: DbClient): Promise<void> {
    await tx.$queryRaw`SELECT id FROM donations WHERE id = ${id}::uuid FOR UPDATE`;
  }
}

/** Don accompagne de son donateur : evite un second aller-retour en base. */
export type DonationWithDonor = Prisma.DonationGetPayload<{ include: { donor: true } }>;
