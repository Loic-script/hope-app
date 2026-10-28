import { ValidationError } from './errors.js';

/**
 * Pays d'implantation de HOPE. Tout donateur situe ailleurs est considere
 * comme international.
 *
 * POINT IMPORTANT DU MODELE : "international" n'est PAS un type de donateur.
 * Un donateur a un `donorType` (INDIVIDUAL, COMPANY...) ET un `country`.
 * Le caractere international est une propriete DEDUITE, jamais stockee.
 */
export const ORGANIZATION_COUNTRY = 'MG';

/** Valide et normalise un code pays ISO 3166-1 alpha-2 (2 lettres). */
export function normalizeCountry(value: string, field = 'country'): string {
  const code = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    throw new ValidationError(
      `Code pays invalide : "${value}". Utilisez un code ISO 3166-1 alpha-2 (ex : MG, FR, US).`,
      { field, value },
    );
  }
  return code;
}

/** Un donateur est international s'il n'est pas situe dans le pays de HOPE. */
export function isInternational(country: string): boolean {
  return normalizeCountry(country) !== ORGANIZATION_COUNTRY;
}

/** Portees de methodes de paiement utilisables depuis un pays donne. */
export function allowedPaymentScopes(country: string): ('LOCAL' | 'INTERNATIONAL' | 'BOTH')[] {
  return isInternational(country) ? ['INTERNATIONAL', 'BOTH'] : ['LOCAL', 'BOTH'];
}
