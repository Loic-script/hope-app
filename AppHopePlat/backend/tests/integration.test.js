import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { ADMIN_TEST, preparerBaseDeTest } from './aide/baseDeTest.js';

let base;
let serveur;
let api;
let fermerPool;
let jetonAdmin;

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

describe('aucune lecture ne plante (fumee)', () => {
  async function routesDeLecture(module, prefixe, valeurs) {
    const { default: routeur } = await import(module);
    const routes = [];
    for (const couche of routeur.stack) {
      if (!couche.route?.methods?.get) continue;
      const chemins = Array.isArray(couche.route.path) ? couche.route.path : [couche.route.path];
      for (const chemin of chemins) {
        routes.push(prefixe + chemin.replace(/:([A-Za-z_]+)/g, (_, nom) => String(valeurs[nom] ?? valeurs.id ?? 1)));
      }
    }
    return routes;
  }

  async function verifierLectures(routes, jeton, entetes = {}) {
    const pannes = [];
    for (const route of routes) {
      const { statut, corps } = await appel('GET', route, { jeton, entetes });
      if (statut >= 500) pannes.push(`${route} -> ${statut} ${corps?.detail ?? corps?.message ?? ''}`);
    }
    assert.deepEqual(pannes, []);
  }

  test('toutes les lectures de l administration repondent sans erreur interne', async () => {
    const projet = await creerProjet('Projet de fumee', 500_000);
    const routes = await routesDeLecture('../src/routes/admin.routes.js', '/admin', { id: projet, projectId: projet });
    assert.ok(routes.length > 40, `${routes.length} routes`);
    await verifierLectures(routes, jetonAdmin);
  });

  test('toutes les lectures des trois espaces repondent sans erreur interne', async () => {
    const { inscrire } = await import('../src/services/auth.service.js');
    const comptes = {};
    for (const type of ['donateur', 'benevole', 'bailleur']) {
      const email = `fumee.${type}.${Date.now()}@hope.test`;
      const motDePasse = `fumee-${type}-2026`;
      await inscrire({ email, typeUtilisateur: type, motDePasse, confirmation: motDePasse, accepteConditions: true });
      await base.sql("UPDATE utilisateur SET statut = 'actif', profil_complete = TRUE WHERE email = $1", [email]);
      const { corps } = await appel('POST', '/auth/login', { corps: { email, motDePasse, typeUtilisateur: type } });
      comptes[type] = corps.token;
    }
    await verifierLectures(await routesDeLecture('../src/routes/donorSpace.routes.js', '/donateur', {}), comptes.donateur);
    await verifierLectures(await routesDeLecture('../src/routes/volunteerSpace.routes.js', '/benevole', {}), comptes.benevole);
    await verifierLectures(await routesDeLecture('../src/routes/funder.routes.js', '/bailleur', {}), comptes.bailleur);
    for (const type of ['donateur', 'benevole', 'bailleur']) {
      await verifierLectures(await routesDeLecture('../src/routes/espace.routes.js', '/espace', {}), comptes[type], {
        'X-Hope-Espace': type,
      });
    }
  });
});

describe('beneficiaires : projet lie et argent depense', () => {
  test('creation avec projet et depense, tout ou rien ; la fiche additionne ses depenses', async () => {
    const projet = await creerProjet('Ecolage des orphelins', 300_000);
    const donateur = await creerDonateur();
    await appel('POST', '/admin/donations', {
      jeton: jetonAdmin,
      corps: { donorId: donateur, amount: '100000', allocation: 'PROJECT', projectId: projet, paymentMethod: 'Mvola' },
    });

    const sansProjet = await appel('POST', '/admin/beneficiaries', {
      jeton: jetonAdmin,
      corps: { firstName: 'Sans', lastName: 'Projet', beneficiaryType: 'ORPHAN', depense: { amount: '1000' } },
    });
    assert.equal(sansProjet.statut, 400);

    const tropCher = await appel('POST', '/admin/beneficiaries', {
      jeton: jetonAdmin,
      corps: { firstName: 'Trop', lastName: 'Cher', beneficiaryType: 'ORPHAN', projectId: projet, depense: { amount: '100000.01' } },
    });
    assert.equal(tropCher.statut, 422);
    const [reste] = await base.sql("SELECT count(*)::int AS n FROM beneficiaries WHERE first_name = 'Trop'");
    assert.equal(reste.n, 0, 'la fiche n est pas creee si la depense echoue');

    const cree = await appel('POST', '/admin/beneficiaries', {
      jeton: jetonAdmin,
      corps: { firstName: 'Mialy', lastName: 'Rabe', beneficiaryType: 'ORPHAN', projectId: projet, depense: { amount: '40000', category: 'Formation' } },
    });
    assert.equal(cree.statut, 201, JSON.stringify(cree.corps));
    const id = cree.corps.id;

    const autre = await appel('POST', '/admin/beneficiaries', {
      jeton: jetonAdmin,
      corps: { firstName: 'Hors', lastName: 'Projet', beneficiaryType: 'FAMILY' },
    });
    const refus = await appel('POST', '/admin/expenses', {
      jeton: jetonAdmin,
      corps: { projectId: projet, amount: '1000', description: 'Essai', beneficiaryId: autre.corps.id },
    });
    assert.equal(refus.statut, 422);
    assert.equal(refus.corps.code, 'BENEFICIAIRE_NON_RATTACHE');

    const deuxieme = await appel('POST', '/admin/expenses', {
      jeton: jetonAdmin,
      corps: { projectId: projet, amount: '10000', description: 'Soins', beneficiaryId: id },
    });
    assert.equal(deuxieme.statut, 201);

    const fiche = await appel('GET', `/admin/beneficiaries/${id}`, { jeton: jetonAdmin });
    assert.equal(fiche.corps.expenses.length, 2);
    assert.equal(fiche.corps.expenses[0].beneficiaryName, 'Mialy Rabe');
    assert.equal(fiche.corps.spentTotal, '50000.00');
    assert.equal(fiche.corps.projects.length, 1);
  });
});

