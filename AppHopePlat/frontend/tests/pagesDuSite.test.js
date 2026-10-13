import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { PAGES_DE_PAIEMENT } from '../src/utils/pagesPaiement.js';
import { PAGES_PUBLIQUES, decrirePage, estEspaceFerme } from '../src/utils/pagesDuSite.js';

const ROUTES = fs.readFileSync(new URL('../src/routes/index.jsx', import.meta.url), 'utf8');

function cheminsDuRouteur() {
  const directs = [...ROUTES.matchAll(/\bpath="(\/[^"]*)"/g)].map((m) => m[1]);
  const paiements = [...ROUTES.matchAll(/routesPaiement\('([^']+)'/g)].flatMap((m) =>
    Object.values(PAGES_DE_PAIEMENT).map((page) => `${m[1]}/${page}`)
  );
  return [...directs, ...paiements].map((chemin) => chemin.replace(/:[A-Za-z]+/g, '1'));
}

test('chaque route du site est connue du serveur : aucune ne repondrait 404', () => {
  const chemins = cheminsDuRouteur();
  assert.ok(chemins.length > 100, `routes lues : ${chemins.length}`);
  const inconnues = chemins.filter((chemin) => decrirePage(chemin).genre === 'inconnue');
  assert.deepEqual(inconnues, []);
});

test('chaque page publique a sa route, et son titre pour l onglet du navigateur', () => {
  const chemins = new Set(cheminsDuRouteur());
  for (const page of PAGES_PUBLIQUES) {
    assert.ok(chemins.has(page.chemin), `route absente : ${page.chemin}`);
    assert.equal(decrirePage(page.chemin).titre, page.titre);
  }
  assert.ok(decrirePage('/admin/budget').titre);
  assert.ok(decrirePage('/une-adresse-inconnue').titre);
});

test('une adresse inconnue reste dans son espace : le site public affiche sa page introuvable', () => {
  assert.equal(estEspaceFerme('/admin/ecran-inconnu'), true);
  assert.equal(estEspaceFerme('/benevole'), true);
  assert.equal(estEspaceFerme('/une-adresse-inconnue'), false);
  assert.equal(estEspaceFerme('/nos-projets/12/photos'), false);
});
