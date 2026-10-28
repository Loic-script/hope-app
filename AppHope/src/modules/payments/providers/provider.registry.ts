import { MockPaymentProvider } from './mock-payment.provider.js';
import type { PaymentProvider } from './payment-provider.interface.js';
import { PaymentProviderError } from '../../../shared/errors.js';

/**
 * Registre des fournisseurs de paiement.
 *
 * La colonne `payment_methods.provider` contient le CODE du fournisseur
 * ("MOCK" aujourd'hui, "STRIPE" / "MVOLA" / "ORANGE_MONEY" demain).
 * Le registre fait la correspondance code -> implementation.
 *
 * Brancher un vrai prestataire plus tard :
 *
 *   registry.register(new StripePaymentProvider(config));
 *   // puis en base : UPDATE payment_methods SET provider = 'STRIPE'
 *   //                WHERE code = 'CARD';
 *
 * PaymentService n'a pas besoin d'etre modifie.
 */
export class PaymentProviderRegistry {
  private readonly providers = new Map<string, PaymentProvider>();

  register(provider: PaymentProvider): this {
    this.providers.set(provider.code.toUpperCase(), provider);
    return this;
  }

  has(code: string): boolean {
    return this.providers.has(code.toUpperCase());
  }

  get(code: string): PaymentProvider {
    const provider = this.providers.get(code.toUpperCase());
    if (!provider) {
      throw new PaymentProviderError(
        `Aucun fournisseur de paiement enregistre pour le code "${code}". ` +
          `Fournisseurs disponibles : ${this.list().join(', ') || 'aucun'}.`,
        { requested: code, available: this.list() },
      );
    }
    return provider;
  }

  list(): string[] {
    return [...this.providers.keys()].sort();
  }
}

/**
 * Registre par defaut de l'application.
 * Phase 1 : uniquement le simulateur, aucun appel reseau.
 */
export function createDefaultProviderRegistry(): PaymentProviderRegistry {
  return new PaymentProviderRegistry().register(new MockPaymentProvider());
}

export const paymentProviderRegistry = createDefaultProviderRegistry();
