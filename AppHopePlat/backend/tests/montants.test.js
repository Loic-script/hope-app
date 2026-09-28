/*
 * Les montants : tout passe en centimes entiers, jamais en flottant.
 * Lance par `npm test` (node --test).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  centimesVersTexte,
  depuisBase,
  enCentimes,
  normaliserDevise,
  pourcentage,
  sommeDepuisBase,
} from '../src/shared/money.js';
import { ErreurValidation } from '../src/shared/errors.js';

test('enCentimes lit les saisies usuelles', () => {
  assert.equal(enCentimes('1500'), 150000);
  assert.equal(enCentimes('1500.5'), 150050);
  assert.equal(enCentimes('1 500,50'), 150050);
  assert.equal(enCentimes(25), 2500);
});

test('enCentimes refuse ce qui n est pas un montant', () => {
  for (const valeur of ['', null, undefined, 'abc', '12.345', '1e5', '0']) {
    assert.throws(() => enCentimes(valeur), ErreurValidation, String(valeur));
  }
  assert.throws(() => enCentimes('-10'), ErreurValidation);
});

test('enCentimes borne le maximum de NUMERIC(14,2)', () => {
  assert.equal(enCentimes('99999999999.99'), 99_999_999_999_99);
  assert.throws(() => enCentimes('100000000000'), ErreurValidation);
});

test('la precision tient la ou un flottant se tromperait', () => {
  // 0.1 + 0.2 en flottant vaut 0.30000000000000004.
  assert.equal(sommeDepuisBase(['0.10', '0.20']), 30);
  assert.equal(centimesVersTexte(sommeDepuisBase(['0.10', '0.20'])), '0.30');
});

test('depuisBase accepte les valeurs negatives et nulles venues de PostgreSQL', () => {
  assert.equal(depuisBase(null), 0);
  assert.equal(depuisBase('-125.40'), -12540);
});

test('centimesVersTexte produit une chaine prete pour NUMERIC', () => {
  assert.equal(centimesVersTexte(150050), '1500.50');
  assert.equal(centimesVersTexte(5), '0.05');
  assert.equal(centimesVersTexte(-12540), '-125.40');
});

test('pourcentage : arrondi a une decimale, sans division par zero', () => {
  assert.equal(pourcentage(1, 3), 33.3);
  assert.equal(pourcentage(50, 0), 0);
});

test('normaliserDevise : MGA par defaut, liste fermee', () => {
  assert.equal(normaliserDevise(''), 'MGA');
  assert.equal(normaliserDevise(' eur '), 'EUR');
  assert.throws(() => normaliserDevise('BTC'), ErreurValidation);
});
