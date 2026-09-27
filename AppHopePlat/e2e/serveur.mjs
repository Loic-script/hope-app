/*
 * Le serveur des tests de bout en bout.
 *
 * Il se comporte comme la production -- un seul serveur Express qui sert
 * l'API et le frontend construit (frontend/dist) -- mais sur une base
 * jetable, preparee au demarrage et supprimee a l'arret. Les courriels
 * (SMTP absent) sont ecrits dans sortie/serveur.log : les tests y lisent
 * les liens de confirmation et de reinitialisation.
 *
 * Lance par Playwright (playwright.config.js, webServer).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { nettoyerBasesOrphelines, preparerBaseDeTest } from '../backend/tests/aide/baseDeTest.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
export const PORT = Number(process.env.E2E_PORT ?? 3100);
const JOURNAL = path.join(ICI, 'sortie', 'serveur.log');

// La configuration de l'application, avant son premier chargement.
Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: String(PORT),
  HOPE_SITE_URL: `http://localhost:${PORT}`,
  CORS_ORIGIN: `http://localhost:${PORT}`,
  SERVIR_FRONTEND: 'true',
  SMTP_HOST: '',
  // Des coordonnees d'essai : les pages de paiement sont ouvertes.
  HOPE_MVOLA_NUMERO: '0340000000',
  HOPE_MVOLA_TITULAIRE: 'HOPE Essai',
  HOPE_ORANGE_MONEY_NUMERO: '0320000000',
  HOPE_ORANGE_MONEY_TITULAIRE: 'HOPE Essai',
  EQUIPE_EMAIL: 'contact@hope.test',
});

fs.mkdirSync(path.dirname(JOURNAL), { recursive: true });
fs.writeFileSync(JOURNAL, '');
const ecrire = (niveau) => (...morceaux) => {
  const ligne = morceaux.map((m) => (typeof m === 'string' ? m : m instanceof Error ? m.stack : JSON.stringify(m))).join(' ');
  fs.appendFileSync(JOURNAL, `${ligne}\n`);
  niveau(...morceaux);
};
console.log = ecrire(console.log.bind(console));
console.error = ecrire(console.error.bind(console));

await nettoyerBasesOrphelines('hope_e2e');
const base = await preparerBaseDeTest({ prefixe: 'hope_e2e' });
// Tous les comptes des tests viennent de la meme adresse IP : sans cela,
// le limiteur freinerait la suite. Il est teste a part (backend/tests),
// et cette variable est ignoree en production.
process.env.DESACTIVER_LIMITEUR = '1';
const { creerApplication } = await import('../backend/src/app.js');
const { fermerPool } = await import('../backend/src/config/database.js');

const serveur = creerApplication().listen(PORT, () => {
  console.log(`[E2E] HOPE sur http://localhost:${PORT} (base ${base.url.split('/').pop()})`);
});

let arret = false;
async function arreter() {
  if (arret) return;
  arret = true;
  serveur.close();
  await fermerPool().catch(() => {});
  await base.detruire().catch(() => {});
  process.exit(0);
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, arreter);
