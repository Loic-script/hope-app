import { TransactionStatus } from '@prisma/client';
import { createStateMachine } from '../../shared/state-machine.js';
import { ZERO, toDecimal, type Decimal } from '../../shared/money.js';

/**
 * Cycle de vie d'une TRANSACTION (mouvement financier reel).
 *
 *   PENDING ---> PROCESSING ---> SUCCESS ---> REFUNDED
 *      |              |            (final apres remboursement total)
 *      |              +----> FAILED     (final)
 *      |              +----> CANCELLED  (final)
 *      +---------------------> SUCCESS / FAILED / CANCELLED
 *
 * INTERDICTIONS EXPLICITES (regle metier n.7) :
 *   - FAILED    -> SUCCESS : une tentative echouee ne devient jamais reussie.
 *                            Il faut creer une NOUVELLE transaction.
 *   - CANCELLED -> quoi que ce soit : statut final.
 *   - SUCCESS   -> CANCELLED : on ne peut pas annuler de l'argent encaisse,
 *                              on le REMBOURSE (REFUNDED), ce qui laisse une trace.
 */
export const transactionStateMachine = createStateMachine<TransactionStatus>('Transaction', {
  [TransactionStatus.PENDING]: [
    TransactionStatus.PROCESSING,
    TransactionStatus.SUCCESS,
    TransactionStatus.FAILED,
    TransactionStatus.CANCELLED,
  ],
  [TransactionStatus.PROCESSING]: [
    TransactionStatus.SUCCESS,
    TransactionStatus.FAILED,
    TransactionStatus.CANCELLED,
  ],
  [TransactionStatus.SUCCESS]: [TransactionStatus.REFUNDED],
  [TransactionStatus.FAILED]: [],
  [TransactionStatus.CANCELLED]: [],
  [TransactionStatus.REFUNDED]: [],
});

/** Statuts qui immobilisent de l'argent sans qu'il soit encaisse. */
export const IN_FLIGHT_STATUSES: readonly TransactionStatus[] = [
  TransactionStatus.PENDING,
  TransactionStatus.PROCESSING,
];

/** Seul statut qui alimente reellement les fonds de HOPE (regle n.4). */
export const RECEIVED_STATUSES: readonly TransactionStatus[] = [TransactionStatus.SUCCESS];

/** Une transaction confirmee ne doit jamais etre supprimee (regle n.8). */
export const IMMUTABLE_STATUSES: readonly TransactionStatus[] = [
  TransactionStatus.SUCCESS,
  TransactionStatus.REFUNDED,
];

export function isReceived(status: TransactionStatus): boolean {
  return RECEIVED_STATUSES.includes(status);
}

export function isInFlight(status: TransactionStatus): boolean {
  return IN_FLIGHT_STATUSES.includes(status);
}

/**
 * Montant NET reellement acquis par une transaction.
 *
 *   - SUCCESS  : montant moins les remboursements partiels deja effectues ;
 *   - tout le reste (PENDING, PROCESSING, FAILED, CANCELLED, REFUNDED) : 0.
 */
export function netReceivedAmount(transaction: {
  status: TransactionStatus;
  amount: Decimal | string | number;
  refundedAmount: Decimal | string | number;
}): Decimal {
  if (!isReceived(transaction.status)) return ZERO;
  const net = toDecimal(transaction.amount).minus(toDecimal(transaction.refundedAmount));
  return net.greaterThan(0) ? net : ZERO;
}
