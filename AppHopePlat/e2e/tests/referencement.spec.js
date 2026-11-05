import { expect, test } from '@playwright/test';

import { actualitePubliquePrete, projetPublicPret } from './outils.js';

function balise(html, motif) {
  return html.match(motif)?.[1] ?? null;
}

const titre = (html) => balise(html, /<title>([^<]*)<\/title>/);
const canonique = (html) => balise(html, /<link rel="canonical" href="([^"]*)"/);

test('sans navigateur : chaque page publique a son titre, sa description et son adresse canonique', async ({ request, baseURL }) => {
  const accueil = await (await request.get('/')).text();
  const projets = await (await request.get('/nos-projets')).text();

  expect(titre(accueil)).toBe('HOPE – Hope for a Better Life, association à Madagascar');
  expect(titre(projets)).toBe('Nos projets à Madagascar — HOPE');
  expect(canonique(accueil)).toBe(`${baseURL}/`);
  expect(canonique(projets)).toBe(`${baseURL}/nos-projets`);
  expect(balise(projets, /<meta name="description" content="([^"]*)"/)).not.toBe(
    balise(accueil, /<meta name="description" content="([^"]*)"/)
  );
  for (const html of [accueil, projets]) {
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(balise(html, /<meta property="og:image" content="([^"]*)"/)).toBe(`${baseURL}/partage.png`);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
    expect(html).toContain(`"logo":"${baseURL}/logo.png"`);
  }

  for (const image of ['/partage.png', '/apple-touch-icon.png', '/logo.png', '/favicon-96x96.png']) {
    const reponse = await request.get(image);
    expect(reponse.status(), image).toBe(200);
    expect(reponse.headers()['content-type'], image).toBe('image/png');
  }
  const icone = await request.get('/favicon.ico');
  expect(icone.status()).toBe(200);
  expect(icone.headers()['content-type']).toMatch(/^image\/(x-icon|vnd\.microsoft\.icon)$/);
  expect(accueil).toContain('<link rel="icon" href="/favicon.ico" sizes="48x48" />');
  expect(accueil).toContain('<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />');
});

test('sans navigateur : une fiche porte son titre ; les espaces sont hors index ; l inconnu repond 404', async ({ request, baseURL }, testInfo) => {
  const projet = await projetPublicPret(request, testInfo, { nom: 'École & "cantine"' });
  const actualite = await actualitePubliquePrete(request, testInfo);

  const fiche = await request.get(`/nos-projets/${projet.id}`);
  expect(fiche.status()).toBe(200);
  const html = await fiche.text();
  expect(titre(html)).toBe(`${projet.name.replace(/&/g, '&amp;').replace(/"/g, '&quot;')} — HOPE`);
  expect(canonique(html)).toBe(`${baseURL}/nos-projets/${projet.id}`);

  const article = await (await request.get(`/actualites/${actualite.id}`)).text();
  expect(titre(article)).toBe(`${actualite.titre} — HOPE`);
  expect(canonique(article)).toBe(`${baseURL}/actualites/${actualite.id}`);

  for (const chemin of ['/admin', '/donateur/mes-dons', '/authentification']) {
    const ferme = await request.get(chemin);
    expect(ferme.status(), chemin).toBe(200);
    const corps = await ferme.text();
    expect(corps, chemin).toContain('<meta name="robots" content="noindex" />');
    expect(canonique(corps), chemin).toBeNull();
  }

  for (const chemin of [
    '/une-page-qui-n-existe-pas',
    '/fichier-absent.png',
    '/sitemap_index.xml',
    '/nos-projets/999999',
    '/actualites/0d7e2a2e-7d3f-4a6f-9c1b-2f8a3e5b1c11',
    '/assets/absent.js',
  ]) {
    expect((await request.get(chemin)).status(), chemin).toBe(404);
  }

  const www = await request.get('/nos-projets?page=2', { headers: { 'X-Forwarded-Host': 'www.localhost' }, maxRedirects: 0 });
  expect(www.status()).toBe(301);
  expect(www.headers().location).toBe(`${baseURL}/nos-projets?page=2`);

  expect(await (await request.get('/robots.txt')).text()).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
  const plan = await (await request.get('/sitemap.xml')).text();
  expect(plan).toContain(`<loc>${baseURL}/nos-projets/${projet.id}</loc>`);
  expect(plan).toContain(`<loc>${baseURL}/faire-un-don</loc>`);
});

test('dans le navigateur : le titre suit la page affichee, avec les valeurs du serveur', async ({ page, request }, testInfo) => {
  const projet = await projetPublicPret(request, testInfo, { nom: 'Titre' });

  await page.goto('/');
  await expect(page).toHaveTitle('HOPE – Hope for a Better Life, association à Madagascar');

  if (page.viewportSize().width <= 1100) {
    await page.locator('.vitrine-entete__menu').click();
    await page.locator('.vitrine-mobile').getByRole('link', { name: 'Nos projets' }).click();
  } else {
    await page.locator('.vitrine-nav--droite').getByRole('link', { name: 'Nos projets' }).click();
  }
  await expect(page).toHaveURL(/\/nos-projets$/);
  const servi = titre(await (await request.get('/nos-projets')).text());
  await expect(page).toHaveTitle(servi);

  await page.getByRole('searchbox', { name: 'Rechercher un projet' }).fill(projet.name);
  await page.locator('.realisations-carte__lien').first().click();
  await expect(page).toHaveURL(new RegExp(`/nos-projets/${projet.id}$`));
  await expect(page).toHaveTitle(`${projet.name} — HOPE`);

  await page.goBack();
  await expect(page).toHaveTitle(servi);

  await page.goto('/confidentialite');
  await expect(page).toHaveTitle('Politique de confidentialité — HOPE');
  await page.locator('.legal__onglet').nth(1).click();
  await expect(page).toHaveTitle('Conditions générales d’utilisation — HOPE');

  await page.goto('/authentification');
  await expect(page).toHaveTitle('Connexion — HOPE');
});

test('dans le navigateur : une adresse inconnue affiche la page introuvable du site', async ({ page }) => {
  const reponse = await page.goto('/une-page-qui-n-existe-pas');
  expect(reponse.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page introuvable');
  await expect(page).toHaveTitle('Page introuvable — HOPE');
  await page.getByRole('link', { name: 'Retour à l’accueil', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle('HOPE – Hope for a Better Life, association à Madagascar');

  await page.goto('/nos-projets/999999');
  await expect(page.locator('.realisation__message')).toContainText('introuvable');
  await expect(page).toHaveTitle('Page introuvable — HOPE');

  await page.goto('/admin/ecran-inconnu');
  await expect(page).toHaveURL(/\/authentification\?type=aucun$/);
});
