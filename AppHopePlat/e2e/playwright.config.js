/*
 * Les tests de bout en bout de HOPE (npm test dans e2e/).
 *
 * Prealable : le frontend construit (npm run build --prefix frontend) et
 * un serveur PostgreSQL joignable (DATABASE_URL, ou backend/.env).
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: './tests',
  outputDir: './sortie/resultats',
  // Les tests partagent une base : l'un apres l'autre, dans l'ordre.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: 'sortie/rapport', open: 'never' }]]
    : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } },
    { name: 'telephone', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'node serveur.mjs',
    url: `http://localhost:${PORT}/api/sante`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