describe('back office : Admin et Manager', () => {
  test('mot de passe genere, droits de chacun, renvoi et suspension', async () => {
    const creer = (role, email) =>
      appel('POST', '/admin/backoffice', { jeton: jetonAdmin, corps: { fullName: `Essai ${role}`, email, role } });

    const manager = await creer('MANAGER', 'manager@hope.test');
    assert.equal(manager.statut, 201, JSON.stringify(manager.corps));
    assert.equal(manager.corps.courrielEnvoye, false);
    assert.match(manager.corps.motDePasseProvisoire, /^.{14}$/);
    const gestion = await creer('ADMIN', 'gestion@hope.test');
    assert.equal(gestion.corps.compte.role, 'GESTIONNAIRE');
    assert.equal((await creer('MANAGER', 'MANAGER@hope.test')).statut, 422, 'adresse deja prise');

    const connexion = async (email, motDePasse) =>
      (await appel('POST', '/admin/login', { corps: { adminLog: email, password: motDePasse } })).corps.token;
    const jm = await connexion('manager@hope.test', manager.corps.motDePasseProvisoire);
    const jg = await connexion('gestion@hope.test', gestion.corps.motDePasseProvisoire);

    assert.equal((await appel('GET', '/admin/projects', { jeton: jm })).statut, 200);
    assert.equal((await appel('GET', '/admin/utilisateurs/donateurs', { jeton: jm })).statut, 403);
    assert.equal((await appel('GET', '/admin/backoffice', { jeton: jm })).statut, 403);
    const { corps: catalogue } = await appel('GET', '/admin/catalog', { jeton: jm });
    const projet = await appel('POST', '/admin/projects', {
      jeton: jm,
      corps: { name: 'Projet du manager', categoryId: catalogue.categories[0].id, location: 'Essai', startDate: '2026-01-01', requiredBudget: '1000' },
    });
    assert.equal(projet.statut, 201, JSON.stringify(projet.corps));
    assert.equal((await appel('PATCH', `/admin/projects/${projet.corps.id}`, { jeton: jm, corps: { location: 'Antsirabe' } })).statut, 200);
    assert.equal((await appel('PATCH', `/admin/projects/${projet.corps.id}/archive`, { jeton: jm })).statut, 403);
    assert.equal((await appel('POST', '/admin/categories', { jeton: jm, corps: { name: 'Interdite' } })).statut, 403);

    assert.equal((await appel('GET', '/admin/utilisateurs/benevoles', { jeton: jg })).statut, 200);
    assert.equal((await appel('GET', '/admin/backoffice', { jeton: jg })).statut, 403);
    assert.equal((await appel('POST', '/admin/categories', { jeton: jg, corps: { name: `Permise ${Date.now()}` } })).statut, 201);

    await new Promise((fin) => setTimeout(fin, 1100));
    const renvoi = await appel('POST', `/admin/backoffice/${gestion.corps.compte.id}/acces`, { jeton: jetonAdmin });
    assert.equal(renvoi.statut, 200);
    assert.equal((await appel('POST', '/admin/login', { corps: { adminLog: 'gestion@hope.test', password: gestion.corps.motDePasseProvisoire } })).statut, 401);
    assert.equal((await appel('GET', '/admin/me', { jeton: jg })).statut, 401);

    await appel('PATCH', `/admin/backoffice/${manager.corps.compte.id}`, { jeton: jetonAdmin, corps: { status: 'SUSPENDED' } });
    assert.notEqual((await appel('POST', '/admin/login', { corps: { adminLog: 'manager@hope.test', password: manager.corps.motDePasseProvisoire } })).statut, 200);
  });
});

