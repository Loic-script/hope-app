import { randomInt } from 'node:crypto';
import type {
  PaymentContext,
  PaymentProvider,
  PaymentProviderResult,
  RefundContext,
} from './payment-provider.interface.js';
import { logger } from '../../../shared/logger.js';

/**
 * Fournisseur de paiement SIMULE.
 *
 * Il permet de derouler tout le cycle de vie d'un paiement en local, sans
 * aucun appel reseau et sans compte prestataire. C'est l'implementation de
 * reference pour les tests et les scripts de demonstration.
 *
 * PILOTAGE DU RESULTAT
 * Le comportement se choisit via `metadata.mock` de la transaction :
 *
 *   { mock: { outcome: 'SUCCESS' } }   -> tout reussit (comportement par defaut)
 *   { mock: { outcome: 'FAILURE' } }   -> echoue des l'initialisation
 *   { mock: { outcome: 'PENDING' } }   -> reste en attente de confirmation
 *
 * On peut aussi cibler UNE operation precise, ce qui permet de simuler un
 * paiement correctement initialise mais refuse au moment de l'encaissement
 * (cas frequent : provision insuffisante au debit) :
 *
 *   { mock: { confirm: { outcome: 'FAILURE', failureReason: 'Solde insuffisant.' } } }
 *
 * Les cles reconnues sont `initialize`, `confirm` et `status`.
 */

export type MockOutcome = 'SUCCESS' | 'FAILURE' | 'PENDING';

/** Operations pour lesquelles une consigne ciblee peut etre donnee. */
export type MockOperation = 'initialize' | 'confirm' | 'status';

export interface MockCall {
  operation: 'initialize' | 'confirm' | 'cancel' | 'refund' | 'status';
  internalReference: string;
  amount: string;
  currency: string;
  at: Date;
}

interface MockSettings {
  outcome: MockOutcome;
  failureReason: string | null;
}

const DEFAULT_FAILURE_REASON = 'Paiement refuse par le prestataire simule.';

export class MockPaymentProvider implements PaymentProvider {
  readonly code = 'MOCK';
  readonly displayName = 'Fournisseur simule (aucun appel reseau)';

  /** Journal des appels : facilite les assertions dans les tests. */
  private readonly calls: MockCall[] = [];

  supports(_paymentMethodCode: string, _currency: string): boolean {
    // Le simulateur accepte toutes les methodes et toutes les devises.
    return true;
  }

  async initializePayment(context: PaymentContext): Promise<PaymentProviderResult> {
    this.trace('initialize', context);
    const settings = readMockSettings(context, 'initialize');

    if (settings.outcome === 'FAILURE') {
      return {
        status: 'FAILED',
        providerReference: null,
        failureReason: settings.failureReason ?? DEFAULT_FAILURE_REASON,
        raw: { provider: this.code, operation: 'initializePayment', simulated: true },
      };
    }

    return {
      status: settings.outcome === 'PENDING' ? 'PENDING' : 'INITIALIZED',
      providerReference: context.providerReference ?? this.buildReference(context),
      raw: { provider: this.code, operation: 'initializePayment', simulated: true },
    };
  }

  async confirmPayment(context: PaymentContext): Promise<PaymentProviderResult> {
    this.trace('confirm', context);
    const settings = readMockSettings(context, 'confirm');

    if (settings.outcome === 'FAILURE') {
      return {
        status: 'FAILED',
        providerReference: context.providerReference ?? null,
        failureReason: settings.failureReason ?? DEFAULT_FAILURE_REASON,
        raw: { provider: this.code, operation: 'confirmPayment', simulated: true },
      };
    }

    if (settings.outcome === 'PENDING') {
      return {
        status: 'PENDING',
        providerReference: context.providerReference ?? this.buildReference(context),
        raw: { provider: this.code, operation: 'confirmPayment', simulated: true },
      };
    }

    return {
      status: 'SUCCEEDED',
      providerReference: context.providerReference ?? this.buildReference(context),
      raw: {
        provider: this.code,
        operation: 'confirmPayment',
        simulated: true,
        capturedAmount: context.amount.toString(),
        currency: context.currency,
      },
    };
  }

  async cancelPayment(context: PaymentContext): Promise<PaymentProviderResult> {
    this.trace('cancel', context);
    return {
      status: 'CANCELLED',
      providerReference: context.providerReference ?? null,
      raw: { provider: this.code, operation: 'cancelPayment', simulated: true },
    };
  }

  async refundPayment(context: RefundContext): Promise<PaymentProviderResult> {
    this.trace('refund', context);
    return {
      status: 'REFUNDED',
      providerReference: context.providerReference ?? this.buildReference(context),
      raw: {
        provider: this.code,
        operation: 'refundPayment',
        simulated: true,
        refundedAmount: context.refundAmount.toString(),
        currency: context.currency,
        reason: context.reason,
      },
    };
  }

  async getPaymentStatus(context: PaymentContext): Promise<PaymentProviderResult> {
    this.trace('status', context);
    const settings = readMockSettings(context, 'status');
    const statusByOutcome: Record<MockOutcome, PaymentProviderResult['status']> = {
      SUCCESS: 'SUCCEEDED',
      FAILURE: 'FAILED',
      PENDING: 'PENDING',
    };
    return {
      status: statusByOutcome[settings.outcome],
      providerReference: context.providerReference ?? null,
      failureReason: settings.outcome === 'FAILURE' ? settings.failureReason : null,
      raw: { provider: this.code, operation: 'getPaymentStatus', simulated: true },
    };
  }

  /** Appels enregistres depuis le dernier reset (tests). */
  getCalls(): readonly MockCall[] {
    return this.calls;
  }

  resetCalls(): void {
    this.calls.length = 0;
  }

  private buildReference(context: PaymentContext): string {
    const suffix = randomInt(100_000, 999_999);
    return `MOCK-${context.paymentMethodCode}-${suffix}`;
  }

  private trace(operation: MockCall['operation'], context: PaymentContext): void {
    this.calls.push({
      operation,
      internalReference: context.internalReference,
      amount: context.amount.toString(),
      currency: context.currency,
      at: new Date(),
    });
    logger.debug(`MockPaymentProvider.${operation}`, {
      internalReference: context.internalReference,
      amount: context.amount.toString(),
      currency: context.currency,
    });
  }
}

/**
 * Lit la consigne de simulation dans les metadonnees de la transaction.
 *
 * Une consigne ciblee (`mock.confirm`) prime sur la consigne globale
 * (`mock.outcome`). Sans consigne, le paiement reussit.
 */
export function readMockSettings(
  context: PaymentContext,
  operation?: MockOperation,
): MockSettings {
  const root = context.metadata?.['mock'];
  if (!isPlainObject(root)) {
    return { outcome: 'SUCCESS', failureReason: null };
  }

  const scoped = operation ? root[operation] : undefined;
  const source = isPlainObject(scoped) ? scoped : root;

  return {
    outcome: readOutcome(source['outcome']),
    failureReason: readFailureReason(source['failureReason']),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOutcome(value: unknown): MockOutcome {
  return value === 'FAILURE' || value === 'PENDING' ? value : 'SUCCESS';
}

function readFailureReason(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}
