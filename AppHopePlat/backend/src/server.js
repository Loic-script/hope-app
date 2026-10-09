import { config } from './config/env.js';
import { creerApplication } from './app.js';
import { fermerPool, verifierConnexion } from './config/database.js';

async function demarrer() {
  try {
    const infos = await verifierConnexion();
    console.log(`[HOPE] PostgreSQL connecte (base : ${infos.base})`);
  } catch (erreur) {
    console.error('[HOPE] Connexion a PostgreSQL impossible :', erreur.message);
    console.error(
      `       Verifiez que PostgreSQL tourne sur ${config.database.host}:${config.database.port} ` +
        `et que la base "${config.database.name}" existe (npm run db:init).`
    );
    process.exit(1);
  }

  const app = creerApplication();

  const serveur = app.listen(config.port, () => {
    console.log(`[HOPE] API demarree sur http://localhost:${config.port}`);
    console.log(`[HOPE] Origine CORS autorisee : ${config.corsOrigin}`);
    console.log('[HOPE] Endpoints : POST /api/admin/login | GET /api/admin/me');
  });

  const arreter = (signal) => {
    console.log(`\n[HOPE] Signal ${signal} recu, arret en cours...`);
    serveur.close(async () => {
      await fermerPool();
      console.log('[HOPE] Arret termine.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => arreter('SIGINT'));
  process.on('SIGTERM', () => arreter('SIGTERM'));
}

demarrer();
