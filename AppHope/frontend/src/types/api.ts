/**
 * TYPES DE L'API HOPE.
 *
 * Ils reprennent exactement la forme renvoyee par le backend
 * (voir src/api/dto/mappers.ts cote serveur).
 *
 * POURQUOI TOUS LES MONTANTS SONT DES `string`
 *   Un montant qui passe par le type `number` de JavaScript passe par un
 *   flottant 64 bits : "100000.10" peut en revenir en 100000.09999999999.
 *   La regle "jamais de flottant pour de l'argent" ne s'arrete pas a la base
 *   de donnees, elle va jusqu'a l'ecran. On affiche et on compare des chaines,
 *   on ne fait jamais d'arithmetique monetaire dans le navigateur : tous les
 *   calculs financiers appartiennent au backend.
 */

// ---------------------------------------------------------------------------
// Enveloppes
// ---------------------------------------------------------------------------

export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[] | Record<string, unknown> | string;
  };
}

/** Codes d'erreur metier renvoyes par le backend. */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE_VIOLATION'
  | 'INVALID_STATUS_TRANSITION'
  | 'INSUFFICIENT_FUNDS'
  | 'PAYMENT_PROVIDER_ERROR'
  | 'RATE_LIMITED'
  | 'ROUTE_NOT_FOUND'
  | 'MALFORMED_JSON'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR';

// ---------------------------------------------------------------------------
// Enumerations (identiques au schema Prisma)
// ---------------------------------------------------------------------------

export const DONOR_TYPES = [
  'INDIVIDUAL',
  'COMPANY',
  'FOUNDATION',
  'ORGANIZATION',
  'PARTNER',
] as const;
export type DonorType = (typeof DONOR_TYPES)[number];

export type DonationType = 'ONE_TIME' | 'RECURRING';
export type DonationFrequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type DonationStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type TransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentScope = 'LOCAL' | 'INTERNATIONAL' | 'BOTH';
export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'SUSPENDED' | 'CANCELLED';
export type ExpenseStatus = 'DRAFT' | 'VALIDATED' | 'PAID' | 'CANCELLED';
export type BudgetStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';
export type AllocationType = 'DONOR_DESIGNATED' | 'HOPE_ALLOCATED';
export type BeneficiaryType = 'ORPHAN' | 'SINGLE_MOTHER' | 'FAMILY' | 'OTHER';

/** Issue d'un paiement, DECIDEE PAR LE BACKEND. Jamais deduite ici. */
export type CheckoutOutcome = 'SUCCESS' | 'PENDING' | 'FAILED';

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export interface ProjectCategory {
  id: string;
  name: string;
  description: string | null;
}

export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  scope: PaymentScope;
  supportedCurrencies: string[];
  description: string | null;
}

// ---------------------------------------------------------------------------
// Projets
// ---------------------------------------------------------------------------

export interface ProjectFunding {
  currency: string;
  /** Objectif = somme des budgets ouverts. Nul si le projet n'en a aucun. */
  goalAmount: string | null;
  fundedAmount: string;
  spentAmount: string;
  availableAmount: string;
  progressPercent: number | null;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  status: ProjectStatus;
  location: string | null;
  managerName: string | null;
  startDate: string | null;
  endDate: string | null;
  photoUrl: string | null;
  videoUrl: string | null;
  category: ProjectCategory | null;
  funding: ProjectFunding;
  beneficiaryCount: number;
  impactCount: number;
}

export interface BudgetItem {
  id: string;
  name: string;
  description: string | null;
  plannedAmount: string;
  spentAmount: string;
  remainingAmount: string;
  consumptionRate: number;
}

export interface Budget {
  id: string;
  name: string;
  currency: string;
  status: BudgetStatus;
  totalAmount: string;
  totalPlanned: string;
  totalSpent: string;
  remainingAmount: string;
  consumptionRate: number;
  items: BudgetItem[];
}

export interface PublicExpense {
  id: string;
  reference: string;
  description: string;
  amount: string;
  currency: string;
  status: ExpenseStatus;
  expenseDate: string | null;
  /** Nombre de justificatifs archives. Les pieces elles-memes restent privees. */
  documentCount: number;
}

export interface PublicBeneficiary {
  reference: string;
  beneficiaryType: BeneficiaryType;
  city: string | null;
  country: string;
  ageGroup: string | null;
  status: string;
}

export interface Impact {
  id: string;
  title: string;
  description: string;
  indicator: string | null;
  value: string | null;
  unit: string | null;
  measuredAt: string | null;
  projectId: string;
}

export interface IndicatorTotal {
  indicator: string;
  unit: string | null;
  total: string;
  measurementCount: number;
}

export interface ProjectDetail extends Project {
  fundingByCurrency: ProjectFunding[];
  budgets: Budget[];
  expenses: PublicExpense[];
  impacts: Impact[];
  indicators: IndicatorTotal[];
  beneficiaries: PublicBeneficiary[];
}

// ---------------------------------------------------------------------------
// Chiffres cles
// ---------------------------------------------------------------------------

export interface PublicStats {
  beneficiaries: {
    total: number;
    byType: { type: BeneficiaryType; count: number }[];
  };
  projects: {
    total: number;
    active: number;
    completed: number;
  };
  indicators: IndicatorTotal[];
  funding: { currency: string; totalAllocated: string; allocationCount: number }[];
}

// ---------------------------------------------------------------------------
// Don et paiement
// ---------------------------------------------------------------------------

export interface Donor {
  id: string;
  firstName: string;
  lastName: string;
  organizationName: string | null;
  email: string;
  donorType: DonorType;
  country: string;
  isInternational: boolean;
}

export interface Donation {
  id: string;
  reference: string;
  donationType: DonationType;
  status: DonationStatus;
  currency: string;
  expectedAmount: string;
  frequency: DonationFrequency | null;
  startDate: string | null;
  endDate: string | null;
  nextPaymentDate: string | null;
  createdAt: string;
}

export interface Transaction {
  id: string;
  internalReference: string;
  donationId: string;
  amount: string;
  currency: string;
  status: TransactionStatus;
  installmentNumber: number | null;
  transactionDate: string | null;
  failureReason: string | null;
  refundedAmount: string;
  createdAt: string;
}

export interface Allocation {
  id: string;
  donationId: string;
  projectId: string;
  amount: string;
  currency: string;
  allocationType: AllocationType;
  allocatedAt: string;
}

export interface DonationSummary {
  donationId: string;
  reference: string;
  currency: string;
  donationType: DonationType;
  status: DonationStatus;
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

/** Vue complete d'un don : UN engagement, N echeances. */
export interface DonationDetail {
  donation: Donation;
  summary: DonationSummary;
  transactions: Transaction[];
  allocations: Allocation[];
}

export interface CheckoutRequest {
  donor: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    donorType: DonorType;
    country: string;
    organizationName?: string | null;
    city?: string | null;
  };
  donation: {
    donationType: DonationType;
    currency: string;
    amount: string;
    frequency?: DonationFrequency | null;
    notes?: string | null;
  };
  paymentMethodCode: string;
  projectId?: string | null;
  /** Consigne de demonstration transmise au simulateur de paiement. */
  simulate?: 'SUCCESS' | 'FAILURE';
}

export interface CheckoutResponse {
  outcome: CheckoutOutcome;
  failureReason: string | null;
  donor: Donor;
  donation: Donation;
  transaction: Transaction;
  allocation: Allocation | null;
  summary: DonationSummary;
}

export interface TransactionDetail {
  transaction: Transaction;
  donation: Donation;
  outcome: CheckoutOutcome;
}
