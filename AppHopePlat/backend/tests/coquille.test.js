import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { creerApplication } from '../src/app.js';
import { fermerPool } from '../src/config/database.js';
import { servirCoquille, versHoteDeReference } from '../src/middleware/referencement.middleware.js';

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend');
const GABARIT = fs.readFileSync(path.join(FRONTEND, 'index.html'), 'utf8');
const SITE = 'https://hope.example';

let dossier;
const serveurs = [];

async function ouvrir(app) {
  const serveur = app.listen(0);
  await new Promise((resolve) => serveur.once('listening', resolve));
  serveurs.push(serveur);
  return serveur.address().port;
}

function demander(port, chemin, { methode = 'GET', entetes = {} } = {}) {
  return new Promise((resolve, reject) => {
    const requete = http.request({ host: '127.0.0.1', port, path: chemin, method: methode, headers: entetes }, (reponse) => {
      let corps = '';
      reponse.setEncoding('utf8');
      reponse.on('data', (morceau) => {
        corps += morceau;
      });
      reponse.on('end', () => resolve({ statut: reponse.statusCode, entetes: reponse.headers, corps }));
    });
    requete.on('error', reject);
    requete.end();
  });
}

let port;

before(async () => {
  dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'hope-coquille-'));
  fs.writeFileSync(path.join(dossier, 'index.html'), GABARIT);
  fs.copyFileSync(path.join(FRONTEND, 'public', 'logo.png'), path.join(dossier, 'logo.png'));
  port = await ouvrir(creerApplication({ siteUrl: SITE, dossierFrontend: dossier }));
});

after(async () => {
  await Promise.all(serveurs.map((serveur) => new Promise((resolve) => serveur.close(resolve))));
  await fermerPool();
  fs.rmSync(dossier, { recursive: true, force: true });
});

test('chaque page publique est servie avec son titre et son adresse canonique', async () => {
  const accueil = await demander(port, '/');
  const projets = await demander(port, '/nos-projets?page=2');
  for (const reponse of [accueil, projets]) {
    assert.equal(reponse.statut, 200);
    assert.match(reponse.entetes['content-type'], /^text\/html/);
    assert.equal(reponse.entetes['cache-control'], 'no-cache');
    assert.match(reponse.corps, /<div id="root"><\/div>/);
  }
  assert.match(accueil.corps, /<title>HOPE – Hope for a Better Life, association à Madagascar<\/title>/);
  assert.match(accueil.corps, new RegExp(`<link rel="canonical" href="${SITE}/" />`));
  assert.match(projets.corps, /<title>Nos projets à Madagascar — HOPE<\/title>/);
  assert.match(projets.corps, new RegExp(`<link rel="canonical" href="${SITE}/nos-projets" />`));
  assert.match(projets.corps, new RegExp(`<meta property="og:image" content="${SITE}/partage.png" />`));
});

test('une adresse inconnue, un fichier absent, une fiche impossible : 404, avec la coquille', async () => {
  for (const chemin of [
    '/nulle-part',
    '/favicon.ico',
    '/sitemap_index.xml',
    '/wp-login.php',
    '/nos-projets/abc',
    '/nos-projets/12/photos',
    '/actualites/pas-un-identifiant',
  ]) {
    const reponse = await demander(port, chemin);
    assert.equal(reponse.statut, 404, chemin);
    assert.match(reponse.corps, /<title>Page introuvable — HOPE<\/title>/, chemin);
    assert.match(reponse.corps, /<meta name="robots" content="noindex" \/>/, chemin);
    assert.doesNotMatch(reponse.corps, /rel="canonical"/, chemin);
    assert.match(reponse.corps, /<div id="root"><\/div>/, chemin);
  }
  assert.equal((await demander(port, '/nulle-part', { methode: 'HEAD' })).statut, 404);
});

test('un fichier present est servi, et index.html ne double pas l accueil', async () => {
  const logo = await demander(port, '/logo.png');
  assert.equal(logo.statut, 200);
  assert.equal(logo.entetes['content-type'], 'image/png');

  const index = await demander(port, '/index.html');
  assert.equal(index.statut, 301);
  assert.equal(index.entetes.location, '/');
});

test('l API et les clients qui ne lisent pas le HTML gardent leur 404 en JSON', async () => {
  const api = await demander(port, '/api/nulle-part');
  assert.equal(api.statut, 404);
  assert.equal(JSON.parse(api.corps).code, 'ROUTE_INTROUVABLE');

  const json = await demander(port, '/nulle-part', { entetes: { Accept: 'application/json' } });
  assert.equal(json.statut, 404);
  assert.equal(JSON.parse(json.corps).code, 'ROUTE_INTROUVABLE');
});

test('un espace ferme et une page de passage : 200, hors des moteurs de recherche', async () => {
  const attendus = {
    '/admin/projects': 'Administration — HOPE',
    '/donateur': 'Espace donateur — HOPE',
    '/authentification?type=bailleur': 'Connexion — HOPE',
    '/faire-un-don/carte': 'Paiement de votre don — HOPE',
    '/reinitialiser-mot-de-passe?jeton=abc': 'Nouveau mot de passe — HOPE',
    '/verifier-courriel?jeton=abc': 'Confirmation de votre adresse — HOPE',
  };
  for (const [chemin, titre] of Object.entries(attendus)) {
    const reponse = await demander(port, chemin);
    assert.equal(reponse.statut, 200, chemin);
    assert.match(reponse.corps, new RegExp(`<title>${titre}</title>`), chemin);
    assert.match(reponse.corps, /<meta name="robots" content="noindex" \/>/, chemin);
    assert.doesNotMatch(reponse.corps, /rel="canonical"/, chemin);
  }
  const don = await demander(port, '/faire-un-don');
  assert.match(don.corps, new RegExp(`<link rel="canonical" href="${SITE}/faire-un-don" />`));
});

