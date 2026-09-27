/*
 * Le gestionnaire d'erreurs : chaque erreur devient le bon code HTTP,
 * au meme format, sans jamais laisser fuir un detail interne.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gestionnaireErreurs, routeIntrouvable } from '../src/middleware/error.middleware.js';
import {
  ErreurAuthentification,
  ErreurIntrouvable,
  ErreurRegleMetier,
  ErreurValidation,
} from '../src/shared/errors.js';

/** Fait passer une erreur dans le gestionnaire ; rend { statut, corps }. */
function traduire(erreur) {
  const rendu = {};
  const res = {
    status(code) {
      rendu.statut = code;
      return this;
    },
    json(corps) {
      rendu.corps = corps;
      return this;
    },
  };
  const erreurConsole = console.error;
  console.error = () => {};
  try {
    gestionnaireErreurs(erreur, { method: 'GET', originalUrl: '/api/essai?jeton=abc' }, res, () => {});
  } finally {
    console.error = erreurConsole;
  }
  return rendu;
}

test('400 : formulaire invalide, avec le detail des champs', () => {
  const { statut, corps } = traduire(new ErreurValidation('Le formulaire comporte des erreurs.', { email: 'Champ obligatoire' }));
  assert.equal(statut, 400);
  assert.deepEqual(corps, { success: false, code: 'VALIDATION', message: 'Le formulaire comporte des erreurs.', details: { email: 'Champ obligatoire' } });
});

test('400 : corps JSON illisible', () => {
  assert.equal(traduire(Object.assign(new SyntaxError('x'), { type: 'entity.parse.failed' })).corps.code, 'JSON_INVALIDE');
});

test('401 : session absente ou invalide', () => {
  assert.equal(traduire(new ErreurAuthentification()).statut, 401);
});

test('403 : droit insuffisant', () => {
  const erreur = new ErreurRegleMetier('Votre rôle ne permet pas cette action.', 'DROIT_INSUFFISANT');
  erreur.statut = 403;
  const { statut, corps } = traduire(erreur);
  assert.equal(statut, 403);
  assert.equal(corps.code, 'DROIT_INSUFFISANT');
});

test('404 : ressource ou route introuvable', () => {
  assert.equal(traduire(new ErreurIntrouvable('Le projet', 3)).statut, 404);
  const rendu = {};
  routeIntrouvable({ method: 'GET', originalUrl: '/api/rien' }, { status: (c) => ((rendu.statut = c), { json: (b) => (rendu.corps = b) }) });
  assert.equal(rendu.statut, 404);
  assert.equal(rendu.corps.code, 'ROUTE_INTROUVABLE');
});

test('409 : valeur deja enregistree (index unique PostgreSQL), sans nommer la contrainte', () => {
  const { statut, corps } = traduire(Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'utilisateur_email_key' }));
  assert.equal(statut, 409);
  assert.equal(corps.code, 'DEJA_ENREGISTRE');
  assert.ok(!JSON.stringify(corps).includes('utilisateur_email_key'));
});

test('413 et autres 4xx deja qualifies : rendus tels quels, sans detail', () => {
  const { statut, corps } = traduire(Object.assign(new Error('request entity too large'), { status: 413 }));
  assert.equal(statut, 413);
  assert.equal(corps.code, 'REQUETE_INVALIDE');
});

test('422 : regle metier, avec son code', () => {
  const { statut, corps } = traduire(new ErreurRegleMetier('Fonds HOPE insuffisant.', 'FONDS_INSUFFISANT'));
  assert.equal(statut, 422);
  assert.equal(corps.code, 'FONDS_INSUFFISANT');
});

test('500 : toute autre erreur, message generique', () => {
  const { statut, corps } = traduire(new Error('connexion perdue a 10.0.0.3'));
  assert.equal(statut, 500);
  assert.equal(corps.code, 'ERREUR_SERVEUR');
  assert.equal(corps.message, 'Une erreur interne est survenue.');
});
