/*
 * Ce que voit un visiteur sans compte : l'authentification, les textes
 * legaux, et les portes fermees.
 */
import { expect, test } from '@playwright/test';

import { ADMIN, actualitePubliquePrete, benevoleVisiblePret, projetPublicPret, sansDebordement } from './outils.js';

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

test('sans session, l administration renvoie vers la porte unique, le choix "Aucun" fait', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/authentification\?type=aucun$/);
  await expect(page.locator('#typeConnexion')).toHaveValue('aucun');
  await expect(page.locator('label[for="email"]')).toHaveText('Identifiant');
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

  await page.goto('/nos-projets');
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
  await expect(page).toHaveURL(new RegExp(`/nos-projets/${projet.id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(projet.name);
  await expect(page.locator('.realisation__sous-titre')).toHaveText('Des livres pour toute une commune');
  await expect(page.locator('.realisation__texte p')).toHaveCount(2);
  await expect(page.locator('.realisation__fiche')).toContainText('Moramanga');
  await sansDebordement(page);

  await page.goto('/nos-projets/999999');
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
  await expect(appel.getByRole('link', { name: 'Faire un don' })).toHaveAttribute('href', '/faire-un-don');
  await appel.getByRole('link', { name: 'Devenir partenaire' }).click();
  await expect(page).toHaveURL(/\/authentification\?type=bailleur$/);
  await expect(page.locator('#typeConnexion')).toHaveValue('bailleur');
});

/** Coche un bouton radio dont la carte entre encore en scene : on insiste jusqu'a ce qu'il le soit. */
async function cocher(radio) {
  await expect(async () => {
    await radio.check({ force: true });
    await expect(radio).toBeChecked({ timeout: 500 });
  }).toPass();
}

test('faire un don sans compte : connexion et don dans l en-tete, trois etapes, puis MVola', async ({ page }) => {
  await page.goto('/');
  const droite = page.locator('.vitrine-entete__droite');
  // Le bouton d'acces : son mot alterne, sa fleche ouvre les deux portes en clair.
  await expect(droite.locator('.vitrine-acces__principal')).toContainText('Faire un don');
  await droite.getByRole('button', { name: /faire un don ou se connecter/i }).click();
  const menu = droite.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: 'Faire un don' })).toHaveAttribute('href', '/faire-un-don');
  await expect(menu.getByRole('menuitem', { name: 'Connexion' })).toHaveAttribute('href', '/authentification');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  if (page.viewportSize().width <= 1100) {
    await page.locator('.vitrine-entete__menu').click();
    await expect(page.locator('.vitrine-mobile').getByRole('link', { name: 'Connexion' })).toBeVisible();
    await page.locator('.vitrine-entete__menu').click();
  }

  // L'introduction : a quoi sert le geste, les trois etapes, les chiffres.
  await droite.getByRole('button', { name: /faire un don ou se connecter/i }).click();
  await droite.getByRole('menuitem', { name: 'Faire un don' }).click();
  await expect(page).toHaveURL(/\/faire-un-don$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Votre geste change une vie');
  await expect(page.locator('.don-intro__etape')).toHaveCount(3);
  await sansDebordement(page);
  await page.getByRole('button', { name: 'Commencer mon don' }).click();

  // Etape 1 : qui donne, avec son courriel ; sans adresse postale.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Faisons connaissance');
  await expect(page.locator('.parcours__pas')).toHaveCount(3);
  await expect(page.locator('#donateur-adresse')).toHaveCount(0);
  await page.locator('.parcours__continuer').click();
  await expect(page.locator('.parcours__recap')).toContainText('5 champs demandent votre attention');
  await sansDebordement(page);

  const courriel = `invite-${Date.now()}@hope.test`;
  await page.fill('#donateur-nom', 'Rakoto');
  await page.fill('#donateur-prenom', 'Essai');
  await page.fill('#donateur-courriel', courriel);
  if (page.viewportSize().width < 900) {
    // Sur telephone, le pays se choisit sur une page a part.
    await page.locator('#donateur-pays').click();
    await page.locator('.choix-page__saisie').fill('Madagascar');
    await page.locator('.choix-page__option', { hasText: 'Madagascar' }).first().click();
  } else {
    await page.selectOption('#donateur-pays', 'MG');
  }
  await page.fill('#donateur-telephone', '0341234567');
  await page.locator('.parcours__continuer').click();

  // Etape 2 : le fonds HOPE ; etape 3 : MVola.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Affectation de votre don');
  await cocher(page.locator('input[name="affectation"][value="HOPE"]'));
  await page.locator('.parcours__continuer').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mode de paiement');
  await cocher(page.locator('input[name="paiement"][value="mvola"]'));
  await page.locator('.parcours__continuer').click();

  // La page MVola : le numero saisi a l'etape 1 est deja la ; le montant,
  // la reference, et le don part en attente de confirmation.
  await expect(page).toHaveURL(/\/faire-un-don\/mvola$/);
  await expect(page.locator('#mvola-numero')).toHaveValue('341234567');
  await page.fill('#mvola-montant', '10000');
  await page.locator('form[aria-label="Montant du don"] button[type="submit"]').click();
  const reference = page.locator('form[aria-label="Référence de la transaction"]');
  await reference.locator('input').fill(`MP${Date.now() % 100000}.E2E`);
  await reference.locator('button[type="submit"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Misaotra');
  await expect(page.locator('body')).toContainText('En attente de confirmation');
  await sansDebordement(page);

  // La sortie ramene au site.
  await page.getByRole('button', { name: 'Revenir au site HOPE' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('contact : le formulaire ecrit a l equipe, qui le voit dans sa cloche', async ({ page, request }, testInfo) => {
  await page.goto('/contact');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Parlons');
  await expect(page.locator('.contact-sujet')).toHaveCount(5);
  await sansDebordement(page);

  // Vide : les champs se plaignent, rien ne part.
  await page.getByRole('button', { name: 'Envoyer mon message' }).click();
  await expect(page.locator('.parcours__recap')).toContainText('demandent votre attention');

  const nom = `Essai Contact ${testInfo.project.name} ${Date.now().toString(36)}`;
  await page.fill('#contact-nom', nom);
  await page.fill('#contact-courriel', `contact-${Date.now()}@hope.test`);
  await page.locator('.contact-sujet', { hasText: 'Devenir bénévole' }).click();
  await page.fill('#contact-message', 'Bonjour, je voudrais donner un peu de mon temps le samedi.');
  await page.getByRole('button', { name: 'Envoyer mon message' }).click();
  await expect(page.locator('.contact-merci__titre')).toContainText('Merci Essai');
  await sansDebordement(page);

  // Cote equipe : la cloche porte le message.
  const connexion = await request.post('/api/admin/login', { data: ADMIN });
  expect(connexion.status(), 'connexion administrateur').toBe(200);
  const entetes = { Authorization: `Bearer ${(await connexion.json()).token}` };
  const reponse = await request.get('/api/admin/notifications', { headers: entetes, params: { type: 'CONTACT' } });
  expect(reponse.status()).toBe(200);
  const corps = await reponse.json();
  const liste = Array.isArray(corps) ? corps : (corps.items ?? corps.notifications ?? []);
  expect(liste.some((n) => n.type === 'CONTACT' && String(n.label).includes(nom)), 'la notification du message').toBe(true);

  // Un autre message : le formulaire revient vide.
  await page.getByRole('button', { name: 'Envoyer un autre message' }).click();
  await expect(page.locator('#contact-nom')).toHaveValue('');
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
  await expect(page.locator('.v-realisation__lien').first()).toHaveAttribute('href', `/nos-projets/${projet.id}`);
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
