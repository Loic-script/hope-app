import { ValidationError } from './errors.js';

/**
 * Devises supportees (ISO 4217).
 *
 * `decimals` sert uniquement a l'arrondi et a l'affichage : en base, tous les
 * montants sont stockes en Decimal(18, 2).
 * L'Ariary malgache ne s'utilise pas avec des centimes, d'ou decimals = 0.
 */
export const SUPPORTED_CURRENCIES = {
  MGA: { code: 'MGA', name: 'Ariary malgache', symbol: 'Ar', decimals: 0 },
  EUR: { code: 'EUR', name: 'Euro', symbol: 'EUR', decimals: 2 },
  USD: { code: 'USD', name: 'Dollar americain', symbol: 'USD', decimals: 2 },
  GBP: { code: 'GBP', name: 'Livre sterling', symbol: 'GBP', decimals: 2 },
  CHF: { code: 'CHF', name: 'Franc suisse', symbol: 'CHF', decimals: 2 },
  CAD: { code: 'CAD', name: 'Dollar canadien', symbol: 'CAD', decimals: 2 },
} as const;

export type CurrencyCode = keyof typeof SUPPORTED_CURRENCIES;

export const CURRENCY_CODES = Object.keys(SUPPORTED_CURRENCIES) as CurrencyCode[];

export function isSupportedCurrency(value: string): value is CurrencyCode {
  return Object.prototype.hasOwnProperty.call(SUPPORTED_CURRENCIES, value);
}

/** Met en majuscules, valide, et renvoie un code de devise sur 3 lettres. */
export function normalizeCurrency(value: string, field = 'currency'): CurrencyCode {
  const code = String(value ?? '').trim().toUpperCase();
  if (!isSupportedCurrency(code)) {
    throw new ValidationError(
      `Devise non supportee : "${value}". Devises acceptees : ${CURRENCY_CODES.join(', ')}.`,
      { field, value },
    );
  }
  return code;
}

export function currencyDecimals(currency: CurrencyCode): number {
  return SUPPORTED_CURRENCIES[currency].decimals;
}

/**
 * HOPE ne fait AUCUNE conversion de devise en phase 1 : chaque devise est un
 * "compte" separe. Deux montants ne peuvent etre compares/additionnes que
 * s'ils partagent la meme devise.
 */
export function assertSameCurrency(expected: string, actual: string, context: string): void {
  if (expected.toUpperCase() !== actual.toUpperCase()) {
    throw new ValidationError(
      `Devises incompatibles (${context}) : attendu ${expected}, recu ${actual}. ` +
        `Aucune conversion de devise n'est effectuee par le backend.`,
      { expected, actual, context },
    );
  }
}
