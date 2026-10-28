import { PaymentScope } from '@prisma/client';
import { afterAll, beforeEach } from 'vitest';
import { prisma, disconnectPrisma } from '../../database/prisma.js';

/**
 * Outils de base de donnees pour les tests d'integration.
 *
 * Chaque test part d'une base VIDE mais contenant les donnees de reference
 * (methodes de paiement, categories). On evite ainsi qu'un test depende de
 * ce qu'un autre a laisse derriere lui.
 */

/**
 * Ordre sans importance : TRUNCATE ... CASCADE gere les cles etrangeres.
 * `_prisma_migrations` est volontairement exclue.
 */
const TABLES = [
  'audit_logs',
  'impacts',
  'project_beneficiaries',
  'beneficiaries',
  'supporting_documents',
  'expenses',
  'budget_items',
  'project_budgets',
  'donation_allocations',
  'transactions',
  'donations',
  'donors',
  'projects',
  'project_categories',
  'payment_methods',
] as const;

export async function truncateAllTables(): Promise<void> {
  const list = TABLES.map((table) => `"${table}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Methodes de paiement minimales dont les tests ont besoin. */
export const TEST_PAYMENT_METHODS = [
  {
    code: 'MVOLA',
    name: 'MVola (Telma)',
    provider: 'MOCK',
    scope: PaymentScope.LOCAL,
    supportedCurrencies: ['MGA'],
  },
  {
    code: 'CASH',
    name: 'Especes',
    provider: 'MOCK',
    scope: PaymentScope.LOCAL,
    supportedCurrencies: ['MGA'],
  },
  {
    code: 'CARD',
    name: 'Carte bancaire',
    provider: 'MOCK',
    scope: PaymentScope.INTERNATIONAL,
    supportedCurrencies: ['EUR', 'USD'],
  },
  {
    code: 'PAYMENT_PLATFORM',
    name: 'Plateforme de paiement',
    provider: 'MOCK',
    scope: PaymentScope.BOTH,
    supportedCurrencies: [],
  },
  {
    code: 'UNKNOWN_PROVIDER',
    name: 'Methode sans fournisseur enregistre',
    provider: 'NOT_REGISTERED',
    scope: PaymentScope.BOTH,
    supportedCurrencies: [],
  },
  {
    code: 'DISABLED_METHOD',
    name: 'Methode desactivee',
    provider: 'MOCK',
    scope: PaymentScope.BOTH,
    supportedCurrencies: [],
    isActive: false,
  },
] as const;

export const TEST_CATEGORIES = ['Scolarite', 'Soins', 'Alimentation'] as const;

export async function seedReferenceData(): Promise<void> {
  await prisma.paymentMethod.createMany({
    data: TEST_PAYMENT_METHODS.map((method) => ({
      code: method.code,
      name: method.name,
      provider: method.provider,
      scope: method.scope,
      supportedCurrencies: [...method.supportedCurrencies],
      isActive: 'isActive' in method ? method.isActive : true,
    })),
  });

  await prisma.projectCategory.createMany({
    data: TEST_CATEGORIES.map((name) => ({ name })),
  });
}

export async function resetDatabase(): Promise<void> {
  await truncateAllTables();
  await seedReferenceData();
}

/**
 * A appeler en haut d'un fichier de test d'integration :
 *
 *   describe('MonService', () => {
 *     useTestDatabase();
 *     ...
 *   });
 */
export function useTestDatabase(): void {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectPrisma();
  });
}
