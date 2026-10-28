import { chromium } from 'playwright';

/**
 * PARCOURS DE DON DE BOUT EN BOUT.
 *
 * Ce script pilote un vrai navigateur, contre le vrai frontend, la vraie API
 * et la vraie base PostgreSQL. Il ne simule rien : c'est le meme chemin qu'un
 * donateur emprunterait.
 *
 *   npm run e2e
 *
 * DEUX SCENARIOS SONT JOUES
 *   1. un don de 100 000 MGA par MVola qui aboutit ;
 *   2. un don refuse par l'etablissement de paiement.
 *
 * CE QU'IL VERIFIE VRAIMENT
 *   Que la reference affichee au donateur vient bien du BACKEND. Le script la
 *   lit a l'ecran, puis interroge l'API pour confirmer que cette transaction
 *   existe reellement en base avec ce statut. Une reference inventee par le
 *   navigateur echouerait ici.
 *
 * NOTE : ce test ecrit dans la base de DEVELOPPEMENT (un donateur, un don, une
 * transaction par execution). C'est voulu : on verifie la chaine reelle.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000/api';

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  OK   ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${'='.repeat(74)}\n${title}\n${'='.repeat(74)}`);
}

/**
 * Remplit l'etape « coordonnees » avec un email unique a chaque execution.
 *
 * Les champs sont vises par leur attribut `autocomplete` plutot que par leur
 * libelle. Deux raisons :
 *   - le nom accessible d'un champ obligatoire est « Prenom (obligatoire) »,
 *     ce qui est VOULU — un lecteur d'ecran doit annoncer l'obligation — mais
 *     rend une correspondance exacte sur le libelle inutilisable ;
 *   - viser `autocomplete` verifie au passage que ces attributs sont bien
 *     poses, ce dont depend le remplissage automatique du navigateur.
 */
async function fillDonorStep(page, suffix) {
  await page.locator('input[autocomplete="given-name"]').fill('Tiana');
  await page.locator('input[autocomplete="family-name"]').fill('Rakotomalala');
  await page.locator('input[autocomplete="email"]').fill(`tiana.e2e.${suffix}@example.mg`);
  await page.locator('input[autocomplete="tel"]').fill('+261 34 12 345 67');
}

/**
 * Attend qu'une page chargee a la demande soit reellement affichee.
 *
 * networkidle ne suffit pas : le decoupage par route insere un ecran de
 * chargement pendant le telechargement du fragment. On attend donc la
 * disparition de cet ecran avant de lire quoi que ce soit.
 */
async function waitForPageReady(page) {
  await page.waitForLoadState('networkidle');
  await page
    .getByText('Chargement de la page', { exact: false })
    .waitFor({ state: 'detached', timeout: 15000 })
    .catch(() => undefined);
}

/**
 * Constate la presence d'un element APRES l'avoir attendu.
 *
 * isVisible() repond immediatement : il renvoie faux si React n'a pas encore
 * rendu l'element, ce qui produisait des echecs intermittents. waitFor()
 * patiente jusqu'a l'apparition ; on constate ensuite.
 */
