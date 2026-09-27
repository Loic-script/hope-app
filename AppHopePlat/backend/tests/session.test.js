/*
 * Les sessions en cookie httpOnly : lecture du jeton, fermeture des
 * sessions apres un changement de mot de passe, refus des requetes
 * venues d'un autre site.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  COOKIES,
  lireCookies,
  lireJeton,
  lireJetonEspace,
  poserSession,
  verifierFraicheur,
  verifierOrigine,
} from '../src/shared/session.js';
import { ErreurAuthentification } from '../src/shared/errors.js';

const requete = (entetes = {}, methode = 'GET') => ({ headers: entetes, method: methode });

test('lireCookies decoupe et decode l en-tete Cookie', () => {
  assert.deepEqual(lireCookies(requete({ cookie: 'a=1; hope_admin=x%20y; vide=' })), {
    a: '1',
    hope_admin: 'x y',
    vide: '',
  });
  assert.deepEqual(lireCookies(requete()), {});
});

test('lireJeton : l en-tete Authorization passe avant le cookie, et chaque espace lit le sien', () => {
  const cookies = `${COOKIES.admin}=jeton-admin; ${COOKIES.benevole}=jeton-benevole`;
  assert.equal(lireJeton(requete({ cookie: cookies }), 'admin'), 'jeton-admin');
  assert.equal(lireJeton(requete({ cookie: cookies }), 'benevole'), 'jeton-benevole');
  assert.equal(lireJeton(requete({ cookie: cookies }), 'bailleur'), null);
  assert.equal(lireJeton(requete({ cookie: cookies, authorization: 'Bearer entete' }), 'admin'), 'entete');
});

test('lireJetonEspace suit l indication X-Hope-Espace, sans jamais lire le cookie admin', () => {
  const cookies = `${COOKIES.donateur}=d; ${COOKIES.bailleur}=b; ${COOKIES.admin}=a`;
  assert.equal(lireJetonEspace(requete({ cookie: cookies, 'x-hope-espace': 'bailleur' })), 'b');
  assert.equal(lireJetonEspace(requete({ cookie: cookies })), 'd');
  assert.equal(lireJetonEspace(requete({ cookie: `${COOKIES.admin}=a` })), null);
});

test('poserSession : httpOnly, SameSite strict, limite a /api, duree du jeton', () => {
  let pose;
  const res = { cookie: (nom, valeur, options) => (pose = { nom, valeur, options }) };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jeton = `e30.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.sig`;
  poserSession(res, 'donateur', jeton);
  assert.equal(pose.nom, COOKIES.donateur);
  assert.equal(pose.options.httpOnly, true);
  assert.equal(pose.options.sameSite, 'strict');
  assert.equal(pose.options.path, '/api');
  assert.ok(pose.options.maxAge > 3500_000 && pose.options.maxAge <= 3600_000);
  poserSession(res, 'donateur', jeton, { persistant: false });
  assert.equal(pose.options.maxAge, undefined);
});

test('verifierFraicheur : un jeton emis avant la fermeture des sessions est refuse', () => {
  const fermeture = new Date(Math.floor(Date.now() / 1000) * 1000);
  const iat = fermeture.getTime() / 1000;
  assert.doesNotThrow(() => verifierFraicheur({ iat }, fermeture));
  assert.doesNotThrow(() => verifierFraicheur({ iat: iat - 100 }, null));
  assert.throws(() => verifierFraicheur({ iat: iat - 1 }, fermeture), ErreurAuthentification);
});

test('verifierOrigine : une modification venue d un autre site est refusee', () => {
  const resultat = (entetes, methode) => {
    let erreur = 'non appele';
    verifierOrigine(requete({ host: 'hope.example', ...entetes }, methode), {}, (e) => (erreur = e ?? null));
    return erreur;
  };
  assert.equal(resultat({ origin: 'https://hope.example' }, 'POST'), null);
  assert.equal(resultat({}, 'POST'), null);
  assert.equal(resultat({ origin: 'https://ailleurs.example' }, 'GET'), null);
  const refus = resultat({ origin: 'https://ailleurs.example' }, 'POST');
  assert.ok(refus instanceof ErreurAuthentification);
  assert.equal(refus.statut, 403);
});
