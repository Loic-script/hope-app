import type {
  Beneficiary,
  Donation,
  DonationAllocation,
  Donor,
  Expense,
  Impact,
  PaymentMethod,
  Project,
  ProjectBudget,
  ProjectCategory,
  Transaction,
} from '@prisma/client';
import type { Decimal } from '../../shared/money.js';
import type { DonationFinancialSummary } from '../../modules/donations/donation.types.js';
import type { BudgetSummary } from '../../modules/budgets/budget.types.js';
import type { ProjectFundsByCurrency } from '../../modules/projects/project.types.js';

/**
 * TRADUCTION DES ENTITES VERS LE JSON DE L'API.
 *
 * DEUX REGLES TIENNENT TOUT CE FICHIER
 *
 * 1. LES MONTANTS SONT DES CHAINES, JAMAIS DES `number`.
 *    `JSON.parse` d'un nombre JavaScript passe par un flottant 64 bits :
 *    "100000.10" pourrait revenir en 100000.09999999999. La regle "jamais de
 *    float pour l'argent" ne s'arrete pas a la base de donnees, elle va
 *    jusqu'au navigateur. Le frontend affiche et compare des chaines.
 *
 * 2. ON N'EXPOSE QUE CE QUI EST NECESSAIRE.
 *    Chaque mappeur liste explicitement ses champs. Ajouter une colonne en
 *    base ne la publie donc pas par accident sur un site public.
 */

/** Un montant tel qu'il circule sur l'API : valeur exacte + devise. */
export interface MoneyDto {
  amount: string;
  currency: string;
}

export function money(value: Decimal | null | undefined, currency: string): MoneyDto {
  return { amount: (value ?? '0').toString(), currency };
}

function isoDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** Date calendaire seule (AAAA-MM-JJ) : pas d'heure, donc pas de fuseau. */
function calendarDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export interface ProjectCategoryDto {
  id: string;
  name: string;
  description: string | null;
}

export function toProjectCategoryDto(category: ProjectCategory): ProjectCategoryDto {
  return { id: category.id, name: category.name, description: category.description };
}

export interface PaymentMethodDto {
  id: string;
  code: string;
  name: string;
  scope: string;
  supportedCurrencies: string[];
  description: string | null;
}

/**
 * `provider` n'est volontairement PAS expose : le donateur choisit un moyen de
 * paiement, pas une implementation technique. Le publier reviendrait a
 * annoncer quel prestataire HOPE utilise derriere chaque methode.
 */
export function toPaymentMethodDto(method: PaymentMethod): PaymentMethodDto {
  return {
    id: method.id,
    code: method.code,
    name: method.name,
    scope: method.scope,
    supportedCurrencies: method.supportedCurrencies.map((currency) => currency.trim()),
    description: method.description,
  };
}

// ---------------------------------------------------------------------------
// Projets
// ---------------------------------------------------------------------------

export interface ProjectDto {
  id: string;
  code: string;
  name: string;
  description: string;
  status: string;
  location: string | null;
  managerName: string | null;
  startDate: string | null;
  endDate: string | null;
  photoUrl: string | null;
  videoUrl: string | null;
  category: ProjectCategoryDto | null;
}

export function toProjectDto(
  project: Project,
  category: ProjectCategory | null = null,
): ProjectDto {
  return {
    id: project.id,
    code: project.code,
    name: project.name,
    description: project.description,
    status: project.status,
    location: project.location,
    managerName: project.managerName,
    startDate: calendarDate(project.startDate),
    endDate: calendarDate(project.endDate),
    photoUrl: project.photoUrl,
    videoUrl: project.videoUrl,
    category: category ? toProjectCategoryDto(category) : null,
  };
}

export interface ProjectFundingDto {
  currency: string;
  /** Objectif = somme des budgets ouverts du projet. Nul si aucun budget. */
  goalAmount: string | null;
  /** Argent reellement recu : affectations issues de transactions SUCCESS. */
  fundedAmount: string;
  /** Depenses engagees (VALIDATED + PAID). */
  spentAmount: string;
  /** Reste depensable : recu moins depense. */
  availableAmount: string;
  /** Pourcentage de l'objectif atteint, 0-100. Nul si aucun objectif. */
  progressPercent: number | null;
}

export function toProjectFundingDto(
  funds: ProjectFundsByCurrency,
  goalAmount: Decimal | null,
): ProjectFundingDto {
  const progressPercent =
    goalAmount && goalAmount.greaterThan(0)
      ? Math.min(
          100,
          Number(funds.totalAllocated.dividedBy(goalAmount).times(100).toDecimalPlaces(1)),
        )
      : null;

  return {
    currency: funds.currency,
    goalAmount: goalAmount ? goalAmount.toString() : null,
    fundedAmount: funds.totalAllocated.toString(),
    spentAmount: funds.totalSpent.toString(),
    availableAmount: funds.availableFunds.toString(),
    progressPercent,
  };
}

