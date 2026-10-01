/*
 * Ce que voit un visiteur sans compte : l'authentification, les textes
 * legaux, et les portes fermees.
 */
import { expect, test } from '@playwright/test';

import { actualitePubliquePrete, benevoleVisiblePret, projetPublicPret, sansDebordement } from './outils.js';

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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Découvrez tous\s*nos projets/);
  await expect(page.locator('.realisations-carte')).toHaveCount(items.length);
  await sansDebordement(page);

  // La recherche ne garde que lui, sans accents ni majuscules ; rien ne
  // correspond a du bruit, et tout revient d'un clic.
  const champ = page.getByRole('searchbox', { name: 'Rechercher un projet' });
  await champ.fill(projet.name.toUpperCase());
  await expect(page.locator('.realisations-carte')).toHaveCount(1);
  await expect(page.locator('.realisations-carte')).toContainText(projet.name);
  await champ.fill('zzzz-introuvable');
  await expect(page.locator('.v-liste__message')).toContainText('Aucun projet ne correspond');
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

test('actualites : celles publiees par l administration, a la une, la recherche, l article', async ({ page, request }, testInfo) => {
  const actualite = await actualitePubliquePrete(request, testInfo);
  const { items } = await (await request.get('/api/public/actualites?limite=60')).json();
  expect(items.some((a) => a.id === actualite.id)).toBe(true);

  // Le bandeau met la plus recente a la une ; toutes sont en cartes.
  await page.goto('/actualites');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(items[0].titre);
  await expect(page.locator('.actualites-carte')).toHaveCount(items.length);
  await sansDebordement(page);

  const champ = page.getByRole('searchbox', { name: 'Rechercher une actualité' });
  await champ.fill(actualite.titre.toUpperCase());
  await expect(page.locator('.actualites-carte')).toHaveCount(1);
  await champ.fill('zzzz-introuvable');
  await expect(page.locator('.v-liste__message')).toContainText('Aucune actualité ne correspond');
  await page.getByRole('button', { name: 'Voir toutes les actualités' }).click();
  await expect(page.locator('.actualites-carte')).toHaveCount(items.length);

  // L'article : le titre, les deux paragraphes, la date.
  await champ.fill(actualite.titre);
  await page.locator('.actualites-carte .v-actualite__lien').first().click();
  await expect(page).toHaveURL(new RegExp(`/actualites/${actualite.id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(actualite.titre);
  await expect(page.locator('.realisation__texte p')).toHaveCount(2);
  await expect(page.locator('.realisation__fiche')).toContainText('Publié');
  await sansDebordement(page);

  await page.goto('/actualites/0d7e2a2e-7d3f-4a6f-9c1b-2f8a3e5b1c11');
  await expect(page.locator('.realisation__message')).toContainText('introuvable');
});

test('s engager : les trois voies, puis l appel au don et au partenariat', async ({ page }) => {
  await page.goto('/s-engager');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('écrivons une plus belle histoire');
  await expect(page.locator('.engager-carte')).toHaveCount(3);
  await expect(page.locator('.engager-carte .engager-soleil')).toHaveCount(3);
  await sansDebordement(page);

  const appel = page.locator('.engager-appel');
  await expect(appel.getByRole('link', { name: 'Faire un don' })).toHaveAttribute('href', '/authentification?type=donateur');
  await appel.getByRole('link', { name: 'Devenir partenaire' }).click();
  await expect(page).toHaveURL(/\/authentification\?type=bailleur$/);
  await expect(page.locator('#typeConnexion')).toHaveValue('bailleur');
});

test('l accueil : les realisations et les actualites sont celles de la plateforme', async ({ page, request }, testInfo) => {
  const projet = await projetPublicPret(request, testInfo, { nom: 'Accueil' });
  const actualite = await actualitePubliquePrete(request, testInfo, { titre: 'Accueil' });
  // Trois cartes au plus : autant que la plateforme a de projets.
  const { items } = await (await request.get('/api/public/projets?limite=3')).json();
  await page.goto('/');
  await expect(page.locator('.v-realisation')).toHaveCount(items.length);
  // Le projet seme est le plus recent : il ouvre la liste.
  await expect(page.locator('.v-realisation__titre').first()).toHaveText(projet.name);
  await expect(page.locator('.v-realisation__lien').first()).toHaveAttribute('href', `/nos-realisations/${projet.id}`);
  await expect(page.locator('.v-actualite__titre').first()).toHaveText(actualite.titre);
  await expect(page.locator('.v-actualite__lien').first()).toHaveAttribute('href', `/actualites/${actualite.id}`);
});

test('nous decouvrir : les benevoles de la plateforme, par leur prenom', async ({ page, request }, testInfo) => {
  const benevole = await benevoleVisiblePret(request, testInfo);
  await page.goto('/nous-decouvrir');
  await page.locator('.v-benevoles').scrollIntoViewIfNeeded();
  await expect(page.locator('.v-benevole__nom', { hasText: benevole.prenom })).toHaveCount(1);
  // Ni nom de famille, ni adresse : seulement le prenom.
  await expect(page.locator('.v-benevoles')).not.toContainText('Rakoto');
  await sansDebordement(page);
});
