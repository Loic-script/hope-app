import { get, post } from './api';
import type { CheckoutOutcome, Transaction, TransactionDetail } from '@/types/api';

/**
 * Suivi des paiements.
 *
 * REGLE ABSOLUE : le navigateur ne decide JAMAIS qu'un paiement a reussi.
 * Il demande au backend de traiter la transaction et lit le statut renvoye.
 * Aucune fonction de ce fichier ne calcule un statut : elles le transportent.
 */

export const paymentService = {
  /** Accepte l'identifiant technique comme la reference HOPE-TXN-... */
  detail(idOrReference: string): Promise<TransactionDetail> {
    return get<TransactionDetail>(`/transactions/${encodeURIComponent(idOrReference)}`);
  },

  /** Demande l'encaissement. Le statut renvoye fait foi. */
  process(
    idOrReference: string,
  ): Promise<{ transaction: Transaction; outcome: CheckoutOutcome; failureReason?: string }> {
    return post(`/transactions/${encodeURIComponent(idOrReference)}/process`);
  },

  providerStatus(
    idOrReference: string,
  ): Promise<{ providerStatus: string; localStatus: string; isFinal: boolean }> {
    return get(`/transactions/${encodeURIComponent(idOrReference)}/provider-status`);
  },
};
