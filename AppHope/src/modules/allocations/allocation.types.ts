import type { AllocationType, DonationAllocation } from '@prisma/client';
import type { Decimal, DecimalInput } from '../../shared/money.js';

export interface AllocateDonationInput {
  donationId: string;
  projectId: string;
  amount: DecimalInput;
  /**
   * DONOR_DESIGNATED : le donateur a explicitement demande ce projet.
   * HOPE_ALLOCATED  : HOPE repartit un don non affecte.
   */
  allocationType: AllocationType;
  allocatedAt?: Date | string | null;
  notes?: string | null;
}

/** Une part de la repartition d'un don entre plusieurs projets. */
export interface AllocationSplit {
  projectId: string;
  amount: DecimalInput;
  allocationType?: AllocationType;
  notes?: string | null;
}

export interface AllocateManyInput {
  donationId: string;
  /** Type applique aux parts qui n'en precisent pas. */
  defaultAllocationType?: AllocationType;
  splits: AllocationSplit[];
  allocatedAt?: Date | string | null;
}

/** Etat de la repartition d'un don. */
export interface DonationAllocationSummary {
  donationId: string;
  currency: string;
  /** Argent net reellement encaisse. */
  totalReceived: Decimal;
  totalAllocated: Decimal;
  /** Encaisse mais pas encore fleche vers un projet. */
  unallocatedAmount: Decimal;
  allocations: DonationAllocation[];
  /** true si tout l'argent recu est affecte. */
  isFullyAllocated: boolean;
}
