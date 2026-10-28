import { DonationFrequency, DonationStatus, DonationType } from '@prisma/client';
import { createStateMachine } from '../../shared/state-machine.js';
import { ValidationError } from '../../shared/errors.js';

/**
 * Cycle de vie d'un DON (l'engagement du donateur).
 *
 *   DRAFT ---> ACTIVE ---> COMPLETED
 *     |          |
 *     +----------+------> CANCELLED
 *
 * COMPLETED et CANCELLED sont finaux.
 */
export const donationStateMachine = createStateMachine<DonationStatus>('Donation', {
  [DonationStatus.DRAFT]: [DonationStatus.ACTIVE, DonationStatus.CANCELLED],
  [DonationStatus.ACTIVE]: [DonationStatus.COMPLETED, DonationStatus.CANCELLED],
  [DonationStatus.COMPLETED]: [],
  [DonationStatus.CANCELLED]: [],
});

/** Nombre de mois separant deux echeances. */
export const FREQUENCY_MONTHS: Record<DonationFrequency, number> = {
  [DonationFrequency.MONTHLY]: 1,
  [DonationFrequency.QUARTERLY]: 3,
  [DonationFrequency.YEARLY]: 12,
};

/**
 * Ajoute N mois a une date en restant dans le mois vise.
 * Exemple : 31 janvier + 1 mois = 28 (ou 29) fevrier, et non 3 mars.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const targetDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(targetDay, lastDayOfTargetMonth));
  return result;
}

/** Echeance suivante d'un don recurrent. */
export function computeNextPaymentDate(from: Date, frequency: DonationFrequency): Date {
  return addMonths(from, FREQUENCY_MONTHS[frequency]);
}

/**
 * Nombre d'echeances prevues par l'engagement.
 *
 *   - don ponctuel                       -> 1
 *   - don recurrent avec date de fin     -> nombre d'echeances de la periode
 *   - don recurrent sans date de fin     -> null (engagement ouvert)
 *
 * Un engagement ouvert n'a pas de "montant restant" : c'est volontaire, on ne
 * doit pas inventer une echeance de fin que le donateur n'a jamais donnee.
 */
export function computeExpectedInstallments(donation: {
  donationType: DonationType;
  frequency: DonationFrequency | null;
  startDate: Date | null;
  endDate: Date | null;
}): number | null {
  if (donation.donationType === DonationType.ONE_TIME) return 1;
  if (!donation.frequency || !donation.startDate || !donation.endDate) return null;

  const step = FREQUENCY_MONTHS[donation.frequency];
  const monthsBetween =
    (donation.endDate.getUTCFullYear() - donation.startDate.getUTCFullYear()) * 12 +
    (donation.endDate.getUTCMonth() - donation.startDate.getUTCMonth());

  if (monthsBetween < 0) return 0;

  const dayAdjustment = donation.endDate.getUTCDate() >= donation.startDate.getUTCDate() ? 0 : -1;
  return Math.floor((monthsBetween + dayAdjustment) / step) + 1;
}

/** Verifie la coherence entre le type de don et la frequence fournie. */
export function assertDonationTypeConsistency(
  donationType: DonationType,
  frequency: DonationFrequency | null,
): void {
  if (donationType === DonationType.RECURRING && !frequency) {
    throw new ValidationError(
      'Un don recurrent doit preciser une frequence (MONTHLY, QUARTERLY ou YEARLY).',
      { donationType, frequency },
    );
  }
  if (donationType === DonationType.ONE_TIME && frequency) {
    throw new ValidationError(
      "Un don ponctuel ne peut pas avoir de frequence : utilisez donationType RECURRING.",
      { donationType, frequency },
    );
  }
}