export interface BudgetItemDto {
  id: string;
  name: string;
  description: string | null;
  plannedAmount: string;
  spentAmount: string;
  remainingAmount: string;
  consumptionRate: number;
}

export interface BudgetDto {
  id: string;
  name: string;
  currency: string;
  status: string;
  totalAmount: string;
  totalPlanned: string;
  totalSpent: string;
  remainingAmount: string;
  consumptionRate: number;
  items: BudgetItemDto[];
}

export function toBudgetDto(summary: BudgetSummary): BudgetDto {
  return {
    id: summary.budget.id,
    name: summary.budget.name,
    currency: summary.currency,
    status: summary.budget.status,
    totalAmount: summary.totalAmount.toString(),
    totalPlanned: summary.totalPlanned.toString(),
    totalSpent: summary.totalSpent.toString(),
    remainingAmount: summary.remainingAmount.toString(),
    consumptionRate: summary.consumptionRate,
    items: summary.items.map((entry) => ({
      id: entry.item.id,
      name: entry.item.name,
      description: entry.item.description,
      plannedAmount: entry.plannedAmount.toString(),
      spentAmount: entry.spentAmount.toString(),
      remainingAmount: entry.remainingAmount.toString(),
      consumptionRate: entry.consumptionRate,
    })),
  };
}

export interface BudgetSummaryOnlyDto {
  id: string;
  name: string;
  currency: string;
  totalAmount: string;
  status: string;
}

export function toBudgetSummaryDto(budget: ProjectBudget): BudgetSummaryOnlyDto {
  return {
    id: budget.id,
    name: budget.name,
    currency: budget.currency,
    totalAmount: budget.totalAmount.toString(),
    status: budget.status,
  };
}

/**
 * Depense publiee sur le site.
 *
 * La description est reprise telle quelle, mais aucun justificatif n'est
 * expose : les factures peuvent porter des noms et des coordonnees de tiers.
 * Seul leur NOMBRE est publie, ce qui suffit a prouver qu'une piece existe.
 */
export interface PublicExpenseDto {
  id: string;
  reference: string;
  description: string;
  amount: string;
  currency: string;
  status: string;
  expenseDate: string | null;
  documentCount: number;
}

export function toPublicExpenseDto(expense: Expense, documentCount: number): PublicExpenseDto {
  return {
    id: expense.id,
    reference: expense.reference,
    description: expense.description,
    amount: expense.amount.toString(),
    currency: expense.currency,
    status: expense.status,
    expenseDate: calendarDate(expense.expenseDate),
    documentCount,
  };
}

// ---------------------------------------------------------------------------
// Beneficiaires et impacts
// ---------------------------------------------------------------------------

/**
 * Beneficiaire tel qu'il apparait publiquement.
 *
 * NI NOM NI PRENOM NI DATE DE NAISSANCE : ce sont des personnes vulnerables,
 * souvent mineures. Le site n'affiche que la reference anonyme, le type
 * d'accompagnement, la ville et une tranche d'age.
 */
export interface PublicBeneficiaryDto {
  reference: string;
  beneficiaryType: string;
  city: string | null;
  country: string;
  ageGroup: string | null;
  status: string;
}

export function toPublicBeneficiaryDto(beneficiary: Beneficiary): PublicBeneficiaryDto {
  return {
    reference: beneficiary.reference,
    beneficiaryType: beneficiary.beneficiaryType,
    city: beneficiary.city,
    country: beneficiary.country,
    ageGroup: toAgeGroup(beneficiary.birthDate),
    status: beneficiary.status,
  };
}

/** Tranche d'age plutot qu'age exact : moins identifiant. */
export function toAgeGroup(birthDate: Date | null): string | null {
  if (!birthDate) return null;
  const years = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 3600 * 1000));
  if (years < 6) return '0-5 ans';
  if (years < 12) return '6-11 ans';
  if (years < 18) return '12-17 ans';
  if (years < 30) return '18-29 ans';
  if (years < 45) return '30-44 ans';
  return '45 ans et plus';
}

export interface ImpactDto {
  id: string;
  title: string;
  description: string;
  indicator: string | null;
  value: string | null;
  unit: string | null;
  measuredAt: string | null;
  projectId: string;
}

export function toImpactDto(impact: Impact): ImpactDto {
  return {
    id: impact.id,
    title: impact.title,
    description: impact.description,
    indicator: impact.indicator,
    value: impact.value ? impact.value.toString() : null,
    unit: impact.unit,
    measuredAt: calendarDate(impact.measuredAt),
    projectId: impact.projectId,
  };
}

export interface IndicatorTotalDto {
  indicator: string;
  unit: string | null;
  total: string;
  measurementCount: number;
}

// ---------------------------------------------------------------------------
// Donateurs, dons, transactions
// ---------------------------------------------------------------------------

