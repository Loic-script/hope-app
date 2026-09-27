/*
 * Tests d'integration : l'application entiere, par de vraies requetes
 * HTTP, sur une base PostgreSQL jetable (tests/aide/baseDeTest.js).
 *
 * Ils couvrent ce qu'un test unitaire ne voit pas : les regles sur
 * l'argent (422), les droits (403), les doublons, la limitation des
 * tentatives (429), et que le hash d'un mot de passe ne sort jamais.
 * La traduction de chaque erreur en code HTTP est dans erreurs.test.js.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { ADMIN_TEST, preparerBaseDeTest } from './aide/baseDeTest.js';

let base;
let serveur;
let api;
let fermerPool;
let jetonAdmin;

/** Un appel JSON ; rend { statut, corps, cookies }. */
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
  let json = null;
  try {
    json = texte ? JSON.parse(texte) : null;
  } catch {
    json = texte;
  }
  return { statut: reponse.status, corps: json, cookies: reponse.headers.getSetCookie?.() ?? [] };
}

const idDe = (objet) => objet?.id ?? objet?.project?.id ?? objet?.donor?.id ?? objet?.item?.id;

before(async () => {
  base = await preparerBaseDeTest();
  // L'application est importee APRES la bascule sur la base de test.
  const { creerApplication } = await import('../src/app.js');
  ({ fermerPool } = await import('../src/config/database.js'));
  serveur = creerApplication().listen(0);
  await new Promise((resolve) => serveur.once('listening', resolve));
  api = `http://127.0.0.1:${serveur.address().port}/api`;
  const { corps } = await appel('POST', '/admin/login', { corps: ADMIN_TEST });
  jetonAdmin = corps.token;
});

after(async () => {
  await new Promise((resolve) => serveur?.close(resolve));
  await fermerPool?.();
  await base?.detruire();
});

/** Un projet en cours, au budget donne. */
async function creerProjet(nom, budget) {
  const { corps: catalogue } = await appel('GET', '/admin/catalog', { jeton: jetonAdmin });
  const { statut, corps } = await appel('POST', '/admin/projects', {
    jeton: jetonAdmin,
    corps: {
      name: nom,
      categoryId: catalogue.categories[0].id,
      location: 'Antsirabe',
      startDate: '2026-01-01',
      requiredBudget: String(budget),
      description: 'Projet cree par les tests d integration.',
    },
  });
  assert.equal(statut, 201, JSON.stringify(corps));
  return idDe(corps);
}

async function creerDonateur() {
  const { statut, corps } = await appel('POST', '/admin/donors', {
    jeton: jetonAdmin,
    corps: { firstName: 'Voahangy', lastName: 'Test', origin: 'LOCAL', email: `donateur.${Date.now()}@hope.test` },
  });
  assert.equal(statut, 201, JSON.stringify(corps));
  return idDe(corps);
}

