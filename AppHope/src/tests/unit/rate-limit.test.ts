import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { isRateLimitEnabled, rateLimit } from '../../api/middleware/rate-limit.js';

/**
 * Le limiteur est neutralise dans le reste de la suite (voir rate-limit.ts) :
 * c'est ici, et uniquement ici, qu'on verifie qu'il fait bien son travail.
 */

function fakeRequest(ip: string): Request {
  return { ip, path: '/api/checkout' } as unknown as Request;
}

function fakeResponse(): Response & { statusCode: number; payload: unknown } {
  const response = {
    statusCode: 0,
    payload: undefined as unknown,
    setHeader: vi.fn(),
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(body: unknown) {
      response.payload = body;
      return response;
    },
  };
  return response as unknown as Response & { statusCode: number; payload: unknown };
}

describe('limiteur de debit', () => {
  it('est neutralise pendant les tests, sauf demande explicite', () => {
    expect(isRateLimitEnabled({ windowMs: 1000, max: 1 })).toBe(false);
    expect(isRateLimitEnabled({ windowMs: 1000, max: 1, force: true })).toBe(true);
  });

  it('laisse passer les requetes sous la limite', () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 3, force: true });
    const next = vi.fn() as unknown as NextFunction;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      middleware(fakeRequest('10.0.0.1'), fakeResponse(), next);
    }

    expect(next).toHaveBeenCalledTimes(3);
  });

  it('bloque la requete de trop avec un 429 et un delai de reprise', () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 2, force: true });
    const next = vi.fn() as unknown as NextFunction;

    middleware(fakeRequest('10.0.0.2'), fakeResponse(), next);
    middleware(fakeRequest('10.0.0.2'), fakeResponse(), next);

    const blocked = fakeResponse();
    middleware(fakeRequest('10.0.0.2'), blocked, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.payload).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    expect(blocked.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('compte separement chaque adresse IP', () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 1, force: true });
    const next = vi.fn() as unknown as NextFunction;

    middleware(fakeRequest('10.0.0.3'), fakeResponse(), next);
    middleware(fakeRequest('10.0.0.4'), fakeResponse(), next);

    // Deux visiteurs differents ne se penalisent pas l'un l'autre.
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('repart a zero une fois la fenetre ecoulee', () => {
    vi.useFakeTimers();
    try {
      const middleware = rateLimit({ windowMs: 1_000, max: 1, force: true });
      const next = vi.fn() as unknown as NextFunction;

      middleware(fakeRequest('10.0.0.5'), fakeResponse(), next);
      middleware(fakeRequest('10.0.0.5'), fakeResponse(), next);
      expect(next).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1_500);
      middleware(fakeRequest('10.0.0.5'), fakeResponse(), next);
      expect(next).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
