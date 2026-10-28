import {
  DonationFrequency,
  DonationStatus,
  DonationType,
  DonorType,
  ProjectStatus,
  type Donation,
  type Donor,
  type Project,
  type Transaction,
} from '@prisma/client';
import { createContainer, type Services } from '../../container.js';
import { prisma } from '../../database/prisma.js';
import type { DecimalInput } from '../../shared/money.js';

/**
 * Fabriques d'objets de test.
 *
 * Elles fournissent des valeurs par defaut coherentes pour que chaque test
 * n'ait a preciser QUE ce qui l'interesse reellement.
 */

let counter = 0;
function nextId(): number {
  counter += 1;
  return counter;
}

export function getTestServices(): Services {
  return createContainer().services;
}

export async function createTestDonor(
  overrides: Partial<Parameters<Services['donorService']['createDonor']>[0]> = {},
): Promise<Donor> {
  const services = getTestServices();
  const index = nextId();

  return services.donorService.createDonor({
    firstName: 'Test',
    lastName: `Donateur${index}`,
    email: `donateur.${index}.${Date.now()}@example.test`,
    phone: '+261 34 00 000 00',
    donorType: DonorType.INDIVIDUAL,
    country: 'MG',
    preferredCurrency: 'MGA',
    ...overrides,
  });
}

export async function createTestProject(
  overrides: Partial<Parameters<Services['projectService']['createProject']>[0]> = {},
): Promise<Project> {
  const services = getTestServices();
  const index = nextId();

  const category =
    (await prisma.projectCategory.findFirst()) ??
    (await prisma.projectCategory.create({ data: { name: `Categorie ${index}` } }));

  return services.projectService.createProject({
    categoryId: category.id,
    name: `Projet de test ${index}`,
    description: 'Projet cree par la suite de tests.',
    status: ProjectStatus.ACTIVE,
    ...overrides,
  });
}

export async function createTestDonation(
  options: {
    donorId?: string;
    amount?: DecimalInput;
    currency?: string;
    donationType?: DonationType;
    frequency?: DonationFrequency | null;
    startDate?: Date | null;
    endDate?: Date | null;
    status?: DonationStatus;
  } = {},
): Promise<Donation> {
  const services = getTestServices();
  const donorId = options.donorId ?? (await createTestDonor()).id;

  return services.donationService.createDonation({
    donorId,
    donationType: options.donationType ?? DonationType.ONE_TIME,
    currency: options.currency ?? 'MGA',
    expectedAmount: options.amount ?? '100000',
    frequency: options.frequency ?? null,
    startDate: options.startDate ?? null,
    endDate: options.endDate ?? null,
    status: options.status ?? DonationStatus.ACTIVE,
  });
}

/**
 * Raccourci tres utilise : cree une transaction ET la confirme, de sorte que
 * le don dispose reellement de fonds affectables.
 */
export async function createConfirmedTransaction(options: {
  donationId: string;
  amount?: DecimalInput;
  paymentMethodCode?: string;
  installmentNumber?: number;
}): Promise<Transaction> {
  const services = getTestServices();

  const transaction = await services.paymentService.createTransaction({
    donationId: options.donationId,
    paymentMethodCode: options.paymentMethodCode ?? 'MVOLA',
    ...(options.amount !== undefined ? { amount: options.amount } : {}),
    ...(options.installmentNumber !== undefined
      ? { installmentNumber: options.installmentNumber }
      : {}),
  });

  return services.paymentService.confirmTransaction(transaction.id);
}

/**
 * Cree un don deja finance : le montant demande est encaisse et pret a etre
 * affecte a des projets.
 */
export async function createFundedDonation(options: {
  amount?: DecimalInput;
  currency?: string;
  donorId?: string;
  paymentMethodCode?: string;
} = {}): Promise<{ donation: Donation; transaction: Transaction }> {
  const amount = options.amount ?? '100000';

  const donation = await createTestDonation({
    ...(options.donorId !== undefined ? { donorId: options.donorId } : {}),
    amount,
    ...(options.currency !== undefined ? { currency: options.currency } : {}),
  });

  const transaction = await createConfirmedTransaction({
    donationId: donation.id,
    ...(options.paymentMethodCode !== undefined
      ? { paymentMethodCode: options.paymentMethodCode }
      : {}),
  });

  return { donation, transaction };
}

/**
 * Cree un projet finance a hauteur du montant demande : utile pour tester
 * les depenses sans rejouer tout le parcours de don a chaque fois.
 */
export async function createFundedProject(options: {
  amount?: DecimalInput;
  currency?: string;
  paymentMethodCode?: string;
} = {}): Promise<{ project: Project; donation: Donation }> {
  const services = getTestServices();
  const amount = options.amount ?? '100000';
  const currency = options.currency ?? 'MGA';

  const project = await createTestProject();
  const { donation } = await createFundedDonation({
    amount,
    currency,
    ...(options.paymentMethodCode !== undefined
      ? { paymentMethodCode: options.paymentMethodCode }
      : {}),
    ...(currency === 'MGA' ? {} : { donorId: (await createTestDonor(internationalDonor())).id }),
  });

  await services.allocationService.allocate({
    donationId: donation.id,
    projectId: project.id,
    amount,
    allocationType: 'HOPE_ALLOCATED',
  });

  return { project, donation };
}

/** Donateur etranger : utilise pour les paiements internationaux (CARD). */
export function internationalDonor(): Partial<
  Parameters<Services['donorService']['createDonor']>[0]
> {
  return { country: 'FR', preferredCurrency: 'EUR' };
}
