import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { nettoyerBasesOrphelines, preparerBaseDeTest } from '../backend/tests/aide/baseDeTest.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
export const PORT = Number(process.env.E2E_PORT ?? 3100);
const JOURNAL = path.join(ICI, 'sortie', 'serveur.log');

Object.assign(process.env, {
  NODE_ENV: 'test',
  PORT: String(PORT),
  HOPE_SITE_URL: `http://localhost:${PORT}`,
  CORS_ORIGIN: `http://localhost:${PORT}`,
  SERVIR_FRONTEND: 'true',
  SMTP_HOST: '',
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
process.env.DESACTIVER_LIMITEUR = '1';
process.env.EQUIPE_EMAIL = 'contact@hope.test';
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
