import type {
  Donation,
  DonationFrequency,
  DonationType,
  DonationAllocation,
  Donor,
  DonorType,
  Transaction,
} from '@prisma/client';
import type { DecimalInput } from '../../shared/money.js';
import type { DonationFinancialSummary } from '../donations/donation.types.js';

/**
 * Entree du parcours de don complet, tel que le remplit le formulaire du site.
 */
export interface CheckoutInput {
  donor: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    donorType: DonorType;
    /** Code ISO 3166-1 alpha-2. */
    country: string;
    organizationName?: string | null;
    city?: string | null;
    preferredLanguage?: string | null;
  };
  donation: {
    donationType: DonationType;
    /** Code ISO 4217. */
    currency: string;
    /** Montant de l'echeance (ou montant total pour un don ponctuel). */
    amount: DecimalInput;
    frequency?: DonationFrequency | null;
    notes?: string | null;
  };
  /** Code de la methode de paiement : MVOLA, CARD... */
  paymentMethodCode: string;
  /**
   * Projet a financer. `null` = don non affecte : HOPE repartira le montant
   * plus tard, via AllocationService.
   */
  projectId?: string | null;
  /**
   * Donnees libres NON sensibles transmises au prestataire.
   * Sert notamment a piloter MockPaymentProvider pendant les demonstrations.
   */
  metadata?: Record<string, unknown> | null;
}

/**
 * Issue du parcours, DECIDEE PAR LE BACKEND.
 *
 * Le frontend ne deduit jamais lui-meme qu'un paiement a reussi : il lit
 * `outcome`, qui est derive du statut reel de la transaction en base.
 */
export type CheckoutOutcome = 'SUCCESS' | 'PENDING' | 'FAILED';

export interface CheckoutResult {
  outcome: CheckoutOutcome;
  donor: Donor;
  donation: Donation;
  transaction: Transaction;
  /** Nul si le don a ete laisse non affecte, ou si le paiement a echoue. */
  allocation: DonationAllocation | null;
  summary: DonationFinancialSummary;
  /** Renseigne uniquement lorsque `outcome` vaut FAILED. */
  failureReason: string | null;
}
