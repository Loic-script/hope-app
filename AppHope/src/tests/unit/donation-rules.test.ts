import { DonationFrequency, DonationStatus, DonationType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  addMonths,
  assertDonationTypeConsistency,
  computeExpectedInstallments,
  computeNextPaymentDate,
  donationStateMachine,
} from '../../modules/donations/donation.rules.js';
import { computeAge } from '../../modules/beneficiaries/beneficiary.service.js';
import { InvalidStatusTransitionError, ValidationError } from '../../shared/errors.js';
import { isInternational, normalizeCountry, allowedPaymentScopes } from '../../shared/geography.js';
import { generateReference, REFERENCE_PREFIXES } from '../../shared/reference.js';

describe('cycle de vie d’un don', () => {
  it('autorise DRAFT -> ACTIVE -> COMPLETED', () => {
    expect(donationStateMachine.can(DonationStatus.DRAFT, DonationStatus.ACTIVE)).toBe(true);
    expect(donationStateMachine.can(DonationStatus.ACTIVE, DonationStatus.COMPLETED)).toBe(true);
  });

  it('interdit de reactiver un don cloture ou annule', () => {
    expect(donationStateMachine.can(DonationStatus.COMPLETED, DonationStatus.ACTIVE)).toBe(false);
    expect(donationStateMachine.can(DonationStatus.CANCELLED, DonationStatus.ACTIVE)).toBe(false);
    expect(() =>
      donationStateMachine.assert(DonationStatus.CANCELLED, DonationStatus.ACTIVE),
    ).toThrow(InvalidStatusTransitionError);
  });

  it('interdit de passer directement de DRAFT a COMPLETED', () => {
    expect(donationStateMachine.can(DonationStatus.DRAFT, DonationStatus.COMPLETED)).toBe(false);
  });
});

describe('coherence type de don / frequence', () => {
  it('exige une frequence pour un don recurrent', () => {
    expect(() => assertDonationTypeConsistency(DonationType.RECURRING, null)).toThrow(
      ValidationError,
    );
    expect(() =>
      assertDonationTypeConsistency(DonationType.RECURRING, DonationFrequency.MONTHLY),
    ).not.toThrow();
  });

  it('refuse une frequence sur un don ponctuel', () => {
    expect(() =>
      assertDonationTypeConsistency(DonationType.ONE_TIME, DonationFrequency.MONTHLY),
    ).toThrow(ValidationError);
    expect(() => assertDonationTypeConsistency(DonationType.ONE_TIME, null)).not.toThrow();
  });
});

