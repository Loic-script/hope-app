import { get } from './api';
import type { IndicatorTotal, PaymentMethod, ProjectCategory, PublicStats } from '@/types/api';

/** Donnees de reference : categories, moyens de paiement, chiffres cles. */

export const catalogService = {
  categories(): Promise<ProjectCategory[]> {
    return get<ProjectCategory[]>('/project-categories');
  },

  /**
   * Moyens de paiement proposes a un donateur.
   *
   * Le pays est transmis au backend, qui decide seul de la liste : MVola
   * n'existe qu'a Madagascar, la carte sert aux dons internationaux. Le
   * navigateur ne filtre rien lui-meme.
   */
  paymentMethods(country?: string): Promise<PaymentMethod[]> {
    return get<PaymentMethod[]>('/payment-methods', country ? { country } : undefined);
  },

  stats(): Promise<PublicStats> {
    return get<PublicStats>('/stats');
  },

  indicators(): Promise<IndicatorTotal[]> {
    return get<IndicatorTotal[]>('/impacts');
  },
};
