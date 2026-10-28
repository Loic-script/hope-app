import type { Decimal } from '../../../shared/money.js';

/**
 * ABSTRACTION DE FOURNISSEUR DE PAIEMENT (Strategy / Adapter Pattern).
 *
 * PaymentService ne connait QUE cette interface. Ajouter Stripe, MVola ou
 * Orange Money consistera a ecrire une nouvelle classe qui l'implemente et a
 * l'enregistrer dans le registre : aucune ligne de PaymentService ne changera.
 *
 * Phase 1 : seul MockPaymentProvider existe. Aucun appel reseau n'est fait.
 *
 * SECURITE : ces objets ne transportent JAMAIS de donnee bancaire sensible
 * (numero de carte, CVV, identifiants prestataire). On n'echange que des
 * references opaques renvoyees par le prestataire.
 */

/** Statut renvoye par le prestataire, independant de notre propre enum. */
export type ProviderPaymentStatus =
  | 'INITIALIZED'
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

/** Contexte transmis au prestataire pour toute operation. */
export interface PaymentContext {
  transactionId: string;
  /** Reference interne HOPE : HOPE-TXN-20260903-A1B2C3 */
  internalReference: string;
  amount: Decimal;
  currency: string;
  /** Code de la methode de paiement : MVOLA, CARD... */
  paymentMethodCode: string;
  /** Reference cote prestataire, si une operation precedente l'a deja fournie. */
  providerReference?: string | null;
  /** Donnees libres NON sensibles (numero de telephone MVola, note...). */
  metadata?: Record<string, unknown> | null;
}

export interface RefundContext extends PaymentContext {
  refundAmount: Decimal;
  reason: string;
}

export interface PaymentProviderResult {
  status: ProviderPaymentStatus;
  /** Identifiant opaque cote prestataire. */
  providerReference: string | null;
  failureReason?: string | null;
  /** Reponse brute du prestataire, conservee dans transactions.metadata. */
  raw?: Record<string, unknown>;
}

export interface PaymentProvider {
  /** Identifiant technique, correspond a `payment_methods.provider`. */
  readonly code: string;
  readonly displayName: string;

  /** Le fournisseur sait-il traiter cette methode dans cette devise ? */
  supports(paymentMethodCode: string, currency: string): boolean;

  /** Demarre le paiement (creation d'intention, envoi du push USSD...). */
  initializePayment(context: PaymentContext): Promise<PaymentProviderResult>;

  /** Confirme l'encaissement (capture, notification de reussite...). */
  confirmPayment(context: PaymentContext): Promise<PaymentProviderResult>;

  /** Annule un paiement qui n'a pas encore ete encaisse. */
  cancelPayment(context: PaymentContext): Promise<PaymentProviderResult>;

  /** Rembourse tout ou partie d'un paiement encaisse. */
  refundPayment(context: RefundContext): Promise<PaymentProviderResult>;

  /** Interroge le prestataire sur l'etat courant du paiement. */
  getPaymentStatus(context: PaymentContext): Promise<PaymentProviderResult>;
}