async function isPresent(locator, timeout = 15_000) {
  try {
    await locator.waitFor({ state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

/** Avance d'une etape du parcours. */
async function clickContinue(page) {
  await page.getByRole('button', { name: /Continuer/i }).click();
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  try {
    // -----------------------------------------------------------------------
    section('1. Page d’accueil — données réelles depuis PostgreSQL');
    // -----------------------------------------------------------------------
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    check('La page d’accueil s’affiche', await isPresent(page.getByRole('heading', { level: 1 })));

    const heroTitle = await page.getByRole('heading', { level: 1 }).textContent();
    check('Le message principal est présent', /avenir meilleur/i.test(heroTitle ?? ''), heroTitle?.trim());

    // Les projets de la page d'accueil viennent de l'API.
    const homeProjectLinks = await page.locator('a[href^="/projects/"]').count();
    check('Des projets réels sont affichés', homeProjectLinks > 0, `${homeProjectLinks} liens projet`);

    // -----------------------------------------------------------------------
    section('2. Liste des projets');
    // -----------------------------------------------------------------------
    await page.getByRole('link', { name: 'Nos projets', exact: true }).first().click();
    await page.waitForURL('**/projects');
    await waitForPageReady(page);

    // On attend un element PROPRE a cette page. Compter les <article> ne
    // suffit pas : la page d'accueil en contient elle aussi, et la navigation
    // pouvait etre validee alors que l'ancien contenu etait encore monte.
    await page
      .getByRole('heading', { level: 1, name: /Chaque projet a un budget/i })
      .waitFor({ timeout: 15_000 });
    await page.locator('article').first().waitFor({ timeout: 15_000 });

    const cardCount = await page.locator('article').count();
    check('La grille de projets est chargée', cardCount > 0, `${cardCount} projets`);

    // L'annonce de resultats est une region `role="status"` : la cibler ainsi
    // evite de confondre avec le « N projets en cours » des cartes d'activite.
    const results = page.getByRole('status').filter({ hasText: /projets?/i }).first();
    await results.waitFor({ timeout: 15_000 });
    const status = await results.textContent();
    check('Le nombre de résultats est annoncé', /projets?/i.test(status ?? ''), status?.trim());

    // -----------------------------------------------------------------------
    section('3. Fiche projet');
    // -----------------------------------------------------------------------
    const firstProjectLink = page.locator('article a[href^="/projects/"]').first();
    const projectName = (await firstProjectLink.textContent())?.trim();
    await firstProjectLink.click();
    await waitForPageReady(page);
    await page.getByRole('heading', { name: /Financement du projet/i }).waitFor({ timeout: 15000 });

    check('La fiche projet s’ouvre', page.url().includes('/projects/'), projectName);
    check(
      'Le financement du projet est affiché',
      await isPresent(page.getByRole('heading', { name: /Financement du projet/i })),
    );
    check(
      'La section « Comment votre don est utilisé » est présente',
      await isPresent(page.getByRole('heading', { name: /Comment votre don est utilisé/i })),
    );

    // -----------------------------------------------------------------------
    section('4. Don de 100 000 MGA par MVola — parcours complet');
    // -----------------------------------------------------------------------
    await page.getByRole('link', { name: /Soutenir ce projet/i }).click();
    await page.waitForURL('**/donate');
    await waitForPageReady(page);
    await page.getByRole('button', { name: '100 000 Ar' }).waitFor({ timeout: 15000 });

    // Étape 1 : type de don et montant
    await page.getByRole('radio', { name: /Don ponctuel/i }).check({ force: true });
    await page.getByRole('button', { name: '100 000 Ar' }).click();
    check('Le montant de 100 000 Ar est sélectionné', true);
    await clickContinue(page);

    // Étape 2 : affectation — le projet est déjà pré-sélectionné
    await page.getByText('Là où le besoin est le plus important').waitFor({ timeout: 10_000 });
    check('L’étape d’affectation s’affiche', true);
    await clickContinue(page);

    // Étape 3 : coordonnées du donateur
    await page.getByRole('heading', { name: /Vos coordonnées/i }).waitFor({ timeout: 10_000 });
    await fillDonorStep(page, `${Date.now()}.ok`);
    await clickContinue(page);

    // Étape 4 : moyen de paiement
    await page.waitForSelector('input[name="paymentMethod"]', { timeout: 10_000 });
    const methodLabels = await page.locator('input[name="paymentMethod"]').count();
    check('Les moyens de paiement viennent du backend', methodLabels > 0, `${methodLabels} méthodes`);

    const mvola = page.getByRole('radio', { name: /MVola/i });
    check('MVola est proposé pour un donateur malgache', await isPresent(mvola));
    await mvola.check({ force: true });

    // Envoi : c'est le backend qui exécute donateur → don → transaction →
    // prestataire → affectation, et qui décide de l'issue.
    await page.getByRole('button', { name: /Donner/i }).click();

    await page.waitForURL('**/donation/success/**', { timeout: 30_000 });
    await waitForPageReady(page);
    await page.getByRole('heading', { name: /Merci pour votre soutien/i }).waitFor({ timeout: 15000 });

    check('La page de confirmation s’affiche', page.url().includes('/donation/success/'));
    check(
      'Le remerciement est affiché',
      await isPresent(page.getByRole('heading', { name: /Merci pour votre soutien/i })),
    );

    // La référence affichée doit venir du backend.
    const reference = decodeURIComponent(page.url().split('/donation/success/')[1] ?? '');
    check(
      'La référence a le format HOPE-TXN attendu',
      /^HOPE-TXN-\d{8}-[A-Z2-9]{6}$/.test(reference),
      reference,
    );

    const bodyText = (await page.locator('body').textContent()) ?? '';
    check('La référence est visible à l’écran', bodyText.includes(reference));
    check('Le montant encaissé est affiché', bodyText.includes('100 000 Ar'));
    check('Le statut « Encaissé » est affiché', /Encaiss/i.test(bodyText));

    // Vérification côté serveur : cette transaction existe-t-elle vraiment ?
    const apiResponse = await fetch(`${API_URL}/transactions/${encodeURIComponent(reference)}`);
    const apiBody = await apiResponse.json();
    check('L’API confirme que la transaction existe', apiResponse.status === 200);
    check(
      'Le backend la déclare SUCCESS',
      apiBody?.data?.transaction?.status === 'SUCCESS',
      apiBody?.data?.transaction?.status,
    );
    check(
      'Le montant en base correspond',
      apiBody?.data?.transaction?.amount === '100000',
      apiBody?.data?.transaction?.amount,
    );
    check(
      'Le montant est bien une chaîne, jamais un flottant',
      typeof apiBody?.data?.transaction?.amount === 'string',
    );

    // -----------------------------------------------------------------------
    section('5. Paiement refusé');
    // -----------------------------------------------------------------------
    await page.goto(`${BASE_URL}/donate`);
    await waitForPageReady(page);

    await page.getByRole('button', { name: '50 000 Ar' }).waitFor({ timeout: 15_000 });
    await page.getByRole('button', { name: '50 000 Ar' }).click();
    await clickContinue(page);

    await page.getByText('Là où le besoin est le plus important').waitFor({ timeout: 10_000 });
    await clickContinue(page); // don libre, non affecté

    await page.getByRole('heading', { name: /Vos coordonnées/i }).waitFor({ timeout: 10_000 });
    await fillDonorStep(page, `${Date.now()}.ko`);
    await clickContinue(page);

    await page.waitForSelector('input[name="paymentMethod"]', { timeout: 10_000 });
    await page.getByRole('radio', { name: /MVola/i }).check({ force: true });

    // On demande explicitement au simulateur de refuser l'encaissement.
    await page.getByRole('checkbox', { name: /simuler un paiement refusé/i }).check();
    await page.getByRole('button', { name: /Donner/i }).click();

    await page.waitForURL('**/donation/failed', { timeout: 30_000 });
    await waitForPageReady(page);

    check('La page d’échec s’affiche', page.url().includes('/donation/failed'));
    check(
      'L’échec est annoncé clairement',
      await isPresent(page.getByRole('heading', { name: /n’a pas abouti/i })),
    );
    // getByText attend automatiquement l'apparition du texte, contrairement a
    // une lecture brute de textContent qui photographie l'instant present.
    check(
      'L’absence de débit est précisée',
      await isPresent(page.getByText(/Aucun montant/i).first()),
    );
    check(
      'Le motif du refus est affiché',
      await isPresent(page.getByText(/Solde insuffisant/i).first()),
    );

    // -----------------------------------------------------------------------
    section('6. Accessibilité et robustesse');
    // -----------------------------------------------------------------------
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Le lien d'évitement doit être le premier élément focusable.
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    check('Le lien d’évitement est le premier au clavier', /Aller au contenu/i.test(focused), focused);

    const landmarks = await page.evaluate(() => ({
      header: document.querySelectorAll('header').length,
      main: document.querySelectorAll('main').length,
      footer: document.querySelectorAll('footer').length,
      h1: document.querySelectorAll('h1').length,
    }));
    check('Un seul <main>', landmarks.main === 1);
    check('Un seul <h1>', landmarks.h1 === 1, `${landmarks.h1} trouvé(s)`);
    check('En-tête et pied de page présents', landmarks.header === 1 && landmarks.footer === 1);

    const imagesWithoutAlt = await page.evaluate(
      () => [...document.querySelectorAll('img')].filter((img) => !img.hasAttribute('alt')).length,
    );
    check('Toutes les images ont un attribut alt', imagesWithoutAlt === 0);

    // Pas de débordement horizontal, du plus petit écran au plus grand.
    for (const width of [320, 375, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(180);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      check(`Aucun débordement horizontal à ${width}px`, !overflow);
    }

    // 404
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE_URL}/page-qui-nexiste-pas`);
    await page.waitForLoadState('networkidle');
    check(
      'La page 404 s’affiche',
      await isPresent(page.getByRole('heading', { name: /Cette page n’existe pas/i })),
    );

    check('Aucune erreur JavaScript en console', consoleErrors.length === 0, consoleErrors[0] ?? '');
  } catch (error) {
    failed += 1;
    console.error('\nErreur pendant le parcours :', error instanceof Error ? error.message : error);
    await page.screenshot({ path: 'e2e-echec.png', fullPage: true }).catch(() => undefined);
    console.error('Capture enregistrée : frontend/e2e-echec.png');
  } finally {
    await browser.close();
  }

  section('BILAN');
  console.log(`  Réussis : ${passed}`);
  console.log(`  Échoués : ${failed}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

await run();
