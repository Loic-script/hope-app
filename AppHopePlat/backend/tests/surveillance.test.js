/*
 * La surveillance : le journal des requetes n'ecrit jamais la partie
 * requete d'une adresse (un lien de reinitialisation y porte son jeton).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { journalDesRequetes } from '../src/services/surveillance.service.js';

test('journal des requetes : une ligne JSON, sans la requete de l adresse', () => {
  const lignes = [];
  const log = console.log;
  console.log = (texte) => lignes.push(texte);
  try {
    const res = Object.assign(new EventEmitter(), { statusCode: 404 });
    let suivant = false;
    journalDesRequetes({ method: 'GET', originalUrl: '/api/x?jeton=secret-123' }, res, () => (suivant = true));
    res.emit('finish');
    assert.ok(suivant);
  } finally {
    console.log = log;
  }
  const ligne = JSON.parse(lignes[0]);
  assert.equal(ligne.chemin, '/api/x');
  assert.equal(ligne.statut, 404);
  assert.equal(ligne.niveau, 'attention');
  assert.ok(!lignes[0].includes('secret-123'));
});
