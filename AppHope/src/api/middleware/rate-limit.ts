import type { RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';

/**
 * Limiteur de debit en memoire, sans dependance.
 *
 * Il protege les points d'entree en ecriture — creation de don, paiement —
 * contre les envois repetes : double clic, script maladroit, ou tentative de
 * saturer la base de dons vides.
 *
 * LIMITE ASSUMEE : le compteur vit dans la memoire du processus. Avec
 * plusieurs instances derriere un repartiteur de charge, chacune comptera de
 * son cote. Pour une mise en production reelle, ce compteur doit passer dans
 * Redis, ou etre confie a la passerelle d'entree.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Duree de la fenetre, en millisecondes. */
  windowMs: number;
  /** Nombre de requetes autorisees par fenetre et par adresse IP. */
  max: number;
  message?: string;
  /**
   * Active le limiteur meme la ou il est normalement neutralise (tests).
   * Reserve aux tests qui verifient le limiteur lui-meme.
   */
  force?: boolean;
}

/**
 * Le limiteur est-il actif ?
 *
 * Il est neutralise pendant les tests : une suite qui enchaine vingt dons en
 * quelques secondes se ferait bloquer par sa propre protection, et les echecs
 * ressembleraient a des bugs metier. Le limiteur reste teste directement,
 * dans son propre test unitaire, avec l'option `force`.
 */
export function isRateLimitEnabled(options: RateLimitOptions): boolean {
  if (options.force) return true;
  if (env.isTest) return false;
  return process.env['RATE_LIMIT_DISABLED'] !== 'true';
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  if (!isRateLimitEnabled(options)) {
    return (_req, _res, next) => next();
  }

  const buckets = new Map<string, Bucket>();
  const message =
    options.message ?? 'Trop de requetes envoyees. Patientez un instant avant de reessayer.';

  // Nettoyage periodique : sans lui, la table grossirait indefiniment.
  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, options.windowMs);
  sweeper.unref();

  return (req, res, next) => {
    const key = req.ip ?? 'inconnu';
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    bucket.count += 1;

    if (bucket.count > options.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      logger.warn('Limite de debit atteinte.', { ip: key, path: req.path });
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
      return;
    }

    next();
  };
}