test('une ancienne adresse est redirigee pour de bon vers la nouvelle', async () => {
  const liste = await demander(port, '/nos-realisations');
  assert.deepEqual([liste.statut, liste.entetes.location], [301, '/nos-projets']);
  const fiche = await demander(port, '/nos-realisations/7');
  assert.deepEqual([fiche.statut, fiche.entetes.location], [301, '/nos-projets/7']);
});

test('www est redirige vers l hote de reference, pour GET et HEAD seulement', async () => {
  for (const entetes of [{ 'X-Forwarded-Host': 'www.hope.example' }, { Host: 'www.hope.example' }]) {
    for (const methode of ['GET', 'HEAD']) {
      const reponse = await demander(port, '/nos-projets?page=2', { methode, entetes });
      assert.equal(reponse.statut, 301, `${methode} ${JSON.stringify(entetes)}`);
      assert.equal(reponse.entetes.location, `${SITE}/nos-projets?page=2`);
    }
  }
  const api = await demander(port, '/api/public/contact', { entetes: { 'X-Forwarded-Host': 'www.hope.example' } });
  assert.deepEqual([api.statut, api.entetes.location], [301, `${SITE}/api/public/contact`]);

  const ecriture = await demander(port, '/api/nulle-part', {
    methode: 'POST',
    entetes: { 'X-Forwarded-Host': 'www.hope.example' },
  });
  assert.equal(ecriture.statut, 404);

  const sante = await demander(port, '/api/sante', { entetes: { 'X-Forwarded-Host': 'www.hope.example' } });
  assert.notEqual(sante.statut, 301);
});

test('l hote de reference, l adresse technique et le poste local ne sont pas rediriges', async () => {
  for (const hote of ['hope.example', 'hope-app.203.0.113.7.sslip.io', 'localhost:3000', 'www.autre-site.example']) {
    const reponse = await demander(port, '/nos-projets', { entetes: { 'X-Forwarded-Host': hote, 'X-Forwarded-Proto': 'https' } });
    assert.equal(reponse.statut, 200, hote);
    assert.match(reponse.corps, new RegExp(`<link rel="canonical" href="${SITE}/nos-projets" />`), hote);
  }
});

test('la redirection suit l adresse configuree, www compris, et s efface si elle est illisible', () => {
  const essayer = (siteUrl, hostname, method = 'GET') => {
    let resultat = 'suite';
    versHoteDeReference(siteUrl)(
      { method, hostname, originalUrl: '/contact' },
      { redirect: (statut, adresse) => (resultat = `${statut} ${adresse}`) },
      () => {}
    );
    return resultat;
  };
  assert.equal(essayer('https://hope.example', 'www.hope.example'), '301 https://hope.example/contact');
  assert.equal(essayer('https://www.hope.example/', 'hope.example'), '301 https://www.hope.example/contact');
  assert.equal(essayer('https://www.hope.example/', 'www.hope.example'), 'suite');
  assert.equal(essayer('http://localhost:5173', 'localhost'), 'suite');
  assert.equal(essayer('http://localhost:5173', '127.0.0.1'), 'suite');
  assert.equal(essayer('https://hope.example', 'www.hope.example', 'POST'), 'suite');
  assert.equal(essayer('pas une adresse', 'www.hope.example'), 'suite');
});

test('robots.txt et le plan du site annoncent l adresse configuree', async () => {
  const robots = await demander(port, '/robots.txt');
  assert.match(robots.corps, new RegExp(`^Sitemap: ${SITE}/sitemap.xml$`, 'm'));
  const plan = await demander(port, '/sitemap.xml');
  assert.match(plan.corps, new RegExp(`<loc>${SITE}/nos-projets</loc>`));
  assert.doesNotMatch(plan.corps, /localhost/);
});

test('une fiche trouvee porte son titre ; la base en panne, la coquille part quand meme, en 503', async () => {
  const fiches = {
    projet: async (id) => {
      if (id === '7') return { titre: 'Cantine de Betafo — HOPE', description: 'Un repas chaque midi.' };
      throw new Error('connexion refusee');
    },
  };
  const app = express();
  app.get(/.*/, servirCoquille({ gabarit: GABARIT, siteUrl: SITE, fiches }));
  const autrePort = await ouvrir(app);

  const trouvee = await demander(autrePort, '/nos-projets/7');
  assert.equal(trouvee.statut, 200);
  assert.match(trouvee.corps, /<title>Cantine de Betafo — HOPE<\/title>/);
  assert.match(trouvee.corps, /<meta name="description" content="Un repas chaque midi." \/>/);
  assert.match(trouvee.corps, new RegExp(`<link rel="canonical" href="${SITE}/nos-projets/7" />`));

  const erreurs = [];
  const journal = console.error;
  console.error = (...morceaux) => erreurs.push(morceaux.join(' '));
  let panne;
  try {
    panne = await demander(autrePort, '/nos-projets/8');
  } finally {
    console.error = journal;
  }
  assert.equal(panne.statut, 503);
  assert.match(panne.corps, /<div id="root"><\/div>/);
  assert.match(panne.corps, /<meta name="robots" content="noindex" \/>/);
  assert.match(erreurs.join('\n'), /Fiche indisponible pour \/nos-projets\/8/);
});