describe('les regles sur l argent (422)', () => {
  test('une depense ne depasse jamais l argent recu par le projet', async () => {
    const projet = await creerProjet('Puits de Betafo', 1_000_000);
    const donateur = await creerDonateur();
    const refus = await appel('POST', '/admin/expenses', {
      jeton: jetonAdmin,
      corps: { projectId: projet, amount: '1000', description: 'Ciment' },
    });
    assert.equal(refus.statut, 422, 'sans argent recu, aucune depense');

    const don = await appel('POST', '/admin/donations', {
      jeton: jetonAdmin,
      corps: { donorId: donateur, amount: '300000', allocation: 'PROJECT', projectId: projet, paymentMethod: 'Mvola' },
    });
    assert.equal(don.statut, 201, JSON.stringify(don.corps));

    const accepte = await appel('POST', '/admin/expenses', {
      jeton: jetonAdmin,
      corps: { projectId: projet, amount: '250000', description: 'Ciment et sable' },
    });
    assert.equal(accepte.statut, 201, JSON.stringify(accepte.corps));

    const trop = await appel('POST', '/admin/expenses', {
      jeton: jetonAdmin,
      corps: { projectId: projet, amount: '50000.01', description: 'Main d oeuvre' },
    });
    assert.equal(trop.statut, 422, 'il reste 50 000 : un centime de plus est refuse');

    const juste = await appel('POST', '/admin/expenses', {
      jeton: jetonAdmin,
      corps: { projectId: projet, amount: '50000', description: 'Main d oeuvre' },
    });
    assert.equal(juste.statut, 201, 'le montant exact passe');
  });

  test('le fonds HOPE ne s investit pas au-dela de ce qu il contient, ni au-dela du besoin', async () => {
    const projet = await creerProjet('Cantine de Mahasoa', 200_000);
    const donateur = await creerDonateur();
    const avant = await appel('POST', '/admin/investments', {
      jeton: jetonAdmin,
      corps: { projectId: projet, amount: '1', justification: 'Essai' },
    });
    assert.equal(avant.statut, 422);
    assert.equal(avant.corps.code, 'FONDS_INSUFFISANT');

    await appel('POST', '/admin/donations', {
      jeton: jetonAdmin,
      corps: { donorId: donateur, amount: '500000', allocation: 'HOPE', paymentMethod: 'Espèces' },
    });
    const auDela = await appel('POST', '/admin/investments', {
      jeton: jetonAdmin,
      corps: { projectId: projet, amount: '250000', justification: 'Plus que le besoin' },
    });
    assert.equal(auDela.statut, 422, 'le projet n a besoin que de 200 000');

    const ok = await appel('POST', '/admin/investments', {
      jeton: jetonAdmin,
      corps: { projectId: projet, amount: '200000', justification: 'Le besoin exact' },
    });
    assert.equal(ok.statut, 201, JSON.stringify(ok.corps));

    const encore = await appel('POST', '/admin/investments', {
      jeton: jetonAdmin,
      corps: { projectId: projet, amount: '1', justification: 'Deja finance' },
    });
    assert.equal(encore.statut, 422);
    assert.equal(encore.corps.code, 'PROJET_DEJA_FINANCE');
  });

  test('un moyen de paiement hors zone est refuse', async () => {
    const donateur = await creerDonateur();
    const { statut, corps } = await appel('POST', '/admin/donations', {
      jeton: jetonAdmin,
      corps: { donorId: donateur, amount: '1000', allocation: 'HOPE', paymentMethod: 'PayPal' },
    });
    assert.equal(statut, 422);
    assert.equal(corps.code, 'MOYEN_PAIEMENT_INDISPONIBLE');
  });

  test('les montants sont enregistres au centime, sans flottant', async () => {
    const donateur = await creerDonateur();
    await appel('POST', '/admin/donations', {
      jeton: jetonAdmin,
      corps: { donorId: donateur, amount: '0.10', allocation: 'HOPE', paymentMethod: 'Espèces' },
    });
    await appel('POST', '/admin/donations', {
      jeton: jetonAdmin,
      corps: { donorId: donateur, amount: '0.20', allocation: 'HOPE', paymentMethod: 'Espèces' },
    });
    const [ligne] = await base.sql('SELECT SUM(amount)::text AS total FROM donations WHERE donor_id = $1', [donateur]);
    assert.equal(ligne.total, '0.30');
  });
});

