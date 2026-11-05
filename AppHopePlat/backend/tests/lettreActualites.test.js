import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

import { ADMIN_TEST, preparerBaseDeTest } from './aide/baseDeTest.js';

const COURRIEL = /^\[HOPE\] Courriel \(domaine reserve, non envoye\) a (\S+) — ([^\n]*)\n([\s\S]*)$/;
const MOT_DE_PASSE = 'actualites-2026';

let base;
let serveur;
let api;
let fermerPool;
let jetonAdmin;
const journal = console.log;
const courriels = [];

async function appel(methode, chemin, { corps, jeton, entetes = {} } = {}) {
  const reponse = await fetch(api + chemin, {
    method: methode,
    headers: {
      'Content-Type': 'application/json',
      ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
      ...entetes,
    },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  const texte = await reponse.text();
  return { statut: reponse.status, corps: texte ? JSON.parse(texte) : null };
}

function recus(a, motif) {
  return courriels.filter((courriel) => courriel.a === a && motif.test(courriel.sujet));
}

async function attendre(a, motif) {
  const limite = Date.now() + 3000;
  while (Date.now() < limite) {
    const trouve = recus(a, motif).at(-1);
    if (trouve) return trouve;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`aucun courriel « ${motif} » pour ${a} ; recus : ${JSON.stringify(courriels.map((c) => [c.a, c.sujet]))}`);
}

async function donateur(email, accepteActualites) {
  const inscription = await appel('POST', '/auth/inscription', {
    corps: {
      email,
      typeUtilisateur: 'donateur',
      motDePasse: MOT_DE_PASSE,
      confirmation: MOT_DE_PASSE,
      accepteConditions: true,
      accepteActualites,
    },
  });
  assert.equal(inscription.statut, 201, JSON.stringify(inscription.corps));
  const lien = await attendre(email, /confirmez votre adresse/);
  await appel('POST', '/auth/verifier-courriel', { corps: { jeton: /[a-f0-9]{64}/.exec(lien.texte)[0] } });
  const connexion = await appel('POST', '/auth/login', {
    corps: { email, motDePasse: MOT_DE_PASSE, typeUtilisateur: 'donateur' },
  });
  assert.equal(connexion.statut, 200, JSON.stringify(connexion.corps));
  return connexion.corps.token;
}

async function abonne(email) {
  const [ligne] = await base.sql('SELECT actualites_acceptees_le FROM utilisateur WHERE email = $1', [email]);
  return Boolean(ligne.actualites_acceptees_le);
}

before(async () => {
  base = await preparerBaseDeTest({ prefixe: 'hope_test_lettre' });
  console.log = (...morceaux) => {
    const trouve = COURRIEL.exec(morceaux.join(' '));
    if (trouve) courriels.push({ a: trouve[1], sujet: trouve[2], texte: trouve[3] });
    else journal(...morceaux);
  };
  const { creerApplication } = await import('../src/app.js');
  ({ fermerPool } = await import('../src/config/database.js'));
  serveur = creerApplication().listen(0);
  await new Promise((resolve) => serveur.once('listening', resolve));
  api = `http://127.0.0.1:${serveur.address().port}/api`;
  jetonAdmin = (await appel('POST', '/admin/login', { corps: ADMIN_TEST })).corps.token;
});

after(async () => {
  console.log = journal;
  await new Promise((resolve) => serveur?.close(resolve));
  await fermerPool?.();
  await base?.detruire();
});

test('la case de l inscription, puis l interrupteur de l espace, decident de l abonnement', async () => {
  const jeton = await donateur('soa.abonnee@hope.test', true);
  await donateur('naina.sans@hope.test', false);
  assert.equal(await abonne('soa.abonnee@hope.test'), true);
  assert.equal(await abonne('naina.sans@hope.test'), false);

  const espace = { jeton, entetes: { 'X-Hope-Espace': 'donateur' } };
  assert.deepEqual((await appel('GET', '/espace/compte/actualites', espace)).corps, { actualites: true });
  const arret = await appel('PUT', '/espace/compte/actualites', { ...espace, corps: { actualites: false } });
  assert.equal(arret.statut, 200, JSON.stringify(arret.corps));
  assert.equal(await abonne('soa.abonnee@hope.test'), false);
  assert.equal((await appel('PUT', '/espace/compte/actualites', { ...espace, corps: { actualites: 'oui' } })).statut, 400);
  await appel('PUT', '/espace/compte/actualites', { ...espace, corps: { actualites: true } });
  assert.equal(await abonne('soa.abonnee@hope.test'), true);
});

test('une actualite publiee part aux seuls abonnes, avec un lien de desinscription qui marche', async () => {
  const publication = await appel('POST', '/admin/publications', {
    jeton: jetonAdmin,
    corps: { type: 'actualite', titre: 'La cantine de Betafo ouvre', corps: 'Depuis lundi, 120 enfants mangent chaque midi.' },
  });
  assert.equal(publication.statut, 201, JSON.stringify(publication.corps));

  const lettre = await attendre('soa.abonnee@hope.test', /^HOPE — La cantine de Betafo ouvre$/);
  assert.match(lettre.texte, /Depuis lundi, 120 enfants mangent chaque midi\./);
  assert.match(lettre.texte, new RegExp(`/actualites/${publication.corps.id}$`, 'm'));
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(recus('naina.sans@hope.test', /La cantine/).length, 0);

  const jeton = decodeURIComponent(/se-desinscrire\?jeton=(\S+)/.exec(lettre.texte)[1]);
  const falsifie = `${jeton.slice(0, -2)}xx`;
  assert.equal((await appel('POST', '/public/actualites/desinscription', { corps: { jeton: falsifie } })).statut, 400);
  assert.equal(await abonne('soa.abonnee@hope.test'), true);

  const unClic = await appel('POST', `/public/actualites/desinscription?jeton=${encodeURIComponent(jeton)}`);
  assert.equal(unClic.statut, 200, JSON.stringify(unClic.corps));
  assert.equal(await abonne('soa.abonnee@hope.test'), false);

  await appel('POST', '/admin/publications', {
    jeton: jetonAdmin,
    corps: { type: 'actualite', titre: 'Deuxieme actualite', corps: 'Encore une nouvelle.' },
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(recus('soa.abonnee@hope.test', /Deuxieme actualite/).length, 0);
});

test('le gabarit d une actualite porte la photo et le lien de desinscription', async () => {
  const { miseEnPage } = await import('../src/services/courriel.service.js');
  const html = miseEnPage({
    titre: 'La cantine ouvre',
    paragraphes: ['Une bonne nouvelle.'],
    image: { src: 'http://localhost:5173/media/cantine.jpg', alt: 'La cantine ouvre' },
    desinscription: { page: 'http://localhost:5173/se-desinscrire?jeton=abc', api: 'http://localhost:5173/api/x' },
  });
  assert.match(html, /<img src="http:\/\/localhost:5173\/media\/cantine.jpg" width="496" alt="La cantine ouvre"/);
  assert.match(html, /<a href="http:\/\/localhost:5173\/se-desinscrire\?jeton=abc"[^>]*>Se désinscrire<\/a>/);
  assert.doesNotMatch(miseEnPage({ titre: 'Autre', paragraphes: ['x'] }), /Se désinscrire/);
});
