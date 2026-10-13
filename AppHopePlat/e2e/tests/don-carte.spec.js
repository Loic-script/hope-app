import { expect, test } from '@playwright/test';

import { adresseUnique, connecter, donateurPret, sansDebordement } from './outils.js';

test('le donateur ne se voit proposer que la carte bancaire, et arrive sur sa page', async ({ page, request }, testInfo) => {
  const email = adresseUnique(testInfo, 'carte');
  const motDePasse = 'carte-2026';
  await donateurPret(request, email, motDePasse);

  await connecter(page, { email, motDePasse });
  await page.goto('/donateur/completer-profil');
  await expect(page.locator('.parcours__paiement')).toHaveCount(1);
  await expect(page.locator('.parcours__paiement')).toContainText('Carte bancaire');
  await page.locator('.parcours__paiement', { hasText: 'Carte bancaire' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page).toHaveURL(/\/completer-profil\/carte/);
  await expect(page.locator('.carte')).toBeVisible();
  await sansDebordement(page);
});

test('une preference enregistree sur un moyen masque ne ressort pas : faire un don mene a la carte', async ({ page, request }, testInfo) => {
  const email = adresseUnique(testInfo, 'ancien-moyen');
  const motDePasse = 'ancien-moyen-2026';
  await donateurPret(request, email, motDePasse, { complet: true });

  await connecter(page, { email, motDePasse });
  await page.goto('/donateur/faire-un-don');
  await expect(page.locator('.don-mode')).toHaveCount(1);
  await expect(page.locator('.don-mode--actif')).toContainText('Carte bancaire');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByRole('button', { name: 'Continuer vers le paiement' }).click();
  await expect(page).toHaveURL(/\/donateur\/payer\/carte/);
  await expect(page.locator('.carte')).toBeVisible();
  await sansDebordement(page);
});
