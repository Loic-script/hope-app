import { expect, test } from '@playwright/test';

import { adresseUnique, connecter, dernierLien, donateurPret, sansDebordement } from './outils.js';

test('mot de passe oublie : le lien du courriel, un nouveau mot de passe', async ({ page, request }, testInfo) => {
  const email = adresseUnique(testInfo, 'oubli');
  await donateurPret(request, email, 'ancien-mdp-2026');

  await page.goto('/authentification');
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();
  await page.fill('#emailOubli', email);
  await page.getByRole('button', { name: 'Recevoir le lien' }).click();
  await expect(page.locator('.mot-de-passe__envoye')).toContainText('Si un compte existe');

  const jeton = await dernierLien(email, 'reinitialiser-mot-de-passe');
  await page.goto(`/reinitialiser-mot-de-passe?jeton=${jeton}`);
  await page.fill('#nouveauMotDePasse', 'nouveau-mdp-2026');
  await page.fill('#confirmationMotDePasse', 'nouveau-mdp-2026');
  await page.getByRole('button', { name: 'Changer mon mot de passe' }).click();
  await expect(page.locator('.note-acces--ok')).toContainText('changé');

  const ancien = await request.post('/api/auth/login', { data: { email, motDePasse: 'ancien-mdp-2026', typeUtilisateur: 'donateur' } });
  expect(ancien.status()).toBe(401);
  const nouveau = await request.post('/api/auth/login', { data: { email, motDePasse: 'nouveau-mdp-2026', typeUtilisateur: 'donateur' } });
  expect(nouveau.status()).toBe(200);
});

test('securite du compte : rappel, changement de mot de passe, suppression', async ({ page, browser, request }, testInfo) => {
  const email = adresseUnique(testInfo, 'compte');
  const premier = 'premier-mdp-2026';
  const second = 'second-mdp-2026!';
  await donateurPret(request, email, premier, { complet: true });

  const autre = await browser.newContext();
  const autrePage = await autre.newPage();
  await connecter(autrePage, { email, motDePasse: premier });
  await expect(autrePage).toHaveURL(/\/donateur/);

  await connecter(page, { email, motDePasse: premier });
  await expect(page.locator('.bandeau-verif')).toContainText(email);
  await sansDebordement(page);

  await page.goto('/donateur/profil');
  const securite = page.locator('.securite');
  await securite.getByRole('button', { name: 'Changer' }).click();
  await page.fill('#motDePasseActuel', 'pas-le-bon');
  await page.fill('#nouveauMotDePasseCompte', second);
  await page.fill('#confirmationMotDePasseCompte', second);
  await page.getByRole('button', { name: 'Changer mon mot de passe' }).click();
  await expect(securite).toContainText('incorrect');
  await page.fill('#motDePasseActuel', premier);
  await page.getByRole('button', { name: 'Changer mon mot de passe' }).click();
  await expect(page.locator('.securite__succes')).toContainText('changé');

  const ici = await page.evaluate(async () => (await fetch('/api/donateur/me')).status);
  expect(ici).toBe(200);
  const labas = await autrePage.evaluate(async () => (await fetch('/api/donateur/me')).status);
  expect(labas).toBe(401);
  await autre.close();

  await securite.getByRole('button', { name: 'Supprimer', exact: true }).click();
  const confirmer = page.getByRole('button', { name: 'Supprimer définitivement' });
  await page.fill('#motDePasseSuppression', second);
  await expect(confirmer).toBeDisabled();
  await page.fill('#confirmationSuppression', 'SUPPRIMER');
  await confirmer.click();
  await expect(page).toHaveURL(/\/authentification$/);
  await expect(page.locator('body')).toContainText('compte est supprimé');

  const apres = await request.post('/api/auth/login', { data: { email, motDePasse: second, typeUtilisateur: 'donateur' } });
  expect(apres.status()).toBe(401);
});
