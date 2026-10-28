import { ValidationError } from './errors.js';

/** Verifie qu'une chaine est renseignee et renvoie sa version nettoyee. */
export function requireText(value: unknown, field: string, maxLength?: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') {
    throw new ValidationError(`Le champ "${field}" est obligatoire.`, { field });
  }
  if (maxLength !== undefined && text.length > maxLength) {
    throw new ValidationError(
      `Le champ "${field}" depasse la longueur maximale de ${maxLength} caracteres.`,
      { field, length: text.length, maxLength },
    );
  }
  return text;
}

/** Nettoie une chaine facultative : "" et espaces seuls deviennent null. */
export function optionalText(value: unknown, field: string, maxLength?: number): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text === '') return null;
  if (maxLength !== undefined && text.length > maxLength) {
    throw new ValidationError(
      `Le champ "${field}" depasse la longueur maximale de ${maxLength} caracteres.`,
      { field, length: text.length, maxLength },
    );
  }
  return text;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Valide et normalise un email (minuscules) : sert aussi de cle d'unicite. */
export function normalizeEmail(value: unknown, field = 'email'): string {
  const email = requireText(value, field, 180).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new ValidationError(`Adresse email invalide : "${email}".`, { field, value: email });
  }
  return email;
}

/** Convertit une entree en Date valide. */
export function requireDate(value: Date | string, field: string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`Date invalide pour "${field}" : ${String(value)}.`, { field });
  }
  return date;
}

export function optionalDate(value: Date | string | null | undefined, field: string): Date | null {
  if (value === undefined || value === null || value === '') return null;
  return requireDate(value, field);
}

/** Verifie la coherence d'une periode (debut <= fin). */
export function assertDateRange(
  startDate: Date | null,
  endDate: Date | null,
  context: string,
): void {
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    throw new ValidationError(
      `Periode invalide (${context}) : la date de debut est posterieure a la date de fin.`,
      { context, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    );
  }
}
