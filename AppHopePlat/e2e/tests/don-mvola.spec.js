/*
 * Le parcours de don jusqu'a la page MVola : le moyen choisi, la page
 * de paiement avec le numero de HOPE.
 */
import { expect, test } from '@playwright/test';

import { adresseUnique, connecter, donateurPret, sansDebordement } from './outils.js';

test('le donateur choisit MVola et arrive sur la page de paiement', async ({ page, request }, testInfo) => {
  const email = adresseUnique(testInfo, 'mvola');
  const motDePasse = 'mvola-2026';
  await donateurPret(request, email, motDePasse);

  await connecter(page, { email, motDePasse });
  await page.goto('/donateur/completer-profil');
  await page.locator('.parcours__paiement', { hasText: 'MVola' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page).toHaveURL(/\/completer-profil\/mvola/);
  await expect(page.locator('.mvola__solde')).toBeVisible();
  // Le compte MVola de HOPE, tel que le serveur le configure.
  await expect(page.locator('body')).toContainText('HOPE Essai');
  await expect(page.getByRole('button', { name: 'Continuer vers MVola' })).toBeVisible();
  await sansDebordement(page);
});
