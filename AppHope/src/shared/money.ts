import { Prisma } from '@prisma/client';
import { currencyDecimals, normalizeCurrency, type CurrencyCode } from './currency.js';
import { ValidationError } from './errors.js';

/**
 * Utilitaires monetaires.
 *
 * REGLE ABSOLUE : l'argent n'est JAMAIS represente par un `number` flottant.
 * On utilise Prisma.Decimal (decimal.js), qui est aussi le type renvoye par
 * les colonnes Decimal(18, 2) de PostgreSQL.
 */

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

/** Tout ce qui peut etre converti en Decimal sans perte. */
export type DecimalInput = Prisma.Decimal | string | number;

export const ZERO: Decimal = new Prisma.Decimal(0);

export function toDecimal(value: DecimalInput, field = 'amount'): Decimal {
  try {
    const decimal = new Prisma.Decimal(value as Prisma.Decimal.Value);
    if (!decimal.isFinite()) {
      throw new Error('valeur non finie');
    }
    return decimal;
  } catch {
    throw new ValidationError(`Montant invalide pour "${field}" : ${String(value)}.`, {
      field,
      value: String(value),
    });
  }
}

export function sumDecimals(values: readonly DecimalInput[]): Decimal {
  return values.reduce<Decimal>((total, value) => total.plus(toDecimal(value)), ZERO);
}

export function isPositive(value: DecimalInput): boolean {
  return toDecimal(value).greaterThan(0);
}

export function isZero(value: DecimalInput): boolean {
  return toDecimal(value).isZero();
}

export function isNegative(value: DecimalInput): boolean {
  return toDecimal(value).lessThan(0);
}

/** Renvoie le plus grand des deux montants. */
export function maxDecimal(a: DecimalInput, b: DecimalInput): Decimal {
  const left = toDecimal(a);
  const right = toDecimal(b);
  return left.greaterThan(right) ? left : right;
}

/**
 * Arrondit un montant selon le nombre de decimales de sa devise
 * (0 pour MGA, 2 pour EUR/USD). Arrondi au plus proche (ROUND_HALF_UP).
 */
export function roundToCurrency(value: DecimalInput, currency: string): Decimal {
  const code: CurrencyCode = normalizeCurrency(currency);
  return toDecimal(value).toDecimalPlaces(currencyDecimals(code), Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Valide un montant destine a etre enregistre : strictement positif,
 * arrondi a la devise, et compatible avec Decimal(18, 2).
 */
export function assertPositiveAmount(
  value: DecimalInput,
  currency: string,
  field = 'amount',
): Decimal {
  const amount = roundToCurrency(value, currency);
  if (!amount.greaterThan(0)) {
    throw new ValidationError(
      `Le champ "${field}" doit etre strictement positif (recu : ${amount.toString()} ${currency}).`,
      { field, value: amount.toString(), currency },
    );
  }
  if (amount.decimalPlaces() > 2 || amount.abs().greaterThanOrEqualTo('10000000000000000')) {
    throw new ValidationError(
      `Le champ "${field}" depasse la precision autorisee Decimal(18, 2).`,
      { field, value: amount.toString() },
    );
  }
  return amount;
}

/** Comme assertPositiveAmount mais tolere zero (ex : montant rembourse). */
export function assertNonNegativeAmount(
  value: DecimalInput,
  currency: string,
  field = 'amount',
): Decimal {
  const amount = roundToCurrency(value, currency);
  if (amount.lessThan(0)) {
    throw new ValidationError(
      `Le champ "${field}" ne peut pas etre negatif (recu : ${amount.toString()} ${currency}).`,
      { field, value: amount.toString(), currency },
    );
  }
  return amount;
}

/** Formatage lisible pour la console et les rapports : "100 000 MGA". */
export function formatMoney(value: DecimalInput, currency: string): string {
  const code = normalizeCurrency(currency);
  const amount = roundToCurrency(value, code);
  const [integerPart, decimalPart] = amount.toFixed(currencyDecimals(code)).split('.');
  const grouped = (integerPart ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return decimalPart ? `${grouped},${decimalPart} ${code}` : `${grouped} ${code}`;
}
