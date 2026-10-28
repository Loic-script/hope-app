import { describe, expect, it } from 'vitest';
import {
  MockPaymentProvider,
  readMockSettings,
} from '../../modules/payments/providers/mock-payment.provider.js';
import {
  PaymentProviderRegistry,
  createDefaultProviderRegistry,
} from '../../modules/payments/providers/provider.registry.js';
import type { PaymentContext } from '../../modules/payments/providers/payment-provider.interface.js';
import { PaymentProviderError } from '../../shared/errors.js';
import { toDecimal } from '../../shared/money.js';

function buildContext(overrides: Partial<PaymentContext> = {}): PaymentContext {
  return {
    transactionId: 'e1d7c0f6-0000-4000-8000-000000000001',
    internalReference: 'HOPE-TXN-20260903-ABC123',
    amount: toDecimal('100000'),
    currency: 'MGA',
    paymentMethodCode: 'MVOLA',
    providerReference: null,
    metadata: null,
    ...overrides,
  };
}

describe('MockPaymentProvider', () => {
  it('reussit le paiement par defaut', async () => {
    const provider = new MockPaymentProvider();
    const result = await provider.confirmPayment(buildContext());

    expect(result.status).toBe('SUCCEEDED');
    expect(result.providerReference).toMatch(/^MOCK-MVOLA-\d{6}$/);
    expect(result.raw?.['simulated']).toBe(true);
  });

  it('simule un echec quand les metadonnees le demandent', async () => {
    const provider = new MockPaymentProvider();
    const result = await provider.confirmPayment(
      buildContext({
        metadata: { mock: { outcome: 'FAILURE', failureReason: 'Solde insuffisant.' } },
      }),
    );

    expect(result.status).toBe('FAILED');
    expect(result.failureReason).toBe('Solde insuffisant.');
  });

  it('simule un paiement qui reste en attente', async () => {
    const provider = new MockPaymentProvider();
    const result = await provider.confirmPayment(
      buildContext({ metadata: { mock: { outcome: 'PENDING' } } }),
    );

    expect(result.status).toBe('PENDING');
  });

  it('conserve la reference prestataire deja connue', async () => {
    const provider = new MockPaymentProvider();
    const result = await provider.confirmPayment(
      buildContext({ providerReference: 'MOCK-EXISTANT-1' }),
    );

    expect(result.providerReference).toBe('MOCK-EXISTANT-1');
  });

  it('rembourse en renvoyant le montant simule', async () => {
    const provider = new MockPaymentProvider();
    const result = await provider.refundPayment({
      ...buildContext(),
      refundAmount: toDecimal('40000'),
      reason: 'Demande du donateur.',
    });

    expect(result.status).toBe('REFUNDED');
    expect(result.raw?.['refundedAmount']).toBe('40000');
    expect(result.raw?.['reason']).toBe('Demande du donateur.');
  });

  it('journalise ses appels pour faciliter les assertions', async () => {
    const provider = new MockPaymentProvider();
    await provider.initializePayment(buildContext());
    await provider.confirmPayment(buildContext());

    expect(provider.getCalls().map((call) => call.operation)).toEqual(['initialize', 'confirm']);

    provider.resetCalls();
    expect(provider.getCalls()).toHaveLength(0);
  });

  it('accepte toutes les methodes et toutes les devises', () => {
    const provider = new MockPaymentProvider();
    expect(provider.supports('MVOLA', 'MGA')).toBe(true);
    expect(provider.supports('CARD', 'EUR')).toBe(true);
  });
});

describe('lecture des consignes de simulation', () => {
  it('retombe sur SUCCESS quand rien n’est precise', () => {
    expect(readMockSettings(buildContext())).toEqual({ outcome: 'SUCCESS', failureReason: null });
    expect(readMockSettings(buildContext({ metadata: { autre: 'valeur' } })).outcome).toBe(
      'SUCCESS',
    );
  });

  it('ignore une consigne inconnue', () => {
    expect(
      readMockSettings(buildContext({ metadata: { mock: { outcome: 'N_IMPORTE_QUOI' } } })).outcome,
    ).toBe('SUCCESS');
  });
});

describe('registre des fournisseurs', () => {
  it('contient le simulateur par defaut', () => {
    const registry = createDefaultProviderRegistry();
    expect(registry.has('MOCK')).toBe(true);
    expect(registry.get('mock').code).toBe('MOCK');
    expect(registry.list()).toEqual(['MOCK']);
  });

  it('leve une erreur explicite pour un fournisseur inconnu', () => {
    const registry = createDefaultProviderRegistry();
    expect(() => registry.get('STRIPE')).toThrow(PaymentProviderError);
    expect(() => registry.get('STRIPE')).toThrow(/STRIPE/);
  });

  it('permet d’ajouter un nouveau fournisseur sans toucher au reste', () => {
    // C'est exactement ce qu'on fera pour brancher Stripe ou MVola :
    // une classe qui implemente l'interface, puis un register().
    const registry = new PaymentProviderRegistry();
    const fake = new MockPaymentProvider();
    Object.defineProperty(fake, 'code', { value: 'STRIPE' });

    registry.register(fake);
    expect(registry.get('STRIPE')).toBe(fake);
    expect(registry.list()).toEqual(['STRIPE']);
  });
});
