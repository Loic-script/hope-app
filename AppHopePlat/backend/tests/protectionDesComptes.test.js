import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

import { ADMIN_TEST, preparerBaseDeTest } from './aide/baseDeTest.js';

const MOT_DE_PASSE = 'protection-2026';

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

async function inscrire(email, typeUtilisateur) {
  const inscription = await appel('POST', '/auth/inscription', {
    corps: { email, typeUtilisateur, motDePasse: MOT_DE_PASSE, confirmation: MOT_DE_PASSE, accepteConditions: true },
  });
  assert.equal(inscription.statut, 201, JSON.stringify(inscription.corps));
  return inscription.corps;
}

async function connecter(email, typeUtilisateur) {
  const connexion = await appel('POST', '/auth/login', { corps: { email, motDePasse: MOT_DE_PASSE, typeUtilisateur } });
  assert.equal(connexion.statut, 200, JSON.stringify(connexion.corps));
  return connexion.corps.token;
}

before(async () => {
  base = await preparerBaseDeTest({ prefixe: 'hope_test_protection' });
  console.log = (...morceaux) => {
    const texte = morceaux.join(' ');
    if (/^\[HOPE\] Courriel/.test(texte)) courriels.push(texte);
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

test('le jeton de completion d un benevole pas encore valide n ouvre pas la messagerie', async () => {
  const { jetonCompletion } = await inscrire('rado.attente@hope.test', 'benevole');
  assert.ok(jetonCompletion);
  const espace = { jeton: jetonCompletion, entetes: { 'X-Hope-Espace': 'benevole' } };
  assert.equal((await appel('GET', '/espace/conversations/joignables', espace)).statut, 401);
  assert.equal((await appel('POST', '/espace/conversations', { ...espace, corps: { cible: { type: 'equipe' } } })).statut, 401);
});

test('un compte suspendu, puis supprime par l equipe, perd aussitot les routes communes', async () => {
  const email = 'lova.suspendue@hope.test';
  await inscrire(email, 'donateur');
  const jeton = await connecter(email, 'donateur');
  const espace = { jeton, entetes: { 'X-Hope-Espace': 'donateur' } };
  assert.equal((await appel('GET', '/espace/compte', espace)).statut, 200);

  await base.sql("UPDATE utilisateur SET statut = 'suspendu' WHERE email = $1", [email]);
  assert.equal((await appel('GET', '/espace/compte', espace)).statut, 401);
  await base.sql("UPDATE utilisateur SET statut = 'actif' WHERE email = $1", [email]);
  assert.equal((await appel('GET', '/espace/compte', espace)).statut, 200);

  const [{ id }] = await base.sql('SELECT id FROM utilisateur WHERE email = $1', [email]);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const suppression = await appel('DELETE', `/admin/utilisateurs/comptes/${id}`, { jeton: jetonAdmin, corps: {} });
  assert.equal(suppression.statut, 200, JSON.stringify(suppression.corps));
  await base.sql("UPDATE utilisateur SET statut = 'actif' WHERE id = $1", [id]);
  assert.equal((await appel('GET', '/espace/compte', espace)).statut, 401, 'les sessions ouvertes avant la suppression sont fermees');
});

test('un don sans compte ne remplace pas le nom ni le telephone deja connus pour cette adresse', async () => {
  const don = (prenom, nom, telephone) =>
    appel('POST', '/public/dons', {
      corps: {
        donateur: { prenom, nom, email: 'fara.donatrice@hope.test', telephone, pays: 'MG' },
        affectation: 'HOPE',
        montant: '5000',
        mode: 'mvola',
      },
    });
  const premier = await don('Fara', 'Rasoa', '+261340000001');
  assert.equal(premier.statut, 201, JSON.stringify(premier.corps));
  const second = await don('Usurpateur', 'Faux', '+261340000099');
  assert.equal(second.statut, 201, JSON.stringify(second.corps));

  const fiches = await base.sql(
    "SELECT first_name, last_name, phone FROM donors WHERE lower(email) = 'fara.donatrice@hope.test'"
  );
  assert.deepEqual(fiches, [{ first_name: 'Fara', last_name: 'Rasoa', phone: '+261340000001' }]);
});

test('un don rembourse ne repasse jamais en recu sur une confirmation de paiement', async () => {
  const { statut, corps } = await appel('POST', '/admin/donors', {
    jeton: jetonAdmin,
    corps: { firstName: 'Tiana', lastName: 'Test', origin: 'INTERNATIONAL', email: 'tiana.rembourse@hope.test' },
  });
  assert.equal(statut, 201, JSON.stringify(corps));
  const donateur = corps.id ?? corps.donor?.id ?? corps.item?.id;
  const cree = await appel('POST', '/admin/donations', {
    jeton: jetonAdmin,
    corps: { donorId: donateur, amount: '50', allocation: 'HOPE', paymentMethod: 'Carte bancaire' },
  });
  assert.equal(cree.statut, 201, JSON.stringify(cree.corps));
  const donId = cree.corps.id ?? cree.corps.donation?.id ?? cree.corps.item?.id;
  await base.sql("UPDATE donations SET status = 'REFUNDED' WHERE id = $1", [donId]);

  const { confirmerPaiementEnLigne } = await import('../src/repositories/donation.repository.js');
  assert.equal(await confirmerPaiementEnLigne(donId, { statutFournisseur: 'paid' }), null);
  const [ligne] = await base.sql('SELECT status FROM donations WHERE id = $1', [donId]);
  assert.equal(ligne.status, 'REFUNDED');
});

test('l accuse de reception du formulaire de contact ne reprend pas le texte du visiteur', async () => {
  const envoi = await appel('POST', '/public/contact', {
    corps: {
      nom: 'Tresorerie HOPE',
      courriel: 'cible.contact@hope.test',
      sujet: 'don',
      message: 'Votre don est bloque, renvoyez-le au 0340000000 par MVola.',
    },
  });
  assert.equal(envoi.statut, 201, JSON.stringify(envoi.corps));
  const limite = Date.now() + 3000;
  let accuse;
  while (!accuse && Date.now() < limite) {
    accuse = courriels.find((texte) => texte.includes('a cible.contact@hope.test'));
    if (!accuse) await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(accuse, 'accuse de reception attendu');
  assert.doesNotMatch(accuse, /MVola|0340000000|Tresorerie/);
});
