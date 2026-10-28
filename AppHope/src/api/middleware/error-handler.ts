import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../shared/errors.js';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';

/**
 * TRADUCTION DES ERREURS METIER EN REPONSES HTTP.
 *
 * Les services metier ne connaissent pas HTTP : ils levent des AppError
 * porteuses d'un `code` stable. C'est ici, et seulement ici, que ce code
 * devient un statut HTTP. Ajouter demain une API GraphQL ne demanderait donc
 * qu'un autre traducteur, sans toucher a un seul service.
 */

const STATUS_BY_CODE: Record<string, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_STATUS_TRANSITION: 409,
  BUSINESS_RULE_VIOLATION: 422,
  INSUFFICIENT_FUNDS: 422,
  // 502 et non 500 : la panne vient d'un tiers, pas de HOPE.
  PAYMENT_PROVIDER_ERROR: 502,
};

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** 404 pour toute route inconnue, au format d'erreur habituel de l'API. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route introuvable : ${req.method} ${req.originalUrl}`,
    },
  } satisfies ApiErrorBody);
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  // --- Corps de requete invalide -----------------------------------------
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Les donnees envoyees sont invalides.',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.') || '(racine)',
          message: issue.message,
        })),
      },
    } satisfies ApiErrorBody);
    return;
  }

  // --- Erreur metier ------------------------------------------------------
  if (error instanceof AppError) {
    const status = STATUS_BY_CODE[error.code] ?? 400;

    // Les refus metier sont attendus (fonds insuffisants, projet cloture...) :
    // ils n'encombrent pas le journal au niveau erreur.
    logger.info('Requete refusee par une regle metier.', {
      code: error.code,
      status,
      message: error.message,
    });

    res.status(status).json({
      error: { code: error.code, message: error.message, details: error.details },
    } satisfies ApiErrorBody);
    return;
  }

  // --- JSON malforme ------------------------------------------------------
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: { code: 'MALFORMED_JSON', message: 'Le corps de la requete n’est pas du JSON valide.' },
    } satisfies ApiErrorBody);
    return;
  }

  // --- Tout le reste : une vraie panne ------------------------------------
  logger.error('Erreur non geree dans l’API.', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Une erreur interne est survenue. Reessayez dans un instant.',
      // Le detail technique ne sort jamais en production : il renseignerait un
      // attaquant sur la structure interne du serveur.
      ...(env.isProduction
        ? {}
        : { details: error instanceof Error ? error.message : String(error) }),
    },
  } satisfies ApiErrorBody);
};
