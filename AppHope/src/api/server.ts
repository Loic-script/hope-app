import cors from 'cors';
import express, { type Express } from 'express';
import { createCatalogRouter } from './routes/catalog.routes.js';
import { createCheckoutRouter } from './routes/checkout.routes.js';
import { createDonationsRouter } from './routes/donations.routes.js';
import { createProjectsRouter } from './routes/projects.routes.js';
import { createTransactionsRouter } from './routes/transactions.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createContainer, type Container } from '../container.js';
import { env } from '../config/env.js';
import { logger } from '../shared/logger.js';

/**
 * COUCHE HTTP DU BACKEND HOPE.
 *
 * Sa seule raison d'etre est de rendre les services metier joignables depuis
 * un navigateur. Elle ne decide rien :
 *
 *   Requete -> validation de forme -> SERVICE existant -> repository -> Prisma
 *
 * Aucune regle financiere n'est ecrite ici. Les controleurs verifient que les
 * champs recus ont la bonne forme, appellent un service, et traduisent sa
 * reponse en JSON. C'est aussi ici, et nulle part ailleurs, que les erreurs
 * metier deviennent des codes HTTP (voir middleware/error-handler.ts).
 */

export interface ServerOptions {
  container?: Container;
  /** Origines autorisees a appeler l'API depuis un navigateur. */
  allowedOrigins?: string[];
}

/** Origines de developpement : le serveur Vite, en localhost comme en 127.0.0.1. */
export const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

export function createServer(options: ServerOptions = {}): Express {
  const container = options.container ?? createContainer();
  const allowedOrigins = options.allowedOrigins ?? readAllowedOrigins();

  const app = express();

  // Express annonce sa presence par defaut : autant ne pas renseigner
  // gratuitement un scanner sur la pile utilisee.
  app.disable('x-powered-by');

  /**
   * CORS restreint aux origines connues, jamais "*".
   *
   * Les requetes sans origine (curl, tests, sondes de supervision) sont
   * acceptees : le navigateur est le seul a envoyer un en-tete Origin, et
   * c'est lui seul que cette protection concerne.
   */
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        logger.warn('Origine refusee par CORS.', { origin });
        callback(new Error(`Origine non autorisee : ${origin}`));
      },
      methods: ['GET', 'POST', 'OPTIONS'],
      credentials: false,
      maxAge: 86_400,
    }),
  );

  // Un don ne pese que quelques centaines d'octets : plafonner la taille evite
  // qu'une requete geante n'occupe le serveur pour rien.
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      data: { status: 'ok', environment: env.nodeEnv, timestamp: new Date().toISOString() },
    });
  });

  app.use('/api/projects', createProjectsRouter(container));
  app.use('/api/transactions', createTransactionsRouter(container));
  app.use('/api/checkout', createCheckoutRouter());
  app.use('/api', createCatalogRouter(container));
  app.use('/api', createDonationsRouter(container));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * Origines supplementaires via CORS_ALLOWED_ORIGINS, separees par des virgules.
 * Permet d'ouvrir l'API au domaine de production sans toucher au code.
 */
function readAllowedOrigins(): string[] {
  const raw = process.env['CORS_ALLOWED_ORIGINS'];
  if (!raw || raw.trim() === '') return DEFAULT_ALLOWED_ORIGINS;

  const extra = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');

  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra])];
}
