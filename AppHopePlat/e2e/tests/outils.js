/*
 * Outils communs des tests de bout en bout.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const JOURNAL = path.join(ICI, '..', 'sortie', 'serveur.log');

/** Le compte administrateur de la base jetable (backend/tests/aide/baseDeTest.js). */
export const ADMIN = { adminLog: 'AdminTest', password: 'mot-de-passe-de-test-2026' };

/** Une adresse unique par test et par appareil. */
export function adresseUnique(testInfo, prefixe) {
  return `${prefixe}.${testInfo.project.name}.${Date.now().toString(36)}@hope.test`;
}

/**
 * Le dernier lien d'un courriel envoye a une adresse (le serveur de test
 * ecrit les courriels dans son journal, faute de SMTP).
 * @param {'verifier-courriel'|'reinitialiser-mot-de-passe'} page
 */
export async function dernierLien(email, page) {
  const motif = new RegExp(`${page}\\?jeton=([a-f0-9]{64})`);
  for (let essai = 0; essai < 20; essai += 1) {
    const texte = fs.existsSync(JOURNAL) ? fs.readFileSync(JOURNAL, 'utf8') : '';
    // Le serveur ecrit les courriels non envoyes (SMTP absent, ou domaine
    // reserve comme .test) sous la forme « [HOPE] Courriel (...) a <adresse> ».
    const blocs = texte.split(/\[HOPE\] Courriel \([^)]*\) a /).slice(1);
    const liens = blocs.filter((b) => b.startsWith(`${email} `)).map((b) => b.slice(0, 2000).match(motif)?.[1]).filter(Boolean);
    if (liens.length > 0) return liens[liens.length - 1];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Aucun lien ${page} pour ${email}`);
}

/** Aucun defilement horizontal sur la page. */
export async function sansDebordement(page) {
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(deborde, 'la page ne doit pas defiler horizontalement').toBe(false);
}

/** Aucun jeton JWT lisible par JavaScript dans le navigateur. */
export async function aucunJetonLisible(page) {
  const valeurs = await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage), document.cookie]);
  expect(valeurs.some((v) => String(v).includes('eyJ')), 'aucun JWT lisible par JavaScript').toBe(false);
}

/** S'inscrire depuis la page d'authentification. */
export async function inscrire(page, { email, type = 'donateur', motDePasse, consentement = true }) {
  await page.goto('/authentification');
  await page.getByRole('tab', { name: 'Inscription' }).click();
  await page.fill('input[name="email"]', email);
  await page.selectOption('#typeUtilisateur', type);
  await page.fill('input[name="motDePasse"]', motDePasse);
  await page.fill('#confirmation', motDePasse);
  if (consentement) await page.locator('label.case-a-cocher--texte').click({ position: { x: 10, y: 10 } });
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
}

/** Se connecter depuis la page d'authentification. */
export async function connecter(page, { email, type = 'donateur', motDePasse }) {
  await page.goto('/authentification');
  await page.fill('input[name="email"]', email);
  await page.selectOption('#typeConnexion', type);
  await page.fill('input[name="motDePasse"]', motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  // La connexion aboutie quitte la page d'authentification.
  await page.waitForURL((url) => !url.pathname.startsWith('/authentification'), { timeout: 20_000 });
}

/**
 * Un compte donateur cree par l'API, avec son parcours d'accueil : les
 * trois premieres etapes, ou les cinq (complet) pour entrer dans l'espace.
 */
export async function donateurPret(request, email, motDePasse, { complet = false } = {}) {
  const inscription = await request.post('/api/auth/inscription', {
    data: { email, typeUtilisateur: 'donateur', motDePasse, confirmation: motDePasse, accepteConditions: true },
  });
  expect(inscription.status()).toBe(201);
  const connexion = await request.post('/api/auth/login', { data: { email, motDePasse, typeUtilisateur: 'donateur' } });
  const { token } = await connexion.json();
  const entetes = { Authorization: `Bearer ${token}` };
  const telephone = `+26134${String(Date.now()).slice(-7)}`;
  for (const [etape, corps] of [
    ['etape-1', { nom: 'Rakoto', prenom: 'Essai', adresse: 'Lot II A 12', ville: 'Antananarivo', pays: 'MG', telephone, profession: 'Enseignant', source: 'autre' }],
    ['etape-2', { type: 'particulier', devise: 'MGA', langue: 'fr', fuseau: 'Indian/Antananarivo' }],
    ['etape-3', { affectation: 'HOPE' }],
    ...(complet ? [['etape-4', { mode: 'mvola' }], ['etape-5', { frequence: 'ONE_TIME' }]] : []),
  ]) {
    const r = await request.put(`/api/donateur/profil/${etape}`, { headers: entetes, data: corps });
    expect(r.status(), `${etape} : ${await r.text()}`).toBe(200);
  }
  return token;
}

/**
 * Un projet de la mission cree par l'API d'administration, tel que le
 * site vitrine le montre (GET /api/public/projets). Rend { id, name }.
 */
export async function projetPublicPret(request, testInfo, { nom = 'Bibliothèque' } = {}) {
  const connexion = await request.post('/api/admin/login', { data: ADMIN });
  expect(connexion.status(), 'connexion administrateur').toBe(200);
  const entetes = { Authorization: `Bearer ${(await connexion.json()).token}` };
  const catalogue = await (await request.get('/api/admin/catalog', { headers: entetes })).json();
  const name = `${nom} ${testInfo.project.name} ${Date.now().toString(36)}`;
  const creation = await request.post('/api/admin/projects', {
    headers: entetes,
    data: {
      name,
      categoryId: catalogue.categories[0].id,
      location: 'Moramanga',
      startDate: '2026-02-01',
      requiredBudget: '750000',
      descriptionTitre: 'Des livres pour toute une commune',
      description: 'Une bibliothèque ouverte aux enfants de Moramanga.\n\nDes lectures à voix haute chaque samedi, avec les mères du quartier.',
    },
  });
  expect(creation.status(), `creation du projet : ${await creation.text()}`).toBe(201);
  const corps = await creation.json();
  return { id: corps.id ?? corps.project?.id, name };
}

/**
 * Une actualite publiee par l'API d'administration, telle que le site
 * vitrine la montre (GET /api/public/actualites). Rend { id, titre }.
 */
export async function actualitePubliquePrete(request, testInfo, { titre = 'Rentrée des classes' } = {}) {
  const connexion = await request.post('/api/admin/login', { data: ADMIN });
  expect(connexion.status(), 'connexion administrateur').toBe(200);
  const entetes = { Authorization: `Bearer ${(await connexion.json()).token}` };
  const titreUnique = `${titre} ${testInfo.project.name} ${Date.now().toString(36)}`;
  const creation = await request.post('/api/admin/publications', {
    headers: entetes,
    data: {
      type: 'actualite',
      titre: titreUnique,
      corps: 'Cette année encore, HOPE accompagne la rentrée des enfants.\n\nFournitures, uniformes et frais de scolarité sont pris en charge.',
    },
  });
  expect(creation.status(), `publication : ${await creation.text()}`).toBe(201);
  const corps = await creation.json();
  return { id: corps.id ?? corps.item?.id, titre: titreUnique };
}

/**
 * Un benevole actif de la plateforme, cree par l'administration : le
 * site le presente d'emblee par son prenom. Rend { prenom }.
 */
export async function benevoleVisiblePret(request, testInfo, { prenom = 'Noro' } = {}) {
  const connexionAdmin = await request.post('/api/admin/login', { data: ADMIN });
  expect(connexionAdmin.status(), 'connexion administrateur').toBe(200);
  const prenomUnique = `${prenom}${Date.now().toString(36).slice(-4)}`;
  const email = adresseUnique(testInfo, 'benevole-site');
  const compte = await request.post('/api/admin/utilisateurs/comptes', {
    headers: { Authorization: `Bearer ${(await connexionAdmin.json()).token}` },
    data: { type: 'BENEVOLE', prenom: prenomUnique, nom: 'Rakoto', email },
  });
  expect(compte.status(), `compte benevole : ${await compte.text()}`).toBe(201);
  return { prenom: prenomUnique };
}
