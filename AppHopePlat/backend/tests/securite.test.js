/*
 * La securite vue de l'exterieur, par de vraies requetes HTTP sur
 * l'application (sans base de donnees : rien ici ne va jusqu'a elle).
 *
 *   - les en-tetes de securite sont poses sur chaque reponse ;
 *   - TOUTES les routes /api/admin/* exigent la session AdminHope : la
 *     liste est lue dans le routeur lui-meme, une route ajoutee demain est
 *     donc verifiee sans toucher a ce fichier ;
 *   - un jeton forge ou d'un autre espace ne passe pas.
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { creerApplication } from '../src/app.js';
import { config } from '../src/config/env.js';
import { fermerPool } from '../src/config/database.js';
import adminRoutes from '../src/routes/admin.routes.js';

let serveur;
let base;

before(async () => {
  serveur = creerApplication().listen(0);
  await new Promise((resolve) => serveur.once('listening', resolve));
  base = `http://127.0.0.1:${serveur.address().port}/api`;
});

after(async () => {
  await new Promise((resolve) => serveur.close(resolve));
  await fermerPool();
});

/** Les routes declarees dans le routeur admin : [methode, chemin]. */
function routesAdmin() {
  const routes = [];
  for (const couche of adminRoutes.stack) {
    if (!couche.route) continue;
    const chemins = Array.isArray(couche.route.path) ? couche.route.path : [couche.route.path];
    for (const chemin of chemins) {
      for (const methode of Object.keys(couche.route.methods)) {
        // Les parametres (:id...) recoivent une valeur quelconque.
        routes.push([methode.toUpperCase(), `/admin${chemin.replace(/:[A-Za-z_]+/g, '1')}`]);
      }
    }
  }
  return routes;
}

test('les en-tetes de securite sont poses', async () => {
  const reponse = await fetch(`${base}/route-inconnue`);
  assert.equal(reponse.status, 404);
  assert.equal(reponse.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(reponse.headers.get('x-frame-options'), 'DENY');
  assert.match(reponse.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
  assert.ok(reponse.headers.get('referrer-policy'));
  assert.equal(reponse.headers.get('x-powered-by'), null);
});

test('toutes les routes /api/admin/* refusent une requete sans session', async () => {
  const routes = routesAdmin();
  assert.ok(routes.length > 50, `routes lues : ${routes.length}`);
  const ouvertes = [];
  for (const [methode, chemin] of routes) {
    const reponse = await fetch(base + chemin, {
      method: methode,
      headers: { 'Content-Type': 'application/json' },
      body: ['GET', 'HEAD'].includes(methode) ? undefined : '{}',
    });
    if (reponse.status !== 401) ouvertes.push(`${methode} ${chemin} -> ${reponse.status}`);
  }
  assert.deepEqual(ouvertes, []);
});

test('un jeton signe d une autre cle, ou d un autre espace, est refuse', async () => {
  const forge = jwt.sign({ sub: 1 }, 'une-autre-cle-que-celle-du-serveur-hope', { expiresIn: '1h' });
  const donateur = jwt.sign({ sub: 1 }, config.jwt?.secret ?? 'x', {
    expiresIn: '1h',
    audience: 'hope-donateur',
    issuer: 'hope-api',
  });
  for (const jeton of [forge, donateur, 'nimporte-quoi']) {
    const reponse = await fetch(`${base}/admin/dashboard`, { headers: { Authorization: `Bearer ${jeton}` } });
    assert.equal(reponse.status, 401, jeton.slice(0, 20));
  }
});

test('le contact public repond sans session, sans rien d autre que l adresse', async () => {
  const reponse = await fetch(`${base}/public/contact`);
  assert.equal(reponse.status, 200);
  assert.deepEqual(Object.keys(await reponse.json()), ['email']);
});
