/**
 * Construction de l'application Express.
 *
 * Separee de server.js pour pouvoir etre montee dans des tests sans ouvrir
 * de port.
 */
import express from 'express';
import cors from 'cors';

import { config } from './config/env.js';
import apiRoutes from './routes/index.js';
import { gestionnaireErreurs, routeIntrouvable } from './middleware/error.middleware.js';
import { DOSSIER_MEDIAS, PREFIXE_MEDIAS } from './middleware/upload.middleware.js';

export function creerApplication() {
  const app = express();

  // req.ip correct derriere un eventuel proxy local.
  app.set('trust proxy', 1);
  // Ne pas annoncer la technologie utilisee.
  app.disable('x-powered-by');

  // CORS : seul le frontend Vite est autorise a appeler l'API.
  app.use(
    cors({
      origin: config.corsOrigin.split(',').map((origine) => origine.trim()),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
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

  // Journal minimal des requetes en developpement.
  if (config.env !== 'production') {
    app.use((req, _res, suite) => {
      console.log(`[HOPE] ${req.method} ${req.originalUrl}`);
      suite();
    });
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

  app.use('/api', apiRoutes);

  app.use(routeIntrouvable);
  app.use(gestionnaireErreurs);

  return app;
}