describe('comptes crees par l equipe', () => {
  test('un benevole et un bailleur ouverts d emblee, connectables avec le mot de passe genere', async () => {
    const benevole = await appel('POST', '/admin/utilisateurs/comptes', {
      jeton: jetonAdmin,
      corps: { type: 'BENEVOLE', prenom: 'Mialy', nom: 'Rabe', email: 'mialy.equipe@hope.test' },
    });
    assert.equal(benevole.statut, 201, JSON.stringify(benevole.corps));
    const bailleur = await appel('POST', '/admin/utilisateurs/comptes', {
      jeton: jetonAdmin,
      corps: { type: 'BAILLEUR', prenom: 'Hery', nom: 'Rabe', email: 'hery.equipe@hope.test', organisation: 'Fondation Essai', typeOrganisation: 'ong' },
    });
    assert.equal(bailleur.statut, 201, JSON.stringify(bailleur.corps));
    assert.equal(
      (await appel('POST', '/admin/utilisateurs/comptes', { jeton: jetonAdmin, corps: { type: 'BAILLEUR', prenom: 'X', nom: 'Y', email: 'z@hope.test' } })).statut,
      400,
      'un bailleur sans organisation est refuse'
    );
    for (const [email, type, resultat] of [
      ['mialy.equipe@hope.test', 'benevole', benevole],
      ['hery.equipe@hope.test', 'bailleur', bailleur],
    ]) {
      const connexion = await appel('POST', '/auth/login', {
        corps: { email, motDePasse: resultat.corps.motDePasseProvisoire, typeUtilisateur: type },
      });
      assert.equal(connexion.statut, 200, `${type} : ${JSON.stringify(connexion.corps)}`);
    }
    const [org] = await base.sql(
      "SELECT b.type_organisation FROM bailleur b JOIN bailleur_contact c ON c.bailleur_id = b.id JOIN utilisateur u ON u.id = c.utilisateur_id WHERE u.email = 'hery.equipe@hope.test'"
    );
    assert.equal(org.type_organisation, 'ong');
  });
});

describe('le site vitrine public', () => {
  test('les projets : ce que le site montre, et rien de l argent ni des personnes', async () => {
    const projet = await creerProjet('Bibliotheque de Moramanga', 500_000);
    const { corps: catalogue } = await appel('GET', '/admin/catalog', { jeton: jetonAdmin });
    const interne = await appel('POST', '/admin/projects', {
      jeton: jetonAdmin,
      corps: {
        name: 'Outil interne de suivi',
        categoryId: catalogue.categories[0].id,
        location: 'Antananarivo',
        startDate: '2026-01-01',
        requiredBudget: '100000',
        projectType: 'INTERNAL',
      },
    });
    assert.equal(interne.statut, 201, JSON.stringify(interne.corps));

    const liste = await appel('GET', '/public/projets');
    assert.equal(liste.statut, 200);
    const trouve = liste.corps.items.find((p) => p.id === projet);
    assert.ok(trouve, 'le projet de la mission apparait');
    assert.equal(trouve.name, 'Bibliotheque de Moramanga');
    assert.equal(trouve.description, 'Projet cree par les tests d integration.');
    assert.equal(trouve.location, 'Antsirabe');
    for (const champ of ['requiredBudget', 'managerName', 'donorNames', 'fundedTotal', 'beneficiaryProfile', 'reference']) {
      assert.equal(champ in trouve, false, `${champ} ne sort pas sur le site`);
    }
    assert.ok(!liste.corps.items.some((p) => p.id === idDe(interne.corps)), 'un projet interne ne sort pas');

    const recherche = await appel('GET', '/public/projets?recherche=moramanga');
    assert.ok(recherche.corps.items.some((p) => p.id === projet));
    const ailleurs = await appel('GET', '/public/projets?recherche=nulle-part-zzz');
    assert.equal(ailleurs.corps.items.length, 0);

    const fiche = await appel('GET', `/public/projets/${projet}`);
    assert.equal(fiche.statut, 200);
    assert.equal(fiche.corps.name, 'Bibliotheque de Moramanga');
    assert.equal('requiredBudget' in fiche.corps, false);

    assert.equal((await appel('GET', '/public/projets/999999')).statut, 404);
    assert.equal((await appel('GET', '/public/projets/abc')).statut, 404);
    assert.equal((await appel('GET', `/public/projets/${idDe(interne.corps)}`)).statut, 404, 'la fiche d un projet interne non plus');
  });
});

