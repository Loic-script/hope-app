/*
 * Les utilitaires du frontend : les montants affiches, le montant en
 * lettres des pages de paiement, l'adresse de chaque page de paiement.
 * Lance par `npm test` (node --test), sans navigateur.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { enLettres } from '../src/utils/enLettres.js';
import * as fmt from '../src/utils/format.js';
import { PAGES_DE_PAIEMENT, pageDePaiement } from '../src/utils/pagesPaiement.js';

/** Les espaces insecables deviennent des espaces simples, pour comparer. */
const simple = (texte) => texte.replace(/\s/g, ' ');

test('enLettres suit les regles du francais', () => {
  const attendus = {
    0: 'zéro',
    21: 'vingt-et-un',
    71: 'soixante-et-onze',
    80: 'quatre-vingts',
    81: 'quatre-vingt-un',
    200: 'deux-cents',
    201: 'deux-cent-un',
    1000: 'mille',
    80000: 'quatre-vingt-mille',
    2500000: 'deux-millions-cinq-cent-mille',
    1000000000: 'un-milliard',
  };
  for (const [nombre, texte] of Object.entries(attendus)) {
    assert.equal(enLettres(Number(nombre)), texte, nombre);
  }
});

test('montant : separateurs francais et devise', () => {
  assert.equal(simple(fmt.montant('5000000.00')), '5 000 000 Ar');
  assert.equal(simple(fmt.montant(12.5, 'EUR')), '12,50 €');
  assert.equal(fmt.montant(null), '—');
  assert.equal(fmt.montant('pas un nombre'), '—');
});

test('montant : pas d espace fine, qui se coupe mal en fin de ligne', () => {
  assert.ok(!fmt.montant('1234567').includes(' '));
});

test('nombre, pourcent, initiales, tronquer', () => {
  assert.equal(simple(fmt.nombre(1234)), '1 234');
  assert.equal(simple(fmt.pourcent(42.5)), '42,5 %');
  assert.equal(fmt.initiales('Jean Rakoto'), 'JR');
  const court = fmt.tronquer('a'.repeat(100), 10);
  assert.ok(court.length <= 10 && court.endsWith('…'));
});

test('chaque moyen de paiement a sa page, dans chaque espace', () => {
  for (const base of ['/donateur/completer-profil', '/donateur/payer', '/bailleur/payer', '/benevole/payer']) {
    for (const [mode, chemin] of Object.entries(PAGES_DE_PAIEMENT)) {
      assert.equal(pageDePaiement(base, mode), `${base}/${chemin}`);
    }
  }
  assert.equal(pageDePaiement('/donateur/payer', 'inconnu'), null);
});
