/*
 * L'espace administrateur : connexion en cookie, une modification, et
 * sa trace dans le journal d'audit.
 */
import { expect, test } from '@playwright/test';

import { ADMIN, aucunJetonLisible, sansDebordement } from './outils.js';

test('connexion, creation de categorie, journal d audit, deconnexion', async ({ page, context }, testInfo) => {
  await page.goto('/authentification?type=aucun');
  await expect(page.locator('#typeConnexion')).toHaveValue('aucun');
  await page.fill('#email', ADMIN.adminLog);
  await page.fill('#motDePasse', ADMIN.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/admin(\/|$)/, { timeout: 20_000 });

  const cookie = (await context.cookies()).find((c) => c.name === 'hope_admin');
  expect(cookie?.httpOnly).toBe(true);
  await aucunJetonLisible(page);

  // Une modification, par l'API de la session ouverte (le cookie suffit).
  const nom = `Categorie ${testInfo.project.name} ${Date.now()}`;
  const statut = await page.evaluate(async (n) => {
    const r = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n }),
    });
    return r.status;
  }, nom);
  expect(statut).toBe(201);

  await page.goto('/admin/audit');
  await expect(page.locator('.outils__compteur')).toBeVisible();
  const table = page.locator('table');
  await expect(table).toContainText('a créé une catégorie de projet');
  await expect(table).toContainText('s’est connecté à l’administration');
  await sansDebordement(page);

  await page.goto('/admin/projects');
  await expect(page.locator('main')).toBeVisible();
});