describe('les actualites du site vitrine', () => {
  test('ce que l administration publie sort, sans l auteur ni les cibles ; jamais un appel a financement', async () => {
    const publiee = await appel('POST', '/admin/publications', {
      jeton: jetonAdmin,
      corps: { type: 'actualite', titre: 'Rentree des classes a Moramanga', corps: 'Premier paragraphe.\n\nSecond paragraphe.' },
    });
    assert.equal(publiee.statut, 201, JSON.stringify(publiee.corps));
    const id = idDe(publiee.corps);

    const projet = await creerProjet('Puits de Sakaraha', 300_000);
    const appelFonds = await appel('POST', '/admin/publications', {
      jeton: jetonAdmin,
      corps: { type: 'appel_financement', titre: 'Aidez le puits de Sakaraha', corps: 'Il manque du ciment.', projetId: projet },
    });
    assert.equal(appelFonds.statut, 201, JSON.stringify(appelFonds.corps));

    const liste = await appel('GET', '/public/actualites?limite=60');
    assert.equal(liste.statut, 200);
    const trouvee = liste.corps.items.find((a) => a.id === id);
    assert.ok(trouvee, 'l actualite publiee apparait');
    assert.equal(trouvee.titre, 'Rentree des classes a Moramanga');
    for (const champ of ['publiePar', 'publieParNom', 'cibles', 'montantCible', 'type']) {
      assert.equal(champ in trouvee, false, `${champ} ne sort pas sur le site`);
    }
    assert.ok(!liste.corps.items.some((a) => a.id === idDe(appelFonds.corps)), 'un appel a financement ne sort pas');

    const article = await appel('GET', `/public/actualites/${id}`);
    assert.equal(article.statut, 200);
    assert.equal(article.corps.corps, 'Premier paragraphe.\n\nSecond paragraphe.');
    assert.equal('publiePar' in article.corps, false);

    assert.equal((await appel('GET', `/public/actualites/${idDe(appelFonds.corps)}`)).statut, 404);
    assert.equal((await appel('GET', '/public/actualites/0d7e2a2e-7d3f-4a6f-9c1b-2f8a3e5b1c11')).statut, 404);
    assert.equal((await appel('GET', '/public/actualites/abc')).statut, 404);
  });
});

describe('les benevoles du site vitrine', () => {
  test('un benevole actif parait par son prenom et sa photo, sauf s il demande a rester hors du site', async () => {
    async function benevole(email, prenom) {
      const compte = await appel('POST', '/admin/utilisateurs/comptes', {
        jeton: jetonAdmin,
        corps: { type: 'BENEVOLE', prenom, nom: 'Rakoto', email },
      });
      assert.equal(compte.statut, 201, JSON.stringify(compte.corps));
      const connexion = await appel('POST', '/auth/login', {
        corps: { email, motDePasse: compte.corps.motDePasseProvisoire, typeUtilisateur: 'benevole' },
      });
      assert.equal(connexion.statut, 200, JSON.stringify(connexion.corps));
      return connexion.corps.token;
    }
    const discret = await benevole('fy.site@hope.test', 'Fy');
    const visible = await benevole('noro.site@hope.test', 'Noro');

    const avant = await appel('GET', '/public/benevoles');
    assert.equal(avant.statut, 200);
    const noro = avant.corps.items.find((b) => b.prenom === 'Noro');
    assert.ok(noro, 'un benevole actif parait d emblee');
    assert.deepEqual(Object.keys(noro).sort(), ['id', 'photoUrl', 'prenom'], 'prenom et photo, rien d autre');
    assert.ok(avant.corps.items.some((b) => b.prenom === 'Fy'));

    const retrait = await appel('PATCH', '/benevole/profil', { jeton: discret, corps: { masqueSite: true } });
    assert.equal(retrait.statut, 200, JSON.stringify(retrait.corps));
    assert.equal(retrait.corps.masqueSite, true);
    await appel('PATCH', '/benevole/profil', { jeton: visible, corps: { profession: 'Enseignante' } });

    const apres = await appel('GET', '/public/benevoles');
    assert.ok(!apres.corps.items.some((b) => b.prenom === 'Fy'), 'celui qui s est retire disparait du site');
    assert.ok(apres.corps.items.some((b) => b.prenom === 'Noro'), 'l autre y reste');

    const retour = await appel('PATCH', '/benevole/profil', { jeton: discret, corps: { masqueSite: false } });
    assert.equal(retour.corps.masqueSite, false);
    assert.ok((await appel('GET', '/public/benevoles')).corps.items.some((b) => b.prenom === 'Fy'), 'il revient quand il le decide');
  });
});
