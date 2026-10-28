import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

/** Captures d'ecran pour relecture visuelle du design. */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';
const OUT = process.env.E2E_SHOTS ?? 'e2e-shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function ready(page) {
  await page.waitForLoadState('networkidle');
  await page
    .getByText('Chargement de la page', { exact: false })
    .waitFor({ state: 'detached', timeout: 15000 })
    .catch(() => undefined);
  await page.waitForTimeout(500);
}

const views = [
  { name: 'accueil', path: '/', width: 1440, full: true },
  { name: 'accueil-mobile', path: '/', width: 390, full: true },
  { name: 'projets', path: '/projects', width: 1440, full: false },
  { name: 'transparence', path: '/transparency', width: 1440, full: true },
  { name: 'don', path: '/donate', width: 1440, full: false },
  { name: 'don-mobile', path: '/donate', width: 390, full: false },
];

for (const view of views) {
  const page = await browser.newPage({ viewport: { width: view.width, height: 900 } });
  await page.goto(`${BASE_URL}${view.path}`);
  await ready(page);
  await page.screenshot({ path: `${OUT}/${view.name}.png`, fullPage: view.full });
  console.log(`capture: ${OUT}/${view.name}.png`);
  await page.close();
}

await browser.close();
