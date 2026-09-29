/*
 * Accessibilite (WCAG 2.1 AA) : aucune violation grave ou critique
 * relevee par axe-core sur les pages principales.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { ADMIN, adresseUnique, connecter, donateurPret } from './outils.js';

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
const CONTRASTE_ACCEPTE = {
  '/': [
    '.vitrine-nav__lien--actif',
    '.vitrine-don',
    '.accueil-bouton--orange',
    '.accueil-bouton--bleu',
    '.v-activite--scolarite .v-activite__texte',
    '.v-activite--soins .v-activite__carte',
    '.v-activite--alimentation .v-activite__titre',
    '.v-bouton-contour',
    '.v-actualite__titre',
    '.v-actualite__lien',
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
  for (const chemin of ['/', '/authentification', '/confidentialite', '/conditions-utilisation', '/mot-de-passe-oublie', '/admin/login']) {
    await page.goto(chemin);
    await page.waitForLoadState('networkidle');
    await auditer(page, chemin);
  }
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
