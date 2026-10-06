/*
 * Accessibilite (WCAG 2.1 AA) : aucune violation grave ou critique
 * relevee par axe-core sur les pages principales.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { ADMIN, actualitePubliquePrete, adresseUnique, connecter, donateurPret, projetPublicPret } from './outils.js';

// Sans animation : axe mesure les couleurs au repos, pas pendant un fondu.
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const REGLES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/*
 * Des elements dont le contraste est connu et accepte : les couleurs pures
 * de la palette HOPE sur le site vitrine, retenues a la demande de HOPE
 * (28 et 29/09/2026) -- texte blanc sur les boutons orange et bleus, bleu
 * clair des titres d'actualite et du lien actif, orange du bouton
 * "Toutes nos...", carte Soins (blanc sur orange), titre Alimentation (bleu
 * sur jaune), texte violet fonce de la carte Scolarite. Seule la regle de
 * contraste leur est epargnee : toutes les autres s'y appliquent.
 */
// Le bouton d'acces de la barre (.vitrine-acces) : texte blanc sur l'orange
// de la charte, retenu tel quel a la demande de HOPE, comme l'ancien bouton.
const CONTRASTE_ACCEPTE = {
  '/': [
    '.vitrine-nav__lien--actif',
    '.vitrine-acces',
    '.accueil-bouton--orange',
    '.accueil-bouton--bleu',
    '.v-activite--scolarite .v-activite__texte',
    '.v-activite--soins .v-activite__carte',
    '.v-activite--alimentation .v-activite__titre',
    '.v-bouton-contour',
    '.v-actualite__titre',
    '.v-actualite__lien',
  ],
  '/nous-decouvrir': [
    '.vitrine-nav__lien--actif',
    '.vitrine-acces',
    '.accueil-bouton--orange',
    '.accueil-bouton--bleu',
  ],
  '/nos-projets': ['.vitrine-nav__lien--actif', '.vitrine-acces', '.accueil-bouton--orange'],
  '/nos-projets/:id': ['.vitrine-nav__lien--actif', '.vitrine-acces', '.accueil-bouton--orange'],
  '/actualites': ['.vitrine-nav__lien--actif', '.vitrine-acces', '.accueil-bouton--orange', '.v-actualite__titre', '.v-actualite__lien'],
  '/actualites/:id': ['.vitrine-nav__lien--actif', '.vitrine-acces', '.accueil-bouton--orange'],
  '/contact': ['.vitrine-nav__lien--actif', '.vitrine-acces', '.accueil-bouton--orange', '.parcours__continuer'],
  '/s-engager': [
    '.vitrine-nav__lien--actif',
    '.vitrine-acces',
    '.accueil-bouton--orange',
    '.engager-carte--entreprises',
    '.engager-carte--donateurs',
  ],
};

async function auditer(page, nom) {
  const acceptes = CONTRASTE_ACCEPTE[nom] ?? [];
  let audit = new AxeBuilder({ page }).withTags(REGLES);
  for (const selecteur of acceptes) audit = audit.exclude(selecteur);
  const { violations } = await audit.analyze();
  if (acceptes.length > 0) {
    let reste = new AxeBuilder({ page }).withTags(REGLES).disableRules(['color-contrast']);
    for (const selecteur of acceptes) reste = reste.include(selecteur);
    violations.push(...(await reste.analyze()).violations);
  }
  const graves = violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  const resume = graves.map((v) => `${v.id} (${v.impact}) x${v.nodes.length} : ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
  expect.soft(resume, `${nom} : violations graves`).toEqual([]);
}

test('pages publiques', async ({ page }) => {
  for (const chemin of ['/', '/nous-decouvrir', '/nos-projets', '/actualites', '/s-engager', '/contact', '/authentification', '/confidentialite', '/conditions-utilisation', '/mot-de-passe-oublie', '/admin/login']) {
    await page.goto(chemin);
    await page.waitForLoadState('networkidle');
    await auditer(page, chemin);
  }
});

test('la fiche d un projet', async ({ page, request }, testInfo) => {
  const projet = await projetPublicPret(request, testInfo, { nom: 'Accessible' });
  await page.goto(`/nos-projets/${projet.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(projet.name);
  await page.waitForLoadState('networkidle');
  await auditer(page, '/nos-projets/:id');
});

test('l article d une actualite', async ({ page, request }, testInfo) => {
  const actualite = await actualitePubliquePrete(request, testInfo, { titre: 'Accessible' });
  await page.goto(`/actualites/${actualite.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(actualite.titre);
  await page.waitForLoadState('networkidle');
  await auditer(page, '/actualites/:id');
});

test('espace donateur', async ({ page, request }, testInfo) => {
  const email = adresseUnique(testInfo, 'a11y');
  await donateurPret(request, email, 'accessible-2026', { complet: true });
  await connecter(page, { email, motDePasse: 'accessible-2026' });
  for (const chemin of ['/donateur', '/donateur/profil', '/donateur/dons', '/donateur/projets']) {
    await page.goto(chemin);
    await page.waitForLoadState('networkidle');
    await auditer(page, chemin);
  }
});

test('administration', async ({ page }) => {
  await page.goto('/admin/login');
  await page.fill('input[name="adminLog"]', ADMIN.adminLog);
  await page.fill('input[name="password"]', ADMIN.password);
  await page.getByRole('button', { name: /connecter/i }).first().click();
  await expect(page).not.toHaveURL(/\/admin\/login/, { timeout: 20_000 });
  for (const chemin of ['/admin', '/admin/projects', '/admin/budget', '/admin/audit']) {
    await page.goto(chemin);
    await page.waitForLoadState('networkidle');
    await auditer(page, chemin);
  }
});
