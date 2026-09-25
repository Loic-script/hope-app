/*
 * Les validations partagees par les services, et celles du mot de passe
 * oublie qui tombent avant toute requete en base.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  dateFacultative,
  identifiantRequis,
  texteFacultatif,
  texteRequis,
  valeurParmi,
} from '../src/shared/validation.js';
import { ErreurValidation } from '../src/shared/errors.js';
import * as motDePasse from '../src/services/motDePasse.service.js';

test('texteRequis nettoie et borne', () => {
  assert.equal(texteRequis('  Antsirabe  ', 'ville'), 'Antsirabe');
  assert.throws(() => texteRequis('   ', 'ville'), ErreurValidation);
  assert.throws(() => texteRequis('x'.repeat(256), 'ville'), ErreurValidation);
});

test('texteFacultatif rend null pour un champ vide', () => {
  assert.equal(texteFacultatif('', 'note'), null);
  assert.equal(texteFacultatif(null, 'note'), null);
});

test('valeurParmi n accepte que la liste donnee', () => {
  assert.equal(valeurParmi(' mvola ', 'mode', ['MVOLA', 'ESPECES']), 'MVOLA');
  assert.throws(() => valeurParmi('bitcoin', 'mode', ['MVOLA', 'ESPECES']), ErreurValidation);
});

test('identifiantRequis refuse ce qui n est pas un entier positif', () => {
  assert.equal(identifiantRequis('12', 'id'), 12);
  for (const valeur of ['0', '-3', 'abc', '1.5', '12abc', '1 OR 1=1', '']) {
    assert.throws(() => identifiantRequis(valeur, 'id'), ErreurValidation, valeur);
  }
});

test('dateFacultative attend AAAA-MM-JJ', () => {
  assert.equal(dateFacultative('', 'jour'), null);
  assert.throws(() => dateFacultative('12/03/2026', 'jour'), ErreurValidation);
});

test('mot de passe oublie : une adresse invalide est refusee', async () => {
  await assert.rejects(motDePasse.demander({ email: 'pas-une-adresse' }), ErreurValidation);
});

test('mot de passe oublie : moins de 8 caracteres, ou un jeton mal forme, sont refuses', async () => {
  await assert.rejects(motDePasse.reinitialiser({ jeton: 'a'.repeat(64), motDePasse: 'court' }), ErreurValidation);
  await assert.rejects(motDePasse.reinitialiser({ jeton: 'zzz', motDePasse: 'assez-long-2026' }), ErreurValidation);
});
