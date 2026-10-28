import { get, post } from './api';
import type {
  Allocation,
  CheckoutRequest,
  CheckoutResponse,
  Donation,
  DonationDetail,
  Donor,
  Transaction,
} from '@/types/api';

/**
 * Parcours de don.
 *
 * `checkout` est la voie normale : une seule requete, le serveur enchaine
 * donateur, don, transaction, paiement et affectation. Un parcours interrompu
 * a mi-chemin laisserait le donateur sans savoir si son argent est parti.
 *
 * Les operations unitaires en dessous servent aux cas particuliers : ajouter
 * une echeance a un don mensuel existant, affecter un don laisse libre.
 */

export const donationService = {
  checkout(request: CheckoutRequest): Promise<CheckoutResponse> {
    return post<CheckoutResponse>('/checkout', request);
  },

  detail(donationId: string): Promise<DonationDetail> {
    return get<DonationDetail>(`/donations/${donationId}`);
  },

  transactions(donationId: string): Promise<Transaction[]> {
    return get<Transaction[]>(`/donations/${donationId}/transactions`);
  },

  createDonor(donor: CheckoutRequest['donor']): Promise<Donor> {
    return post<Donor>('/donors', donor);
  },

  createDonation(payload: {
    donorId: string;
    donationType: string;
    currency: string;
    expectedAmount: string;
    frequency?: string | null;
  }): Promise<Donation> {
    return post<Donation>('/donations', payload);
  },

  /** Nouvelle echeance sur un don mensuel deja existant. */
  addTransaction(
    donationId: string,
    payload: { paymentMethodCode: string; amount?: string; simulate?: 'SUCCESS' | 'FAILURE' },
  ): Promise<Transaction> {
    return post<Transaction>(`/donations/${donationId}/transactions`, payload);
  },

  allocate(
    donationId: string,
    payload: { projectId: string; amount: string; allocationType?: string },
  ): Promise<Allocation> {
    return post<Allocation>(`/donations/${donationId}/allocations`, payload);
  },
};
