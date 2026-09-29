/**
 * Construction de l'application Express.
 *
 * Separee de server.js pour pouvoir etre montee dans des tests sans ouvrir
 * de port.
 */
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
import { robotsTxt, sitemapXml } from './shared/referencement.js';
import { journalDesRequetes } from './services/surveillance.service.js';

/** frontend/dist : le frontend construit par "npm run build". */
const DOSSIER_FRONTEND = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'frontend',
  'dist'
);

/**
 * Les en-tetes de securite, sur toutes les reponses.
 *
 * - nosniff : le navigateur ne devine pas un type de fichier ;
 * - frame-ancestors / X-Frame-Options : la plateforme ne s'affiche pas
 *   dans le cadre d'un autre site (vol de clics) ;
 * - Referrer-Policy : l'adresse des pages ne fuit pas vers les liens
 *   sortants ;
 * - Permissions-Policy : ni camera, ni micro, ni geolocalisation ;
 * - HSTS, en production : HTTPS seulement, pendant un an.
 *
 * Pas de politique de contenu stricte (script-src...) : Stripe et les
 * polices Google en demanderaient une liste a tenir a jour ; la regle
 * frame-ancestors, elle, est sans risque.
 */
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

  // req.ip correct derriere le proxy de l'hebergeur (ou un proxy local).
  app.set('trust proxy', 1);
  // Ne pas annoncer la technologie utilisee.
  app.disable('x-powered-by');
  app.use(enTetesDeSecurite);

  /*
   * La sante du service : l'hebergeur l'interroge pour savoir si le
   * serveur repond et si la base suit. Aucune donnee, aucun secret.
   */
  app.get('/api/sante', async (_req, res) => {
    try {
      await query('SELECT 1');
      res.json({ statut: 'ok' });
    } catch {
      res.status(503).json({ statut: 'base indisponible' });
    }
  });

  // CORS : seul le frontend Vite est autorise a appeler l'API.
  app.use(
    cors({
      origin: config.corsOrigin.split(',').map((origine) => origine.trim()),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Hope-Espace'],
      credentials: true,
      maxAge: 86_400,
    })
  );

  /*
   * Le corps brut est garde de cote : la signature des messages de
   * Stripe porte sur les octets recus, pas sur l'objet relu. Une virgule
   * deplacee par le relecteur suffirait a la faire echouer.
   */
  app.use(
    express.json({
      limit: '100kb',
      verify: (req, _res, corps) => {
        if (req.originalUrl.startsWith('/api/paiements/stripe/')) req.corpsBrut = corps;
      },
    })
  );

  // Journal des requetes : lisible en developpement, une ligne JSON par
  // requete en production (services/surveillance.service.js).
  if (config.env !== 'production') {
    app.use((req, _res, suite) => {
      console.log(`[HOPE] ${req.method} ${req.originalUrl}`);
      suite();
    });
  } else {
    app.use(journalDesRequetes);
  }

  /**
   * Photos et videos des projets, servies en acces libre.
   *
   * Une balise <img> ou <video> ne peut pas porter d'en-tete
   * Authorization : ces medias sont donc publics. C'est assume — ils sont
   * destines a illustrer les projets, y compris sur le site public a venir.
   * Les justificatifs, eux, restent derriere le JWT.
   *
   * Les noms de fichiers sont generes aleatoirement : rien n'est devinable,
   * et express.static ne sert pas de fichier hors du dossier.
   */
  app.use(
    PREFIXE_MEDIAS,
    express.static(DOSSIER_MEDIAS, {
      index: false,
      dotfiles: 'deny',
      maxAge: '7d',
      fallthrough: false,
    })
  );

  // Les sessions sont en cookie : une requete qui modifie et qui vient
  // d'une autre origine est refusee (voir shared/session.js).
  app.use('/api', verifierOrigine);
  app.use('/api', apiRoutes);

  /*
   * Le frontend construit, s'il est la. Les fichiers d'assets portent une
   * empreinte dans leur nom : ils se gardent un an. index.html, lui, ne se
   * garde pas -- c'est lui qui pointe vers la derniere version.
   *
   * Toute autre adresse (hors /api et /media) renvoie index.html : c'est
   * le routeur de React qui la lit (/donateur/mes-dons, /admin/...).
   */
  // Le referencement : ce que les moteurs peuvent lire, et le plan du site.
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(robotsTxt(config.siteUrl));
  });
  app.get('/sitemap.xml', (_req, res) => {
    res.type('application/xml').send(sitemapXml(config.siteUrl));
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
