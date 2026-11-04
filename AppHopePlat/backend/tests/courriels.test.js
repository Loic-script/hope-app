import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

import { ADMIN_TEST, preparerBaseDeTest } from './aide/baseDeTest.js';

const EQUIPE = 'equipe@hope.test';
const COURRIEL = /^\[HOPE\] Courriel \(domaine reserve, non envoye\) a (\S+) — ([^\n]*)\n([\s\S]*)$/;

let base;
let serveur;
let api;
let fermerPool;
let jetonAdmin;
let courrielsAuto;
const journal = console.log;
const courriels = [];

async function appel(methode, chemin, { corps, jeton } = {}) {
  const reponse = await fetch(api + chemin, {
    method: methode,
    headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
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

async function inscrire(email, typeUtilisateur) {
  const { statut, corps } = await appel('POST', '/auth/inscription', {
    corps: { email, typeUtilisateur, motDePasse: 'courriels-2026', confirmation: 'courriels-2026', accepteConditions: true },
  });
  assert.equal(statut, 201, JSON.stringify(corps));
  const lien = await attendre(email, /confirmez votre adresse/);
  const [jeton] = /[a-f0-9]{64}/.exec(lien.texte);
  const [{ id }] = await base.sql('SELECT id FROM utilisateur WHERE email = $1', [email]);
  return { id, jeton };
}

async function confirmer(jeton) {
  return appel('POST', '/auth/verifier-courriel', { corps: { jeton } });
}

before(async () => {
  base = await preparerBaseDeTest({ prefixe: 'hope_test_courriels' });
  process.env.EQUIPE_EMAIL = EQUIPE;
  console.log = (...morceaux) => {
    const trouve = COURRIEL.exec(morceaux.join(' '));
    if (trouve) courriels.push({ a: trouve[1], sujet: trouve[2], texte: trouve[3] });
    else journal(...morceaux);
  };
  const { creerApplication } = await import('../src/app.js');
  ({ fermerPool } = await import('../src/config/database.js'));
  courrielsAuto = await import('../src/services/courrielsAutomatiques.service.js');
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

test('une adresse confirmee recoit sa bienvenue, une seule fois, selon que l espace est ouvert ou non', async () => {
  const donateur = await inscrire('ravo.donateur@hope.test', 'donateur');
  assert.equal((await confirmer(donateur.jeton)).statut, 200);
  const ouvert = await attendre('ravo.donateur@hope.test', /bienvenue dans votre espace donateur/);
  assert.match(ouvert.texte, /\/donateur$/m);
  assert.equal((await confirmer(donateur.jeton)).statut, 400);

  const benevole = await inscrire('hery.benevole@hope.test', 'benevole');
  await attendre(EQUIPE, /un compte bénévole attend sa validation/);
  await confirmer(benevole.jeton);
  const enAttente = await attendre('hery.benevole@hope.test', /votre adresse est confirmée/);
  assert.match(enAttente.texte, /vérifie maintenant votre inscription comme bénévole/);

  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(recus('ravo.donateur@hope.test', /bienvenue/).length, 1);
});

test('valider, suspendre ou refuser un compte : la personne est prevenue', async () => {
  const [{ id: hery }] = await base.sql("SELECT id FROM utilisateur WHERE email = 'hery.benevole@hope.test'");
  const statut = (id, valeur) =>
    appel('PATCH', `/admin/volunteers/${id}/status`, { jeton: jetonAdmin, corps: { statut: valeur } });

  assert.equal((await statut(hery, 'actif')).statut, 200);
  await attendre('hery.benevole@hope.test', /votre compte bénévole est validé/);
  assert.equal((await statut(hery, 'suspendu')).statut, 200);
  const suspendu = await attendre('hery.benevole@hope.test', /votre espace est suspendu/);
  assert.match(suspendu.texte, /\/contact$/m);

  const refuse = await inscrire('lova.benevole@hope.test', 'benevole');
  await confirmer(refuse.jeton);
  const suppression = await appel('DELETE', `/admin/utilisateurs/comptes/${refuse.id}`, { jeton: jetonAdmin });
  assert.equal(suppression.statut, 200, JSON.stringify(suppression.corps));
  await attendre('lova.benevole@hope.test', /votre inscription n’a pas été retenue/);
});

test('une demande de tache previent l equipe, et sa reponse previent le benevole', async () => {
  const fara = await inscrire('fara.benevole@hope.test', 'benevole');
  await confirmer(fara.jeton);
  await appel('PATCH', `/admin/volunteers/${fara.id}/status`, { jeton: jetonAdmin, corps: { statut: 'actif' } });

  const { corps: catalogue } = await appel('GET', '/admin/catalog', { jeton: jetonAdmin });
  const projet = await appel('POST', '/admin/projects', {
    jeton: jetonAdmin,
    corps: {
      name: 'Cantine de Betafo',
      categoryId: catalogue.categories[0].id,
      location: 'Betafo',
      startDate: '2026-01-01',
      requiredBudget: '1000000',
      description: 'Projet cree par les tests des courriels.',
    },
  });
  const projetId = projet.corps.id ?? projet.corps.project?.id;
  const taches = await import('../src/services/task.service.js');
  const tache = await taches.creerPourProjet(projetId, { titre: 'Peindre la cantine' });

  const vue = await taches.demander(tache.id, fara.id);
  const demande = await attendre(EQUIPE, /une demande de tâche à valider/);
  assert.match(demande.texte, /« Peindre la cantine » \(Cantine de Betafo\)/);

  const [{ id: benevoleId }] = await base.sql('SELECT id FROM benevole WHERE utilisateur_id = $1', [fara.id]);
  await taches.accepter(vue.id ?? tache.id, benevoleId);
  const reponse = await attendre('fara.benevole@hope.test', /demande acceptée/);
  assert.match(reponse.texte, /Vous faites partie de l’équipe de « Peindre la cantine »/);
  assert.match(reponse.texte, /\/benevole\/taches$/m);
});

test('messagerie : un courriel par message non lu, pas un par ligne', async () => {
  const [{ id: ravo }] = await base.sql("SELECT id FROM utilisateur WHERE email = 'ravo.donateur@hope.test'");
  const [{ id: admin }] = await base.sql('SELECT id FROM admins ORDER BY id LIMIT 1');
  const [{ id: fil }] = await base.sql("INSERT INTO conversation (type, assistance) VALUES ('individuel', TRUE) RETURNING id");
  await base.sql(
    'INSERT INTO conversation_participant (conversation_id, utilisateur_id, admin_id) VALUES ($1, $2, NULL), ($1, NULL, $3)',
    [fil, ravo, admin]
  );
  const ecrire = async (auteur, corps) => {
    const [{ id }] = await base.sql(
      `INSERT INTO conversation_message (conversation_id, utilisateur_id, admin_id, auteur_nom, corps)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [fil, auteur === 'ravo' ? ravo : null, auteur === 'ravo' ? null : admin, auteur === 'ravo' ? 'Ravo' : 'Équipe', corps]
    );
    await courrielsAuto.nouveauMessage(id);
  };

  await ecrire('ravo', 'Bonjour, ou en est mon recu ?');
  await ecrire('ravo', 'Merci d avance.');
  const alertes = recus(EQUIPE, /un message de Ravo/);
  assert.equal(alertes.length, 1);
  assert.match(alertes[0].texte, /« Bonjour, ou en est mon recu \? »/);
  assert.match(alertes[0].texte, new RegExp(`/admin/conversations/${fil}$`, 'm'));

  await ecrire('equipe', 'Il part demain.');
  await ecrire('equipe', 'Bonne journee !');
  const avis = recus('ravo.donateur@hope.test', /un nouveau message de l’équipe/);
  assert.equal(avis.length, 1);
  assert.match(avis[0].texte, new RegExp(`/donateur/messages/${fil}$`, 'm'));

  await base.sql('UPDATE conversation_participant SET lu_jusqu_a = NOW() WHERE conversation_id = $1 AND utilisateur_id = $2', [fil, ravo]);
  await ecrire('equipe', 'Le voici en piece jointe.');
  assert.equal(recus('ravo.donateur@hope.test', /un nouveau message de l’équipe/).length, 2);
});

test('carte : l equipe apprend le don, le donateur d un paiement inabouti est relance une fois', async () => {
  const { corps: fiche } = await appel('POST', '/admin/donors', {
    jeton: jetonAdmin,
    corps: { firstName: 'Mamy', lastName: 'Carte', origin: 'INTERNATIONAL', email: 'mamy.carte@hope.test' },
  });
  const donorId = fiche.id ?? fiche.donor?.id;
  const donner = async () => {
    const { statut, corps } = await appel('POST', '/admin/donations', {
      jeton: jetonAdmin,
      corps: { donorId, amount: '50000', allocation: 'HOPE', paymentMethod: 'Carte bancaire' },
    });
    assert.equal(statut, 201, JSON.stringify(corps));
    const id = corps.id ?? corps.donation?.id;
    await base.sql("UPDATE donations SET status = 'PENDING' WHERE id = $1", [id]);
    return id;
  };

  const abandonne = await donner();
  await courrielsAuto.donParCarte(abandonne);
  assert.match((await attendre(EQUIPE, /don par carte de 50 000 Ar/)).texte, /Mamy Carte a donné 50 000 Ar par carte/);

  await courrielsAuto.paiementInabouti(abandonne);
  const relance = await attendre('mamy.carte@hope.test', /votre don n’a pas abouti/);
  assert.match(relance.texte, /aucun montant n’a été débité/);
  assert.match(relance.texte, /\/faire-un-don$/m);

  await donner();
  await courrielsAuto.paiementInabouti(abandonne);
  assert.equal(recus('mamy.carte@hope.test', /n’a pas abouti/).length, 1, 'un don fait depuis : pas de relance');
});

test('l interet d un bailleur arrive a l equipe avec son message', async () => {
  await courrielsAuto.interetDeBailleur({ organisation: 'Fondation Avenir', projet: 'Cantine de Betafo', message: 'Nous aimerions financer la cantine.' });
  const interet = await attendre(EQUIPE, /Fondation Avenir souhaite financer « Cantine de Betafo »/);
  assert.match(interet.texte, /Son message : « Nous aimerions financer la cantine. »/);
});
