import type {
  Donation,
  DonationFrequency,
  DonationStatus,
  DonationType,
  TransactionStatus,
} from '@prisma/client';
import type { Decimal, DecimalInput } from '../../shared/money.js';

export interface CreateDonationInput {
  donorId: string;
  donationType: DonationType;
  /** Code ISO 4217. Doit etre coherent avec les transactions du don. */
  currency: string;
  /**
   * Montant attendu PAR ECHEANCE pour un don recurrent,
   * montant total attendu pour un don ponctuel.
   */
  expectedAmount: DecimalInput;
  frequency?: DonationFrequency | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  nextPaymentDate?: Date | string | null;
  notes?: string | null;
  /** DRAFT par defaut ; passer ACTIVE pour activer immediatement. */
  status?: DonationStatus;
}

export interface UpdateDonationInput {
  expectedAmount?: DecimalInput;
  frequency?: DonationFrequency | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  nextPaymentDate?: Date | string | null;
  notes?: string | null;
}

export interface DonationFilters {
  donorId?: string;
  status?: DonationStatus;
  donationType?: DonationType;
  currency?: string;
  /** Dons recurrents dont l'echeance est due au plus tard a cette date. */
  dueBefore?: Date;
}

/** Totaux par statut renvoyes par le repository des transactions. */
export interface TransactionStatusTotals {
  status: TransactionStatus;
  amount: Decimal;
  refundedAmount: Decimal;
  count: number;
}

/**
 * Vue financiere complete d'un don.
 *
 * REGLES APPLIQUEES (voir README, section "Regles financieres") :
 *   - seules les transactions SUCCESS alimentent `totalReceived` ;
 *   - les transactions PENDING/PROCESSING sont suivies separement et ne
 *     comptent jamais comme de l'argent recu ;
 *   - `totalReceived` est NET des remboursements partiels ;
 *   - `availableForAllocation` est le plafond absolu des affectations.
 */
export interface DonationFinancialSummary {
  donationId: string;
  reference: string;
  currency: string;
  donationType: DonationType;
  status: DonationStatus;

  /** Montant attendu par echeance (= montant total pour un don ponctuel). */
  expectedAmountPerInstallment: Decimal;
  /** null pour un engagement recurrent sans date de fin. */
  expectedInstallments: number | null;
  /** expectedAmountPerInstallment x expectedInstallments, null si ouvert. */
  totalCommitted: Decimal | null;

  /** Argent reellement encaisse, net des remboursements. */
  totalReceived: Decimal;
  /** Argent en cours d'encaissement : ne compte PAS comme recu. */
  totalPending: Decimal;
  totalFailed: Decimal;
  totalCancelled: Decimal;
  totalRefunded: Decimal;

  /** Somme deja affectee a des projets. */
  totalAllocated: Decimal;
  /** totalReceived - totalAllocated : plafond d'une nouvelle affectation. */
  availableForAllocation: Decimal;
  /** Part encaissee mais pas encore fléchée vers un projet. */
  unallocatedAmount: Decimal;

  /** totalCommitted - totalReceived (jamais negatif), null si engagement ouvert. */
  remainingCommitment: Decimal | null;
  /** true si l'engagement est integralement honore. */
  isFullyFunded: boolean;

  transactionCount: number;
  successfulTransactionCount: number;
}

export interface DonationWithSummary {
  donation: Donation;
  summary: DonationFinancialSummary;
}
