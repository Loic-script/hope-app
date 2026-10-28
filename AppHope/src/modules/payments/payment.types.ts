import type { PaymentScope, Transaction, TransactionStatus } from '@prisma/client';
import type { Decimal, DecimalInput } from '../../shared/money.js';

export interface CreateTransactionInput {
  donationId: string;
  /** Code de la methode de paiement : MVOLA, ORANGE_MONEY, CARD... */
  paymentMethodCode: string;
  /**
   * Montant de CETTE echeance. Facultatif : par defaut on reprend le montant
   * attendu du don (utile pour un don mensuel, ou chaque echeance vaut le
   * meme montant).
   */
  amount?: DecimalInput;
  /** Numero d'echeance pour un don recurrent (1 = premiere echeance). */
  installmentNumber?: number | null;
  /** Donnees libres non sensibles transmises au prestataire. */
  metadata?: Record<string, unknown> | null;
}

export interface ConfirmTransactionInput {
  /** Reference renvoyee par le prestataire, si connue a l'avance. */
  providerReference?: string | null;
  /** Date effective du mouvement d'argent. Par defaut : maintenant. */
  transactionDate?: Date | string | null;
}

export interface FailTransactionInput {
  reason: string;
}

export interface CancelTransactionInput {
  reason?: string | null;
}

export interface RefundTransactionInput {
  /** Montant a rembourser. Par defaut : la totalite du montant encaisse. */
  amount?: DecimalInput;
  reason: string;
}

export interface TransactionFilters {
  donationId?: string;
  status?: TransactionStatus;
  statuses?: TransactionStatus[];
  paymentMethodId?: string;
  currency?: string;
  from?: Date;
  to?: Date;
}

export interface CreatePaymentMethodInput {
  code: string;
  name: string;
  provider: string;
  scope: PaymentScope;
  isActive?: boolean;
  supportedCurrencies?: string[];
  description?: string | null;
}

/** Totaux agreges d'un don, par statut de transaction. */
export interface DonationTransactionTotals {
  /** Somme NETTE des transactions SUCCESS (remboursements deduits). */
  totalReceived: Decimal;
  /** PENDING + PROCESSING : argent annonce mais pas encaisse. */
  totalPending: Decimal;
  totalFailed: Decimal;
  totalCancelled: Decimal;
  /** Somme de tous les remboursements, partiels comme totaux. */
  totalRefunded: Decimal;
  transactionCount: number;
  successfulTransactionCount: number;
  countByStatus: Record<TransactionStatus, number>;
}

/** Resultat lisible renvoye par les operations de PaymentService. */
export interface TransactionResult {
  transaction: Transaction;
  /** Montant net apporte par cette transaction apres l'operation. */
  netAmount: Decimal;
}
