import type {
  Beneficiary,
  BeneficiaryStatus,
  BeneficiaryType,
  Gender,
  ProjectBeneficiary,
  ProjectBeneficiaryStatus,
} from '@prisma/client';

export interface CreateBeneficiaryInput {
  beneficiaryType: BeneficiaryType;
  /** Code ISO 3166-1 alpha-2. */
  country: string;
  firstName?: string | null;
  lastName?: string | null;
  gender?: Gender | null;
  birthDate?: Date | string | null;
  city?: string | null;
  status?: BeneficiaryStatus;
  notes?: string | null;
}

export type UpdateBeneficiaryInput = Partial<CreateBeneficiaryInput>;

export interface BeneficiaryFilters {
  beneficiaryType?: BeneficiaryType;
  status?: BeneficiaryStatus;
  country?: string;
  projectId?: string;
  search?: string;
}

export interface EnrollBeneficiaryInput {
  projectId: string;
  beneficiaryId: string;
  joinedAt?: Date | string | null;
  notes?: string | null;
}

/** Beneficiaire accompagne de son inscription au projet. */
export interface ProjectBeneficiaryView {
  enrollment: ProjectBeneficiary;
  beneficiary: Beneficiary;
}

export interface BeneficiaryProfile {
  beneficiary: Beneficiary;
  /** Age en annees revolues, null si la date de naissance est inconnue. */
  age: number | null;
  enrollments: ProjectBeneficiary[];
  activeProjectCount: number;
}

export const ACTIVE_ENROLLMENT_STATUSES: readonly ProjectBeneficiaryStatus[] = ['ACTIVE'];
