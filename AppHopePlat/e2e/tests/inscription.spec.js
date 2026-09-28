/*
 * S'inscrire : le consentement exige, la session en cookie httpOnly,
 * l'adresse confirmee par le lien du courriel.
 */
import { expect, test } from '@playwright/test';

import { aucunJetonLisible, adresseUnique, dernierLien, inscrire, sansDebordement } from './outils.js';

test('inscription d un donateur, de la case de consentement a l adresse confirmee', async ({ page, context }, testInfo) => {
  const email = adresseUnique(testInfo, 'inscription');
  const motDePasse = 'inscription-2026';

  // Sans la case : rien ne part.
  await inscrire(page, { email, motDePasse, consentement: false });
  await expect(page.locator('#erreur-consentement')).toBeVisible();
  await sansDebordement(page);

  // Les textes s'ouvrent dans un nouvel onglet, sans perdre la saisie.
  const [onglet] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('.consentement a', { hasText: 'politique de confidentialité' }).click(),
  ]);
  await expect(onglet).toHaveURL(/\/confidentialite$/);
  await onglet.close();
  await expect(page.locator('input[name="email"]')).toHaveValue(email);

  await page.locator('label.case-a-cocher--texte').click({ position: { x: 10, y: 10 } });
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  // Le donateur entre dans son parcours d'accueil.
  await expect(page).toHaveURL(/\/donateur\/completer-profil/, { timeout: 20_000 });
  const cookie = (await context.cookies()).find((c) => c.name === 'hope_donateur');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Strict');
  await aucunJetonLisible(page);

  // Le lien du courriel confirme l'adresse, une seule fois.
  const jeton = await dernierLien(email, 'verifier-courriel');
  await page.goto(`/verifier-courriel?jeton=${jeton}`);
  await expect(page.locator('.note-acces--ok')).toContainText('confirmée');
  await page.goto(`/verifier-courriel?jeton=${jeton}`);
  await expect(page.locator('.formulaire__erreur')).toContainText('plus valable');
});

test('le serveur exige le consentement, meme sans le formulaire', async ({ request }, testInfo) => {
  const email = adresseUnique(testInfo, 'sans-case');
  const reponse = await request.post('/api/auth/inscription', {
    data: { email, typeUtilisateur: 'donateur', motDePasse: 'sans-case-2026', confirmation: 'sans-case-2026' },
  });
  expect(reponse.status()).toBe(400);
  expect((await reponse.json()).details).toHaveProperty('accepteConditions');
});
