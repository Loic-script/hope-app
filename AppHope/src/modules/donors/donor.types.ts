import type { Donor, DonorType } from '@prisma/client';

export interface CreateDonorInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  donorType: DonorType;
  /** Code ISO 3166-1 alpha-2 : MG, FR, US... */
  country: string;
  /** Code ISO 4217 : MGA, EUR, USD... */
  preferredCurrency: string;
  organizationName?: string | null;
  preferredLanguage?: string | null;
  timezone?: string | null;
  address?: string | null;
  city?: string | null;
  profession?: string | null;
  website?: string | null;
  discoverySource?: string | null;
}

export type UpdateDonorInput = Partial<Omit<CreateDonorInput, 'email'>> & { email?: string };

export interface DonorFilters {
  donorType?: DonorType;
  country?: string;
  /** true = donateurs hors du pays de HOPE, false = donateurs locaux. */
  international?: boolean;
  search?: string;
}

/** Vue enrichie : le caractere international est DEDUIT, jamais stocke. */
export interface DonorProfile {
  donor: Donor;
  displayName: string;
  isInternational: boolean;
}