/**
 * Donateur renvoye apres creation.
 *
 * Ni telephone, ni adresse, ni profession : le navigateur vient de les
 * envoyer, il n'a aucun besoin qu'on les lui renvoie. On ne rend que de quoi
 * afficher un accuse de reception.
 */
export interface DonorDto {
  id: string;
  firstName: string;
  lastName: string;
  organizationName: string | null;
  email: string;
  donorType: string;
  country: string;
  isInternational: boolean;
}

export function toDonorDto(donor: Donor, isInternational: boolean): DonorDto {
  return {
    id: donor.id,
    firstName: donor.firstName,
    lastName: donor.lastName,
    organizationName: donor.organizationName,
    email: donor.email,
    donorType: donor.donorType,
    country: donor.country,
    isInternational,
  };
}

export interface DonationDto {
  id: string;
  reference: string;
  donationType: string;
  status: string;
  currency: string;
  expectedAmount: string;
  frequency: string | null;
  startDate: string | null;
  endDate: string | null;
  nextPaymentDate: string | null;
  createdAt: string;
}

export function toDonationDto(donation: Donation): DonationDto {
  return {
    id: donation.id,
    reference: donation.reference,
    donationType: donation.donationType,
    status: donation.status,
    currency: donation.currency,
    expectedAmount: donation.expectedAmount.toString(),
    frequency: donation.frequency,
    startDate: calendarDate(donation.startDate),
    endDate: calendarDate(donation.endDate),
    nextPaymentDate: calendarDate(donation.nextPaymentDate),
    createdAt: donation.createdAt.toISOString(),
  };
}

export interface TransactionDto {
  id: string;
  internalReference: string;
  donationId: string;
  amount: string;
  currency: string;
  status: string;
  installmentNumber: number | null;
  transactionDate: string | null;
  failureReason: string | null;
  refundedAmount: string;
  createdAt: string;
}

/**
 * `providerReference` et `metadata` restent internes : le premier identifie la
 * transaction chez le prestataire, le second peut contenir des donnees de
 * diagnostic. Le donateur, lui, cite la reference HOPE.
 */
export function toTransactionDto(transaction: Transaction): TransactionDto {
  return {
    id: transaction.id,
    internalReference: transaction.internalReference,
    donationId: transaction.donationId,
    amount: transaction.amount.toString(),
    currency: transaction.currency,
    status: transaction.status,
    installmentNumber: transaction.installmentNumber,
    transactionDate: isoDate(transaction.transactionDate),
    failureReason: transaction.failureReason,
    refundedAmount: transaction.refundedAmount.toString(),
    createdAt: transaction.createdAt.toISOString(),
  };
}

export interface AllocationDto {
  id: string;
  donationId: string;
  projectId: string;
  amount: string;
  currency: string;
  allocationType: string;
  allocatedAt: string;
}

export function toAllocationDto(allocation: DonationAllocation): AllocationDto {
  return {
    id: allocation.id,
    donationId: allocation.donationId,
    projectId: allocation.projectId,
    amount: allocation.amount.toString(),
    currency: allocation.currency,
    allocationType: allocation.allocationType,
    allocatedAt: allocation.allocatedAt.toISOString(),
  };
}

export interface DonationSummaryDto {
  donationId: string;
  reference: string;
  currency: string;
  donationType: string;
  status: string;
  expectedAmountPerInstallment: string;
  expectedInstallments: number | null;
  totalCommitted: string | null;
  totalReceived: string;
  totalPending: string;
  totalFailed: string;
  totalRefunded: string;
  totalAllocated: string;
  unallocatedAmount: string;
  remainingCommitment: string | null;
  isFullyFunded: boolean;
  transactionCount: number;
  successfulTransactionCount: number;
}

export function toDonationSummaryDto(summary: DonationFinancialSummary): DonationSummaryDto {
  return {
    donationId: summary.donationId,
    reference: summary.reference,
    currency: summary.currency,
    donationType: summary.donationType,
    status: summary.status,
    expectedAmountPerInstallment: summary.expectedAmountPerInstallment.toString(),
    expectedInstallments: summary.expectedInstallments,
    totalCommitted: summary.totalCommitted ? summary.totalCommitted.toString() : null,
    totalReceived: summary.totalReceived.toString(),
    totalPending: summary.totalPending.toString(),
    totalFailed: summary.totalFailed.toString(),
    totalRefunded: summary.totalRefunded.toString(),
    totalAllocated: summary.totalAllocated.toString(),
    unallocatedAmount: summary.unallocatedAmount.toString(),
    remainingCommitment: summary.remainingCommitment
      ? summary.remainingCommitment.toString()
      : null,
    isFullyFunded: summary.isFullyFunded,
    transactionCount: summary.transactionCount,
    successfulTransactionCount: summary.successfulTransactionCount,
  };
}
