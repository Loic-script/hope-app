import { TransactionStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  isInFlight,
  isReceived,
  netReceivedAmount,
  transactionStateMachine,
} from '../../modules/payments/transaction-status.js';
import { createStateMachine } from '../../shared/state-machine.js';
import { InvalidStatusTransitionError } from '../../shared/errors.js';

describe('machine a etats des transactions', () => {
  it('autorise le parcours nominal PENDING -> PROCESSING -> SUCCESS', () => {
    expect(
      transactionStateMachine.can(TransactionStatus.PENDING, TransactionStatus.PROCESSING),
    ).toBe(true);
    expect(
      transactionStateMachine.can(TransactionStatus.PROCESSING, TransactionStatus.SUCCESS),
    ).toBe(true);
  });

  it('autorise une confirmation directe depuis PENDING', () => {
    expect(transactionStateMachine.can(TransactionStatus.PENDING, TransactionStatus.SUCCESS)).toBe(
      true,
    );
  });

  it('INTERDIT FAILED -> SUCCESS', () => {
    // Regle centrale : une tentative echouee ne redevient jamais reussie.
    expect(transactionStateMachine.can(TransactionStatus.FAILED, TransactionStatus.SUCCESS)).toBe(
      false,
    );
    expect(() =>
      transactionStateMachine.assert(TransactionStatus.FAILED, TransactionStatus.SUCCESS),
    ).toThrow(InvalidStatusTransitionError);
  });

  it('INTERDIT d’annuler une transaction deja encaissee', () => {
    // De l'argent recu se rembourse, il ne s'annule pas.
    expect(
      transactionStateMachine.can(TransactionStatus.SUCCESS, TransactionStatus.CANCELLED),
    ).toBe(false);
    expect(transactionStateMachine.can(TransactionStatus.SUCCESS, TransactionStatus.REFUNDED)).toBe(
      true,
    );
  });

  it('traite CANCELLED, FAILED et REFUNDED comme des statuts finaux', () => {
    expect(transactionStateMachine.isFinal(TransactionStatus.CANCELLED)).toBe(true);
    expect(transactionStateMachine.isFinal(TransactionStatus.FAILED)).toBe(true);
    expect(transactionStateMachine.isFinal(TransactionStatus.REFUNDED)).toBe(true);
    expect(transactionStateMachine.isFinal(TransactionStatus.PENDING)).toBe(false);
  });

  it('produit un message d’erreur explicite', () => {
    try {
      transactionStateMachine.assert(TransactionStatus.CANCELLED, TransactionStatus.SUCCESS);
      expect.unreachable('la transition aurait du etre refusee');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidStatusTransitionError);
      const typed = error as InvalidStatusTransitionError;
      expect(typed.code).toBe('INVALID_STATUS_TRANSITION');
      expect(typed.message).toContain('CANCELLED -> SUCCESS');
      expect(typed.details['allowed']).toEqual([]);
    }
  });
});

describe('classification des statuts', () => {
  it('ne considere comme recu que SUCCESS', () => {
    expect(isReceived(TransactionStatus.SUCCESS)).toBe(true);
    for (const status of [
      TransactionStatus.PENDING,
      TransactionStatus.PROCESSING,
      TransactionStatus.FAILED,
      TransactionStatus.CANCELLED,
      TransactionStatus.REFUNDED,
    ]) {
      expect(isReceived(status)).toBe(false);
    }
  });

  it('identifie les transactions en cours d’encaissement', () => {
    expect(isInFlight(TransactionStatus.PENDING)).toBe(true);
    expect(isInFlight(TransactionStatus.PROCESSING)).toBe(true);
    expect(isInFlight(TransactionStatus.SUCCESS)).toBe(false);
  });
});

describe('montant net d’une transaction', () => {
  it('vaut le montant complet pour une transaction reussie', () => {
    const net = netReceivedAmount({
      status: TransactionStatus.SUCCESS,
      amount: '50000',
      refundedAmount: '0',
    });
    expect(net.toString()).toBe('50000');
  });

  it('deduit un remboursement partiel', () => {
    const net = netReceivedAmount({
      status: TransactionStatus.SUCCESS,
      amount: '50000',
      refundedAmount: '20000',
    });
    expect(net.toString()).toBe('30000');
  });

  it('vaut zero pour une transaction en attente, echouee ou annulee', () => {
    for (const status of [
      TransactionStatus.PENDING,
      TransactionStatus.PROCESSING,
      TransactionStatus.FAILED,
      TransactionStatus.CANCELLED,
      TransactionStatus.REFUNDED,
    ]) {
      const net = netReceivedAmount({ status, amount: '50000', refundedAmount: '0' });
      expect(net.toString()).toBe('0');
    }
  });

  it('ne descend jamais sous zero', () => {
    const net = netReceivedAmount({
      status: TransactionStatus.SUCCESS,
      amount: '100',
      refundedAmount: '150',
    });
    expect(net.toString()).toBe('0');
  });
});

describe('machine a etats generique', () => {
  it('gere un statut absent de la table de transitions', () => {
    const machine = createStateMachine<'A' | 'B'>('Test', { A: ['B'], B: [] });
    expect(machine.allowedFrom('B')).toEqual([]);
    expect(machine.can('A', 'B')).toBe(true);
    expect(machine.can('B', 'A')).toBe(false);
    expect(machine.entity).toBe('Test');
  });
});
