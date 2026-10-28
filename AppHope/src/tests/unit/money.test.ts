import { describe, expect, it } from 'vitest';
import {
  ZERO,
  assertNonNegativeAmount,
  assertPositiveAmount,
  formatMoney,
  isPositive,
  maxDecimal,
  roundToCurrency,
  sumDecimals,
  toDecimal,
} from '../../shared/money.js';
import { normalizeCurrency, assertSameCurrency, CURRENCY_CODES } from '../../shared/currency.js';
import { ValidationError } from '../../shared/errors.js';

describe('money : arithmetique financiere', () => {
  it('additionne sans erreur de virgule flottante', () => {
    // 0.1 + 0.2 vaut 0.30000000000000004 en flottant : c'est exactement le
    // genre d'erreur qu'un systeme financier ne doit jamais produire.
    expect(sumDecimals(['0.1', '0.2']).toString()).toBe('0.3');
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it('additionne une liste vide en renvoyant zero', () => {
    expect(sumDecimals([]).toString()).toBe('0');
  });

  it('conserve la precision sur de gros montants en ariary', () => {
    const total = sumDecimals(['999999999.99', '0.01']);
    expect(total.toString()).toBe('1000000000');
  });

  it('accepte les chaines, les nombres et les Decimal', () => {
    expect(toDecimal('42.5').toString()).toBe('42.5');
    expect(toDecimal(42.5).toString()).toBe('42.5');
    expect(toDecimal(toDecimal('42.5')).toString()).toBe('42.5');
  });

  it('refuse une valeur non numerique', () => {
    expect(() => toDecimal('pas-un-montant')).toThrow(ValidationError);
    expect(() => toDecimal(Number.NaN)).toThrow(ValidationError);
    expect(() => toDecimal(Number.POSITIVE_INFINITY)).toThrow(ValidationError);
  });

  it('compare correctement deux montants', () => {
    expect(isPositive('0.01')).toBe(true);
    expect(isPositive('0')).toBe(false);
    expect(isPositive('-1')).toBe(false);
    expect(maxDecimal('10', '20').toString()).toBe('20');
    expect(ZERO.isZero()).toBe(true);
  });
});

describe('money : arrondi selon la devise', () => {
  it('arrondit l’ariary a l’unite (pas de centimes en MGA)', () => {
    expect(roundToCurrency('100.4', 'MGA').toString()).toBe('100');
    expect(roundToCurrency('100.5', 'MGA').toString()).toBe('101');
  });

  it('arrondit l’euro a deux decimales', () => {
    expect(roundToCurrency('10.005', 'EUR').toString()).toBe('10.01');
    expect(roundToCurrency('10.004', 'EUR').toString()).toBe('10');
  });
});

describe('money : validation des montants', () => {
  it('accepte un montant strictement positif', () => {
    expect(assertPositiveAmount('50000', 'MGA').toString()).toBe('50000');
  });

  it('refuse zero et les montants negatifs', () => {
    expect(() => assertPositiveAmount('0', 'MGA')).toThrow(ValidationError);
    expect(() => assertPositiveAmount('-10', 'EUR')).toThrow(ValidationError);
  });

  it('tolere zero quand c’est legitime (montant rembourse)', () => {
    expect(assertNonNegativeAmount('0', 'MGA').toString()).toBe('0');
    expect(() => assertNonNegativeAmount('-1', 'MGA')).toThrow(ValidationError);
  });

  it('refuse un montant qui depasse la precision Decimal(18, 2)', () => {
    expect(() => assertPositiveAmount('10000000000000000', 'EUR')).toThrow(ValidationError);
  });
});

describe('money : affichage', () => {
  it('formate l’ariary sans decimales et avec des milliers separes', () => {
    expect(formatMoney('100000', 'MGA')).toBe('100 000 MGA');
    expect(formatMoney('1500000', 'MGA')).toBe('1 500 000 MGA');
  });

  it('formate l’euro avec deux decimales', () => {
    expect(formatMoney('1000', 'EUR')).toBe('1 000,00 EUR');
    expect(formatMoney('0.5', 'EUR')).toBe('0,50 EUR');
  });
});

describe('devises', () => {
  it('normalise la casse et les espaces', () => {
    expect(normalizeCurrency('mga')).toBe('MGA');
    expect(normalizeCurrency('  eur  ')).toBe('EUR');
  });

  it('refuse une devise inconnue', () => {
    expect(() => normalizeCurrency('XXX')).toThrow(ValidationError);
  });

  it('expose la liste des devises supportees', () => {
    expect(CURRENCY_CODES).toContain('MGA');
    expect(CURRENCY_CODES).toContain('EUR');
  });

  it('refuse de melanger deux devises (aucune conversion en phase 1)', () => {
    expect(() => assertSameCurrency('MGA', 'EUR', 'test')).toThrow(ValidationError);
    expect(() => assertSameCurrency('MGA', 'mga', 'test')).not.toThrow();
  });
});
