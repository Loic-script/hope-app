import type { PaymentMethod, PaymentScope, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { DbClient } from '../../shared/types.js';

export type CreatePaymentMethodData = Prisma.PaymentMethodUncheckedCreateInput;
export type UpdatePaymentMethodData = Prisma.PaymentMethodUncheckedUpdateInput;

export class PaymentMethodRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async create(data: CreatePaymentMethodData, tx?: DbClient): Promise<PaymentMethod> {
    return (tx ?? this.db).paymentMethod.create({ data });
  }

  async update(
    id: string,
    data: UpdatePaymentMethodData,
    tx?: DbClient,
  ): Promise<PaymentMethod> {
    return (tx ?? this.db).paymentMethod.update({ where: { id }, data });
  }

  async findById(id: string, tx?: DbClient): Promise<PaymentMethod | null> {
    return (tx ?? this.db).paymentMethod.findUnique({ where: { id } });
  }

  async findByCode(code: string, tx?: DbClient): Promise<PaymentMethod | null> {
    return (tx ?? this.db).paymentMethod.findUnique({ where: { code: code.toUpperCase() } });
  }

  async findActive(scope?: PaymentScope[], tx?: DbClient): Promise<PaymentMethod[]> {
    return (tx ?? this.db).paymentMethod.findMany({
      where: { isActive: true, ...(scope && scope.length > 0 ? { scope: { in: scope } } : {}) },
      orderBy: { code: 'asc' },
    });
  }

  async findAll(tx?: DbClient): Promise<PaymentMethod[]> {
    return (tx ?? this.db).paymentMethod.findMany({ orderBy: { code: 'asc' } });
  }

  /**
   * Cree la methode si elle n'existe pas, la met a jour sinon.
   * Utilise par les seeds pour rester idempotent.
   */
  async upsertByCode(
    code: string,
    data: Omit<CreatePaymentMethodData, 'code'>,
    tx?: DbClient,
  ): Promise<PaymentMethod> {
    const normalizedCode = code.toUpperCase();
    return (tx ?? this.db).paymentMethod.upsert({
      where: { code: normalizedCode },
      create: { ...data, code: normalizedCode },
      update: data,
    });
  }
}
