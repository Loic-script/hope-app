/*
 * Ce que voit un visiteur sans compte : l'authentification, les textes
 * legaux, et les portes fermees.
 */
import { expect, test } from '@playwright/test';

import { projetPublicPret, sansDebordement } from './outils.js';

test('le choix des espaces ; l authentification mene aux textes legaux', async ({ page }) => {
  await page.goto('/espaces');
  await expect(page.getByRole('link', { name: 'Donateur, bénévole ou bailleur' })).toBeVisible();
  await page.goto('/authentification');
  await expect(page.locator('.liens-legaux a')).toHaveCount(2);
  await sansDebordement(page);
});

test('la politique de confidentialite : sommaire, articles, contact', async ({ page }) => {
  await page.goto('/confidentialite');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Politique de confidentialité');
  await expect(page.locator('.legal__article')).toHaveCount(10);
  await expect(page.locator('#droits')).toContainText('CMIL');
  // L'adresse publiee par le serveur (EQUIPE_EMAIL).
  await expect(page.locator('a[href="mailto:contact@hope.test"]').first()).toBeVisible();
  await sansDebordement(page);

  if (page.viewportSize().width < 900) await page.locator('.legal__sommaire-bouton').click();
  await page.locator('.legal__entree', { hasText: 'Vos droits' }).click();
  await expect(page.locator('.legal__entree--active')).toContainText('Vos droits');

  await page.locator('.legal__onglet').nth(1).click();
  await expect(page).toHaveURL(/\/conditions-utilisation$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Conditions générales d’utilisation');
  await sansDebordement(page);
});

test('sans session, l administration renvoie vers sa connexion', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('l API refuse proprement : route inconnue, session absente, origine etrangere', async ({ request }) => {
  const inconnue = await request.get('/api/nulle-part');
  expect(inconnue.status()).toBe(404);
  expect((await inconnue.json()).code).toBe('ROUTE_INTROUVABLE');

  expect((await request.get('/api/admin/projects')).status()).toBe(401);
  expect((await request.get('/api/espace/compte')).status()).toBe(401);

  const etrangere = await request.post('/api/auth/logout', { headers: { Origin: 'https://site-malveillant.example' } });
  expect(etrangere.status()).toBe(403);

  const sante = await request.get('/api/sante');
  expect(await sante.json()).toEqual({ statut: 'ok' });
  expect(sante.headers()['x-frame-options']).toBe('DENY');
});

test('nos realisations : les projets de la plateforme, la recherche, la fiche', async ({ page, request }, testInfo) => {
  // Un projet seme par l'administration : le site le montre aussitot.
  const projet = await projetPublicPret(request, testInfo);
  const { items } = await (await request.get('/api/public/projets?limite=60')).json();
  expect(items.some((p) => p.id === projet.id)).toBe(true);

  await page.goto('/nos-realisations');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('nos projets réalisés');
  await expect(page.locator('.realisations-carte')).toHaveCount(items.length);
  await sansDebordement(page);

  // La recherche ne garde que lui, sans accents ni majuscules ; rien ne
  // correspond a du bruit, et tout revient d'un clic.
  const champ = page.getByRole('searchbox', { name: 'Rechercher un projet' });
  await champ.fill(projet.name.toUpperCase());
  await expect(page.locator('.realisations-carte')).toHaveCount(1);
  await expect(page.locator('.realisations-carte')).toContainText(projet.name);
  await champ.fill('zzzz-introuvable');
  await expect(page.locator('.realisations__message')).toContainText('Aucun projet ne correspond');
  await page.getByRole('button', { name: 'Voir tous les projets' }).click();
  await expect(page.locator('.realisations-carte')).toHaveCount(items.length);

  // Sa fiche : le nom, le sous-titre, les deux paragraphes, le lieu.
  await champ.fill(projet.name);
  await page.locator('.realisations-carte__lien').first().click();
  await expect(page).toHaveURL(new RegExp(`/nos-realisations/${projet.id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(projet.name);
  await expect(page.locator('.realisation__sous-titre')).toHaveText('Des livres pour toute une commune');
  await expect(page.locator('.realisation__texte p')).toHaveCount(2);
  await expect(page.locator('.realisation__fiche')).toContainText('Moramanga');
  await sansDebordement(page);

  await page.goto('/nos-realisations/999999');
  await expect(page.locator('.realisation__message')).toContainText('introuvable');
});
