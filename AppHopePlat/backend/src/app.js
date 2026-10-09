import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';

import { config } from './config/env.js';
import { query } from './config/database.js';
import apiRoutes from './routes/index.js';
import { gestionnaireErreurs, routeIntrouvable } from './middleware/error.middleware.js';
import { DOSSIER_MEDIAS, PREFIXE_MEDIAS } from './middleware/upload.middleware.js';
import { verifierOrigine } from './shared/session.js';
import { pagesDesActualites, pagesDesProjets, robotsTxt, sitemapXml } from './shared/referencement.js';
import { actualitesPourPlan, projetsPourPlan } from './services/vitrine.service.js';
import { journalDesRequetes } from './services/surveillance.service.js';

const DOSSIER_FRONTEND = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'frontend',
  'dist'
);

function enTetesDeSecurite(req, res, suite) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (config.enProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  suite();
}

export function creerApplication() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(enTetesDeSecurite);

  app.get('/api/sante', async (_req, res) => {
    try {
      await query('SELECT 1');
      res.json({ statut: 'ok' });
    } catch {
      res.status(503).json({ statut: 'base indisponible' });
    }
  });

  app.use(
    cors({
      origin: config.corsOrigin.split(',').map((origine) => origine.trim()),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Hope-Espace'],
      credentials: true,
      maxAge: 86_400,
    })
  );

  app.use(
    express.json({
      limit: '100kb',
      verify: (req, _res, corps) => {
        if (req.originalUrl.startsWith('/api/paiements/stripe/')) req.corpsBrut = corps;
      },
    })
  );

  if (config.env !== 'production') {
    app.use((req, _res, suite) => {
      console.log(`[HOPE] ${req.method} ${req.originalUrl}`);
      suite();
    });
  } else {
    app.use(journalDesRequetes);
  }

  app.use(
    PREFIXE_MEDIAS,
    express.static(DOSSIER_MEDIAS, {
      index: false,
      dotfiles: 'deny',
      maxAge: '7d',
      fallthrough: false,
    })
  );

  app.use('/api', verifierOrigine);
  app.use('/api', apiRoutes);

  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(robotsTxt(config.siteUrl));
  });
  app.get('/sitemap.xml', async (_req, res) => {
    const [projets, actualites] = await Promise.all([
      projetsPourPlan().catch(() => []),
      actualitesPourPlan().catch(() => []),
    ]);
    res
      .type('application/xml')
      .send(sitemapXml(config.siteUrl, [...pagesDesProjets(projets), ...pagesDesActualites(actualites)]));
  });

  const index = path.join(DOSSIER_FRONTEND, 'index.html');
  if (config.servirFrontend && fs.existsSync(index)) {
    app.use(
      '/assets',
      express.static(path.join(DOSSIER_FRONTEND, 'assets'), {
        immutable: true,
        maxAge: '365d',
        fallthrough: false,
      })
    );
    app.use(express.static(DOSSIER_FRONTEND, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/|api$|media\/).*/, (req, res, suite) => {
      if (!req.accepts('html')) return suite();
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(index);
    });
  }

  app.use(routeIntrouvable);
  app.use(gestionnaireErreurs);

  return app;
}