describe('calcul des echeances', () => {
  it('ajoute des mois sans deborder sur le mois suivant', () => {
    // 31 janvier + 1 mois doit donner le 28 fevrier, pas le 3 mars.
    const result = addMonths(new Date(Date.UTC(2026, 0, 31)), 1);
    expect(result.toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('gere les annees bissextiles', () => {
    const result = addMonths(new Date(Date.UTC(2028, 0, 31)), 1);
    expect(result.toISOString().slice(0, 10)).toBe('2028-02-29');
  });

  it('calcule l’echeance suivante selon la frequence', () => {
    const start = new Date(Date.UTC(2026, 0, 15));
    expect(
      computeNextPaymentDate(start, DonationFrequency.MONTHLY).toISOString().slice(0, 10),
    ).toBe('2026-02-15');
    expect(
      computeNextPaymentDate(start, DonationFrequency.QUARTERLY).toISOString().slice(0, 10),
    ).toBe('2026-04-15');
    expect(computeNextPaymentDate(start, DonationFrequency.YEARLY).toISOString().slice(0, 10)).toBe(
      '2027-01-15',
    );
  });

  it('compte une seule echeance pour un don ponctuel', () => {
    expect(
      computeExpectedInstallments({
        donationType: DonationType.ONE_TIME,
        frequency: null,
        startDate: null,
        endDate: null,
      }),
    ).toBe(1);
  });

  it('compte douze echeances pour un don mensuel sur un an', () => {
    expect(
      computeExpectedInstallments({
        donationType: DonationType.RECURRING,
        frequency: DonationFrequency.MONTHLY,
        startDate: new Date(Date.UTC(2026, 0, 15)),
        endDate: new Date(Date.UTC(2026, 11, 15)),
      }),
    ).toBe(12);
  });

  it('compte quatre echeances pour un don trimestriel sur un an', () => {
    expect(
      computeExpectedInstallments({
        donationType: DonationType.RECURRING,
        frequency: DonationFrequency.QUARTERLY,
        startDate: new Date(Date.UTC(2026, 0, 15)),
        endDate: new Date(Date.UTC(2026, 11, 15)),
      }),
    ).toBe(4);
  });

  it('renvoie null pour un engagement recurrent sans date de fin', () => {
    // Engagement ouvert : on n'invente pas une date de fin que le donateur
    // n'a jamais donnee.
    expect(
      computeExpectedInstallments({
        donationType: DonationType.RECURRING,
        frequency: DonationFrequency.MONTHLY,
        startDate: new Date(Date.UTC(2026, 0, 15)),
        endDate: null,
      }),
    ).toBeNull();
  });

  it('ne compte pas une echeance incomplete', () => {
    // Du 15 janvier au 14 fevrier : la deuxieme echeance n'est pas atteinte.
    expect(
      computeExpectedInstallments({
        donationType: DonationType.RECURRING,
        frequency: DonationFrequency.MONTHLY,
        startDate: new Date(Date.UTC(2026, 0, 15)),
        endDate: new Date(Date.UTC(2026, 1, 14)),
      }),
    ).toBe(1);
  });
});

describe('geographie : international est DEDUIT, jamais stocke', () => {
  it('considere Madagascar comme local', () => {
    expect(isInternational('MG')).toBe(false);
    expect(isInternational('mg')).toBe(false);
  });

  it('considere tout autre pays comme international', () => {
    expect(isInternational('FR')).toBe(true);
    expect(isInternational('US')).toBe(true);
  });

  it('valide le format ISO 3166-1 alpha-2', () => {
    expect(normalizeCountry(' fr ')).toBe('FR');
    expect(() => normalizeCountry('FRA')).toThrow(ValidationError);
    expect(() => normalizeCountry('1F')).toThrow(ValidationError);
  });

  it('ouvre les bonnes portees de paiement selon le pays', () => {
    expect(allowedPaymentScopes('MG')).toEqual(['LOCAL', 'BOTH']);
    expect(allowedPaymentScopes('FR')).toEqual(['INTERNATIONAL', 'BOTH']);
  });
});

describe('references lisibles', () => {
  it('respecte le format HOPE-XXX-AAAAMMJJ-XXXXXX', () => {
    const reference = generateReference(
      REFERENCE_PREFIXES.TRANSACTION,
      new Date(2026, 8, 3),
    );
    expect(reference).toMatch(/^HOPE-TXN-20260903-[A-Z2-9]{6}$/);
  });

  it('exclut les caracteres ambigus (0, O, 1, I, L)', () => {
    for (let index = 0; index < 200; index += 1) {
      const suffix = generateReference(REFERENCE_PREFIXES.DONATION).split('-')[3] ?? '';
      expect(suffix).not.toMatch(/[01OIL]/);
    }
  });

  it('genere des references differentes a chaque appel', () => {
    const references = new Set(
      Array.from({ length: 100 }, () => generateReference(REFERENCE_PREFIXES.PROJECT)),
    );
    expect(references.size).toBeGreaterThan(95);
  });
});

describe('age d’un beneficiaire', () => {
  it('renvoie null si la date de naissance est inconnue', () => {
    expect(computeAge(null)).toBeNull();
  });

  it('compte les annees revolues', () => {
    const reference = new Date(Date.UTC(2026, 8, 3));
    expect(computeAge(new Date(Date.UTC(2000, 8, 3)), reference)).toBe(26);
    expect(computeAge(new Date(Date.UTC(2000, 8, 4)), reference)).toBe(25);
  });
});
