/**
 * Hierarchie d'erreurs metier.
 *
 * Toutes les erreurs levees volontairement par les services heritent de
 * AppError. Cela permettra plus tard a une couche HTTP de les traduire en
 * codes de reponse sans que les services aient a connaitre HTTP.
 */

export abstract class AppError extends Error {
  abstract readonly code: string;

  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }

  toJSON(): Record<string, unknown> {
    return { name: this.name, code: this.code, message: this.message, details: this.details };
  }
}

/** Donnee d'entree invalide (format, champ manquant, montant negatif...). */
export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
}

/** Entite introuvable. */
export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';

  constructor(entity: string, identifier: string, details: Record<string, unknown> = {}) {
    super(`${entity} introuvable (${identifier}).`, { entity, identifier, ...details });
  }
}

/** Conflit d'unicite (reference deja utilisee, email deja enregistre...). */
export class ConflictError extends AppError {
  readonly code = 'CONFLICT';
}

/** Regle metier violee : cas general. */
export class BusinessRuleError extends AppError {
  readonly code = 'BUSINESS_RULE_VIOLATION';
}

/** Transition de statut interdite (ex : FAILED -> SUCCESS). */
export class InvalidStatusTransitionError extends AppError {
  readonly code = 'INVALID_STATUS_TRANSITION';

  constructor(entity: string, from: string, to: string, allowed: readonly string[]) {
    super(
      `Transition interdite pour ${entity} : ${from} -> ${to}. ` +
        `Transitions autorisees depuis ${from} : ${allowed.length > 0 ? allowed.join(', ') : 'aucune (statut final)'}.`,
      { entity, from, to, allowed },
    );
  }
}

/** Fonds insuffisants : affectation ou depense superieure au disponible. */
export class InsufficientFundsError extends AppError {
  readonly code = 'INSUFFICIENT_FUNDS';

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, details);
  }
}

/** Echec renvoye par un prestataire de paiement. */
export class PaymentProviderError extends AppError {
  readonly code = 'PAYMENT_PROVIDER_ERROR';
}