describe('les droits (403)', () => {
  test('un compte en lecture seule consulte, mais ne modifie rien', async () => {
    const cree = await appel('POST', '/admin/team', {
      jeton: jetonAdmin,
      corps: { adminLog: 'LecteurTest', fullName: 'Lecteur Test', role: 'VIEWER', password: 'lecture-seule-2026' },
    });
    assert.equal(cree.statut, 201, JSON.stringify(cree.corps));
    const { corps } = await appel('POST', '/admin/login', { corps: { adminLog: 'LecteurTest', password: 'lecture-seule-2026' } });
    const lecteur = corps.token;

    assert.equal((await appel('GET', '/admin/projects', { jeton: lecteur })).statut, 200);
    const refus = await appel('POST', '/admin/categories', { jeton: lecteur, corps: { name: 'Interdite' } });
    assert.equal(refus.statut, 403);
    assert.equal(refus.corps.code, 'DROIT_INSUFFISANT');
    assert.equal((await appel('GET', '/admin/audit', { jeton: lecteur })).statut, 403, 'le journal d audit est reserve au role ADMIN');
  });

  test('un bailleur dont l acces est suspendu ne consulte plus rien', async () => {
    const email = `bailleur.${Date.now()}@hope.test`;
    const inscription = await appel('POST', '/auth/inscription', {
      corps: { email, typeUtilisateur: 'bailleur', motDePasse: 'bailleur-test-2026', confirmation: 'bailleur-test-2026', accepteConditions: true },
    });
    assert.equal(inscription.statut, 201, JSON.stringify(inscription.corps));
    await base.sql("UPDATE utilisateur SET statut = 'actif' WHERE email = $1", [email]);
    const connexion = await appel('POST', '/auth/login', {
      corps: { email, motDePasse: 'bailleur-test-2026', typeUtilisateur: 'bailleur' },
    });
    assert.equal(connexion.statut, 200);
    const jeton = connexion.corps.token;
    assert.equal((await appel('GET', '/bailleur/tableau-de-bord', { jeton })).statut, 200);

    await base.sql(
      'UPDATE bailleur_contact SET peut_consulter = FALSE WHERE utilisateur_id = (SELECT id FROM utilisateur WHERE email = $1)',
      [email]
    );
    const refus = await appel('GET', '/bailleur/tableau-de-bord', { jeton });
    assert.equal(refus.statut, 403);

  });
});

describe('les doublons', () => {
  test('une adresse deja inscrite est refusee avec un message clair', async () => {
    const email = `doublon.${Date.now()}@hope.test`;
    const premiere = await appel('POST', '/auth/inscription', {
      corps: { email, typeUtilisateur: 'donateur', motDePasse: 'doublon-2026', confirmation: 'doublon-2026', accepteConditions: true },
    });
    assert.equal(premiere.statut, 201);
    const seconde = await appel('POST', '/auth/inscription', {
      corps: { email, typeUtilisateur: 'donateur', motDePasse: 'doublon-2026', confirmation: 'doublon-2026', accepteConditions: true },
    });
    assert.equal(seconde.statut, 400, 'le service le dit lui-meme : adresse deja utilisee');
    assert.match(seconde.corps.message, /déjà/);
  });

  test('une categorie en double est refusee', async () => {
    const corps = { name: `Categorie ${Date.now()}` };
    assert.equal((await appel('POST', '/admin/categories', { jeton: jetonAdmin, corps })).statut, 201);
    const doublon = await appel('POST', '/admin/categories', { jeton: jetonAdmin, corps });
    assert.equal(doublon.statut, 422);
    assert.equal(doublon.corps.code, 'CATEGORIE_EXISTANTE');
  });
});

describe('les secrets ne sortent jamais', () => {
  test('ni la connexion, ni la liste de l equipe, ni un profil ne portent de hash', async () => {
    const connexion = await appel('POST', '/admin/login', { corps: ADMIN_TEST });
    const equipe = await appel('GET', '/admin/team', { jeton: jetonAdmin });
    const moi = await appel('GET', '/admin/me', { jeton: jetonAdmin });
    for (const reponse of [connexion, equipe, moi]) {
      const texte = JSON.stringify(reponse.corps);
      assert.ok(!/password_?hash|mot_de_passe|\$2[aby]\$/i.test(texte), texte.slice(0, 200));
    }
  });

  test('la connexion pose un cookie httpOnly et Strict', async () => {
    const connexion = await appel('POST', '/admin/login', { corps: ADMIN_TEST });
    const cookie = connexion.cookies.find((c) => c.startsWith('hope_admin=')) ?? '';
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Path=\/api/);
  });
});

describe('la limitation des tentatives (429)', () => {
  test('trop de demandes de mot de passe oublie sont freinees', async () => {
    const statuts = [];
    for (let i = 0; i < 7; i += 1) {
      statuts.push((await appel('POST', '/auth/mot-de-passe-oublie', { corps: { email: 'personne@hope.test' } })).statut);
    }
    assert.deepEqual(statuts.slice(0, 5), [200, 200, 200, 200, 200]);
    assert.equal(statuts[6], 429);
  });
});
