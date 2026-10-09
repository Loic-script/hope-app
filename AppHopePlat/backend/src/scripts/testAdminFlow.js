import { config } from '../config/env.js';
import { fermerPool, query } from '../config/database.js';

const BASE = `http://localhost:${config.port}/api`;

let reussis = 0;
let echoues = 0;
let jeton = null;

function verifier(libelle, condition, detail = '') {
  if (condition) {
    reussis += 1;
    console.log(`  OK    ${libelle}`);
  } else {
    echoues += 1;
    console.log(`  ECHEC ${libelle}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function appeler(methode, chemin, corps = null) {
  const reponse = await fetch(`${BASE}${chemin}`, {
    method: methode,
    headers: {
      ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
      ...(corps ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(corps ? { body: JSON.stringify(corps) } : {}),
  });

  let donnees = null;
  try {
    donnees = await reponse.json();
  } catch {
    donnees = null;
  }
  return { statut: reponse.status, corps: donnees };
}

async function executer() {
  console.log(`\n[HOPE] Tests de l'espace administrateur sur ${BASE}\n`);

  console.log('AUTHENTIFICATION');
  const sansJeton = await appeler('GET', '/admin/projects');
  verifier('GET /admin/projects sans jeton renvoie 401', sansJeton.statut === 401, `statut ${sansJeton.statut}`);

  const connexion = await appeler('POST', '/admin/login', {
    adminLog: config.admin.log,
    password: config.admin.password,
  });
  verifier('connexion AdminHope reussie', connexion.statut === 200, `statut ${connexion.statut}`);
  jeton = connexion.corps?.token;

  const cheminsProteges = [
    '/admin/dashboard',
    '/admin/catalog',
    '/admin/statistics',
    '/admin/fund',
    '/admin/investments',
    '/admin/notifications',
    '/admin/donors',
    '/admin/donations',
    '/admin/messages',
    '/admin/impacts',
    '/admin/expenses',
    '/admin/beneficiaries',
  ];
  const jetonValide = jeton;
  jeton = null;
  const statuts = await Promise.all(
    cheminsProteges.map(async (chemin) => (await appeler('GET', chemin)).statut)
  );
  jeton = jetonValide;
  verifier(
    `les ${cheminsProteges.length} routes admin renvoient 401 sans jeton`,
    statuts.every((statut) => statut === 401),
    statuts.join(', ')
  );

  console.log('\nDONNEES DE REFERENCE');
  const catalogue = await appeler('GET', '/admin/catalog');
  verifier('GET /admin/catalog repond 200', catalogue.statut === 200);
  verifier(
    'les categories de projet sont disponibles',
    Array.isArray(catalogue.corps?.categories) && catalogue.corps.categories.length >= 7
  );
  verifier(
    'les moyens de paiement dependent de la localisation',
    Array.isArray(catalogue.corps?.paymentMethods?.LOCAL) &&
      Array.isArray(catalogue.corps?.paymentMethods?.INTERNATIONAL) &&
      catalogue.corps.paymentMethods.LOCAL.includes('Mvola') &&
      catalogue.corps.paymentMethods.INTERNATIONAL.includes('PayPal')
  );
  verifier(
    'les statuts de projet sont bien En cours / Termine / Archive',
    catalogue.corps?.labels?.projectStatus?.IN_PROGRESS === 'En cours' &&
      catalogue.corps?.labels?.projectStatus?.COMPLETED === 'Terminé'
  );
  const categorieId = catalogue.corps?.categories?.[0]?.id;

  console.log('\nPROJET : creation avec budget necessaire');
  const creationProjet = await appeler('POST', '/admin/projects', {
    name: '[TEST] Soutien scolaire Antananarivo',
    description: 'Projet cree par les tests automatises.',
    categoryId: categorieId,
    location: 'Antananarivo',
    managerName: 'Testeur HOPE',
    requiredBudget: '5000000',
    beneficiaryProfile: 'Enfants orphelins',
    beneficiaryTarget: 100,
  });
  verifier('creation du projet (201)', creationProjet.statut === 201, `statut ${creationProjet.statut}`);
  const projet = creationProjet.corps;
  verifier('le projet demarre EN COURS', projet?.status === 'IN_PROGRESS', projet?.status);
  verifier('une reference lisible est generee', /^PRJ-\d{4}-\d{4}$/.test(projet?.reference ?? ''), projet?.reference);
  verifier('le budget necessaire vaut 5 000 000', projet?.requiredBudget === '5000000.00', projet?.requiredBudget);
  verifier('rien n est encore finance', projet?.fundedTotal === '0', projet?.fundedTotal);

  const sansBudget = await appeler('POST', '/admin/projects', { name: '[TEST] Sans budget' });
  verifier('refus d un projet sans budget necessaire (400)', sansBudget.statut === 400, `statut ${sansBudget.statut}`);

  const budgetNegatif = await appeler('POST', '/admin/projects', {
    name: '[TEST] Budget negatif',
    requiredBudget: '-100',
  });
  verifier('refus d un budget negatif (400)', budgetNegatif.statut === 400, `statut ${budgetNegatif.statut}`);

  const modification = await appeler('PATCH', `/admin/projects/${projet.id}`, {
    location: 'Antananarivo - Analakely',
  });
  verifier('modification du projet (200)', modification.statut === 200);
  verifier('la localisation a bien change', modification.corps?.location === 'Antananarivo - Analakely');

  console.log('\nDONATEURS : ponctuel, regulier, international');
  const donateurLocal = await appeler('POST', '/admin/donors', {
    firstName: '[TEST]',
    lastName: 'Donateur local',
    email: 'test.local@example.mg',
    country: 'Madagascar',
    city: 'Antananarivo',
  });
  verifier('creation du donateur local (201)', donateurLocal.statut === 201, `statut ${donateurLocal.statut}`);
  verifier('son origine est LOCAL', donateurLocal.corps?.origin === 'LOCAL', donateurLocal.corps?.origin);
  verifier('il n a pas encore de compte', donateurLocal.corps?.hasAccount === false);

  const donateurEtranger = await appeler('POST', '/admin/donors', {
    firstName: '[TEST]',
    lastName: 'Donateur etranger',
    email: 'test.intl@example.fr',
    country: 'France',
    city: 'Lyon',
  });
  verifier(
    'un donateur hors de Madagascar est INTERNATIONAL',
    donateurEtranger.corps?.origin === 'INTERNATIONAL',
    donateurEtranger.corps?.origin
  );

  const sansIdentite = await appeler('POST', '/admin/donors', { email: 'vide@example.mg' });
  verifier('refus d un donateur sans identite (422)', sansIdentite.statut === 422, `statut ${sansIdentite.statut}`);

  const compte = await appeler('POST', `/admin/donors/${donateurLocal.corps.id}/account`, {
    email: 'test.local@example.mg',
    password: 'motdepasse2026',
  });
  verifier('ouverture du compte donateur (201)', compte.statut === 201, `statut ${compte.statut}`);
  verifier('le compte ne renvoie aucun hash', compte.corps?.account?.passwordHash === undefined);

  const compteEnDouble = await appeler('POST', `/admin/donors/${donateurLocal.corps.id}/account`, {
    email: 'autre@example.mg',
    password: 'motdepasse2026',
  });
  verifier('refus d un second compte (422)', compteEnDouble.statut === 422, `statut ${compteEnDouble.statut}`);

  const motDePasseCourt = await appeler('POST', `/admin/donors/${donateurEtranger.corps.id}/account`, {
    email: 'test.intl@example.fr',
    password: '123',
  });
  verifier('refus d un mot de passe trop court (400)', motDePasseCourt.statut === 400, `statut ${motDePasseCourt.statut}`);

  console.log('\nDONS : affecte et non affecte');
  const donAffecte = await appeler('POST', '/admin/donations', {
    donorId: donateurLocal.corps.id,
    amount: '1000000',
    allocation: 'PROJECT',
    projectId: projet.id,
    frequency: 'ONE_TIME',
    paymentMethod: 'Mvola',
  });
  verifier('don affecte enregistre (201)', donAffecte.statut === 201, `statut ${donAffecte.statut}`);
  verifier('il pointe bien le projet', donAffecte.corps?.projectId === projet.id);

  const donSansProjet = await appeler('POST', '/admin/donations', {
    donorId: donateurLocal.corps.id,
    amount: '100000',
    allocation: 'PROJECT',
  });
  verifier('refus d un don affecte sans projet (400)', donSansProjet.statut === 400, `statut ${donSansProjet.statut}`);

  const moyenInterdit = await appeler('POST', '/admin/donations', {
    donorId: donateurLocal.corps.id,
    amount: '50000',
    allocation: 'HOPE',
    paymentMethod: 'PayPal',
  });
  verifier(
    'refus de PayPal pour un donateur local (422)',
    moyenInterdit.statut === 422,
    `statut ${moyenInterdit.statut}`
  );
  verifier(
    'le code est MOYEN_PAIEMENT_INDISPONIBLE',
    moyenInterdit.corps?.code === 'MOYEN_PAIEMENT_INDISPONIBLE',
    moyenInterdit.corps?.code
  );

  const donHope = await appeler('POST', '/admin/donations', {
    donorId: donateurEtranger.corps.id,
    amount: '6000000',
    allocation: 'HOPE',
    frequency: 'MONTHLY',
    paymentMethod: 'Virement international',
  });
  verifier('don non affecte enregistre (201)', donHope.statut === 201, `statut ${donHope.statut}`);
  verifier('il ne pointe aucun projet', donHope.corps?.projectId === null);

  const apresDon = await appeler('GET', `/admin/projects/${projet.id}`);
  verifier(
    'le don affecte finance directement le projet',
    apresDon.corps?.fundedTotal === '1000000.00',
    apresDon.corps?.fundedTotal
  );

  console.log('\nFONDS HOPE : etat et investissements');
  const fonds = await appeler('GET', '/admin/fund');
  verifier('GET /admin/fund repond 200', fonds.statut === 200);
  verifier(
    'les trois sommes sont exposees',
    fonds.corps?.summary?.designatedTotal !== undefined &&
      fonds.corps?.summary?.hopeTotal !== undefined &&
      fonds.corps?.summary?.grandTotal !== undefined
  );

  const disponibleAvant = Number(fonds.corps.summary.availableTotal);
  verifier('le fonds dispose de liquidites', disponibleAvant > 0, String(disponibleAvant));

  const investissementDemesure = await appeler('POST', '/admin/investments', {
    projectId: projet.id,
    amount: '99000000',
    justification: '[TEST] Montant volontairement demesure',
  });
  verifier(
    'refus d un investissement superieur au fonds (422)',
    investissementDemesure.statut === 422,
    `statut ${investissementDemesure.statut}`
  );
  verifier(
    'le code est FONDS_INSUFFISANT',
    investissementDemesure.corps?.code === 'FONDS_INSUFFISANT',
    investissementDemesure.corps?.code
  );

  const sansJustification = await appeler('POST', '/admin/investments', {
    projectId: projet.id,
    amount: '100000',
  });
  verifier(
    'refus d un investissement sans justification (400)',
    sansJustification.statut === 400,
    `statut ${sansJustification.statut}`
  );

  const investissement = await appeler('POST', '/admin/investments', {
    projectId: projet.id,
    amount: '1500000',
    justification: '[TEST] Complement de financement du transport scolaire',
  });
  verifier('investissement enregistre (201)', investissement.statut === 201, `statut ${investissement.statut}`);
  verifier(
    'une reference lisible est generee',
    /^INV-\d{4}-\d{4}$/.test(investissement.corps?.investment?.reference ?? ''),
    investissement.corps?.investment?.reference
  );

  const apresInvestissement = await appeler('GET', `/admin/projects/${projet.id}`);
  verifier(
    'le projet cumule don affecte et investissement',
    apresInvestissement.corps?.fundedTotal === '2500000.00',
    apresInvestissement.corps?.fundedTotal
  );
  verifier(
    'le besoin restant est recalcule',
    apresInvestissement.corps?.remainingNeed === '2500000.00',
    apresInvestissement.corps?.remainingNeed
  );

  const auDelaDuBesoin = await appeler('POST', '/admin/investments', {
    projectId: projet.id,
    amount: '2600000',
    justification: '[TEST] Au-dela du besoin',
  });
  verifier(
    'refus d un investissement superieur au besoin (422)',
    auDelaDuBesoin.statut === 422,
    `statut ${auDelaDuBesoin.statut}`
  );
  verifier(
    'le code est INVESTISSEMENT_SUPERIEUR_AU_BESOIN',
    auDelaDuBesoin.corps?.code === 'INVESTISSEMENT_SUPERIEUR_AU_BESOIN',
    auDelaDuBesoin.corps?.code
  );

  console.log('\nDEPENSES : plafonnees par les fonds reellement recus');
  const depense = await appeler('POST', '/admin/expenses', {
    projectId: projet.id,
    amount: '300000',
    description: '[TEST] Achat de fournitures scolaires',
    category: 'Fournitures',
    supplier: 'Librairie de test',
  });
  verifier('depense enregistree (201)', depense.statut === 201, `statut ${depense.statut}`);

  const depenseTropGrande = await appeler('POST', '/admin/expenses', {
    projectId: projet.id,
    amount: '9000000',
    description: '[TEST] Depense demesuree',
  });
  verifier(
    'refus d une depense superieure aux fonds recus (422)',
    depenseTropGrande.statut === 422,
    `statut ${depenseTropGrande.statut}`
  );
  verifier(
    'le code est FONDS_PROJET_INSUFFISANTS',
    depenseTropGrande.corps?.code === 'FONDS_PROJET_INSUFFISANTS',
    depenseTropGrande.corps?.code
  );
  verifier(
    'le disponible est indique dans le detail',
    depenseTropGrande.corps?.details?.availableTotal === '2200000.00',
    depenseTropGrande.corps?.details?.availableTotal
  );

  const depenseNegative = await appeler('POST', '/admin/expenses', {
    projectId: projet.id,
    amount: '-5000',
    description: '[TEST] Montant negatif',
  });
  verifier('refus d un montant negatif (400)', depenseNegative.statut === 400, `statut ${depenseNegative.statut}`);

  console.log('\nJUSTIFICATIF');
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
  const formulaire = new FormData();
  formulaire.append('file', new Blob([pdf], { type: 'application/pdf' }), 'facture_test.pdf');
  formulaire.append('documentType', 'INVOICE');
  formulaire.append('reference', 'FAC-TEST-001');

  const reponseUpload = await fetch(`${BASE}/admin/expenses/${depense.corps.id}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}` },
    body: formulaire,
  });
  const justificatif = await reponseUpload.json();
  verifier('televersement du justificatif (201)', reponseUpload.status === 201, `statut ${reponseUpload.status}`);
  verifier(
    'le nom sur le disque n est pas celui du client',
    typeof justificatif?.filePath === 'string' &&
      justificatif.filePath.startsWith('justificatif-') &&
      justificatif.filePath !== 'facture_test.pdf',
    justificatif?.filePath
  );

  const telechargement = await fetch(`${BASE}/admin/documents/${justificatif.id}/download`, {
    headers: { Authorization: `Bearer ${jeton}` },
  });
  verifier('telechargement du justificatif (200)', telechargement.status === 200, `statut ${telechargement.status}`);

  const formulaireInterdit = new FormData();
  formulaireInterdit.append(
    'file',
    new Blob([Buffer.from('#!/bin/sh\necho danger')], { type: 'application/x-sh' }),
    'script.sh'
  );
  const uploadInterdit = await fetch(`${BASE}/admin/expenses/${depense.corps.id}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}` },
    body: formulaireInterdit,
  });
  verifier('refus d un format interdit (400)', uploadInterdit.status === 400, `statut ${uploadInterdit.status}`);

  console.log('\nBENEFICIAIRES');
  const beneficiaire = await appeler('POST', '/admin/beneficiaries', {
    firstName: '[TEST]',
    lastName: 'Beneficiaire',
    beneficiaryType: 'ORPHAN',
    gender: 'F',
    birthDate: '2015-05-20',
    city: 'Antananarivo',
    projectId: projet.id,
  });
  verifier('creation et rattachement (201)', beneficiaire.statut === 201, `statut ${beneficiaire.statut}`);
  verifier("l'age est calcule", typeof beneficiaire.corps?.age === 'number', String(beneficiaire.corps?.age));

  const doublon = await appeler('POST', `/admin/projects/${projet.id}/beneficiaries`, {
    beneficiaryId: beneficiaire.corps.id,
  });
  verifier('refus d un rattachement en doublon (422)', doublon.statut === 422, `statut ${doublon.statut}`);

  console.log('\nNOTIFICATIONS');
  const notifications = await appeler('GET', '/admin/notifications');
  verifier('GET /admin/notifications repond 200', notifications.statut === 200);

  const notifsDuTest = (notifications.corps?.items ?? []).filter(
    (notification) => notification.donationId === donAffecte.corps.id
  );
  verifier('un don encaisse depose une notification', notifsDuTest.length === 1, `${notifsDuTest.length}`);
  verifier(
    'le libelle suit le format demande',
    /a fait un don (ponctuel|mensuel) de .+ pour /.test(notifsDuTest[0]?.label ?? ''),
    notifsDuTest[0]?.label
  );

  const notifInvestissement = (notifications.corps?.items ?? []).find(
    (notification) => notification.type === 'INVESTMENT' && notification.projectId === projet.id
  );
  verifier('un investissement depose une notification', Boolean(notifInvestissement));

  const badges = await appeler('GET', '/admin/badges');
  verifier(
    'les compteurs de pastilles sont exposes',
    typeof badges.corps?.notifications === 'number' && typeof badges.corps?.messages === 'number'
  );

  console.log('\nMESSAGES');
  const message = await appeler('POST', '/admin/messages', {
    donorAccountId: compte.corps.account.id,
    subject: '[TEST] Nouvelles du projet',
    body: 'Bonjour, pourriez-vous me donner des nouvelles ?',
  });
  verifier('message enregistre (201)', message.statut === 201, `statut ${message.statut}`);
  verifier('il arrive au statut NEW', message.corps?.status === 'NEW', message.corps?.status);

  const reponse = await appeler('PATCH', `/admin/messages/${message.corps.id}/reply`, {
    reply: '[TEST] Merci pour votre message, voici les nouvelles.',
  });
  verifier('reponse enregistree (200)', reponse.statut === 200, `statut ${reponse.statut}`);
  verifier('le message passe a ANSWERED', reponse.corps?.status === 'ANSWERED', reponse.corps?.status);

  const secondeReponse = await appeler('PATCH', `/admin/messages/${message.corps.id}/reply`, {
    reply: '[TEST] Seconde reponse sans confirmation',
  });
  verifier(
    'refus d une seconde reponse sans confirmation (422)',
    secondeReponse.statut === 422,
    `statut ${secondeReponse.statut}`
  );

  const reponseForcee = await appeler('PATCH', `/admin/messages/${message.corps.id}/reply`, {
    reply: '[TEST] Reponse corrigee',
    force: true,
  });
  verifier('la reponse peut etre remplacee explicitement', reponseForcee.statut === 200);

  console.log('\nCLOTURE DU PROJET ET IMPACT');
  const clotureSansResultat = await appeler('PATCH', `/admin/projects/${projet.id}/complete`, {});
  verifier(
    'refus de terminer sans resultat (400)',
    clotureSansResultat.statut === 400,
    `statut ${clotureSansResultat.statut}`
  );

  const cloture = await appeler('PATCH', `/admin/projects/${projet.id}/complete`, {
    outcome: '[TEST] 100 enfants ont pu faire leur rentree scolaire.',
  });
  verifier('cloture du projet (200)', cloture.statut === 200, `statut ${cloture.statut}`);
  verifier('le statut passe a COMPLETED', cloture.corps?.status === 'COMPLETED', cloture.corps?.status);
  verifier('completed_at est renseigne', Boolean(cloture.corps?.completedAt));

  const depenseApresCloture = await appeler('POST', '/admin/expenses', {
    projectId: projet.id,
    amount: '1000',
    description: '[TEST] Depense apres cloture',
  });
  verifier(
    'aucune depense sur un projet termine (422)',
    depenseApresCloture.statut === 422,
    `statut ${depenseApresCloture.statut}`
  );

  const donApresCloture = await appeler('POST', '/admin/donations', {
    donorId: donateurLocal.corps.id,
    amount: '10000',
    allocation: 'PROJECT',
    projectId: projet.id,
  });
  verifier(
    'aucun don affecte sur un projet termine (422)',
    donApresCloture.statut === 422,
    `statut ${donApresCloture.statut}`
  );

  const impact = await appeler('POST', '/admin/impacts', {
    projectId: projet.id,
    title: '[TEST] Enfants scolarises',
    indicator: 'children_enrolled',
    value: 100,
    unit: 'enfants',
  });
  verifier('un impact reste possible apres la cloture (201)', impact.statut === 201, `statut ${impact.statut}`);

  const termines = await appeler('GET', '/admin/projects/completed');
  verifier(
    'le projet apparait dans l ecran Impact',
    (termines.corps?.items ?? []).some((element) => element.id === projet.id)
  );

  console.log('\nARCHIVAGE ET SUPPRESSION');
  const suppressionInterdite = await appeler('DELETE', `/admin/projects/${projet.id}`);
  verifier(
    'un projet portant des ecritures ne peut pas etre supprime (422)',
    suppressionInterdite.statut === 422,
    `statut ${suppressionInterdite.statut}`
  );
  verifier(
    'le code est PROJET_AVEC_ECRITURES',
    suppressionInterdite.corps?.code === 'PROJET_AVEC_ECRITURES',
    suppressionInterdite.corps?.code
  );

  const projetVierge = await appeler('POST', '/admin/projects', {
    name: '[TEST] Projet vierge',
    requiredBudget: '100000',
  });
  const suppressionAutorisee = await appeler('DELETE', `/admin/projects/${projetVierge.corps.id}`);
  verifier(
    'un projet sans ecriture peut etre supprime (200)',
    suppressionAutorisee.statut === 200,
    `statut ${suppressionAutorisee.statut}`
  );

  const archivage = await appeler('PATCH', `/admin/projects/${projet.id}/archive`);
  verifier('archivage du projet termine (200)', archivage.statut === 200, `statut ${archivage.statut}`);
  verifier('le statut passe a ARCHIVED', archivage.corps?.status === 'ARCHIVED');

  const listeParDefaut = await appeler('GET', '/admin/projects');
  verifier(
    'les projets archives sont masques par defaut',
    !(listeParDefaut.corps?.items ?? []).some((element) => element.id === projet.id)
  );

  console.log('\nVUE COMPLETE ET STATISTIQUES');
  const apercu = await appeler('GET', `/admin/projects/${projet.id}/overview`);
  verifier('GET /projects/:id/overview (200)', apercu.statut === 200);
  verifier('onglet Financement : 1 don', apercu.corps?.donations?.length === 1);
  verifier('onglet Financement : 1 investissement', apercu.corps?.investments?.length === 1);
  verifier('onglet Depenses : 1 depense', apercu.corps?.expenses?.length === 1);
  verifier('onglet Justificatifs : 1 document', apercu.corps?.documents?.length === 1);
  verifier('onglet Beneficiaires : 1 personne', apercu.corps?.beneficiaries?.length === 1);
  verifier('onglet Impact : 1 mesure', apercu.corps?.impacts?.length === 1);
  verifier(
    'les ecritures survivent a l archivage',
    apercu.corps?.finance?.fundedTotal === '2500000.00',
    apercu.corps?.finance?.fundedTotal
  );

  const statistiques = await appeler('GET', '/admin/statistics');
  verifier('GET /admin/statistics (200)', statistiques.statut === 200);
  verifier('12 mois de serie mensuelle', statistiques.corps?.budget?.monthlySeries?.length === 12);
  verifier('repartition des donateurs presente', typeof statistiques.corps?.donors?.total === 'number');
  verifier('repartition par categorie presente', Array.isArray(statistiques.corps?.projects?.byCategory));

  await nettoyer();

  console.log(`\n[HOPE] Resultat : ${reussis} test(s) reussi(s), ${echoues} echec(s).\n`);
  process.exit(echoues === 0 ? 0 : 1);
}

async function nettoyer() {
  try {
    const projetsTest =
      "(SELECT id FROM projects WHERE name LIKE '[TEST]%' OR name LIKE '[UI]%')";
    const donateursTest =
      "(SELECT id FROM donors WHERE first_name LIKE '[TEST]%' OR first_name LIKE '[UI]%')";
    const comptesTest = `(SELECT id FROM donor_accounts WHERE donor_id IN ${donateursTest})`;

    await query(`DELETE FROM notifications WHERE project_id IN ${projetsTest}`);
    await query(`DELETE FROM notifications WHERE donor_id IN ${donateursTest}`);
    await query(`DELETE FROM messages WHERE donor_account_id IN ${comptesTest}`);
    await query(
      `DELETE FROM supporting_documents
        WHERE expense_id IN (SELECT id FROM expenses WHERE project_id IN ${projetsTest})`
    );
    await query(`DELETE FROM expenses WHERE project_id IN ${projetsTest}`);
    await query(`DELETE FROM investments WHERE project_id IN ${projetsTest}`);
    await query(
      "DELETE FROM notifications WHERE label LIKE '%[TEST]%' OR label LIKE '%[UI]%'"
    );
    await query(
      "DELETE FROM investments WHERE justification LIKE '[TEST]%' OR justification LIKE '[UI]%'"
    );
    await query(`DELETE FROM impacts WHERE project_id IN ${projetsTest}`);
    await query(`DELETE FROM project_beneficiaries WHERE project_id IN ${projetsTest}`);
    await query(
      "DELETE FROM beneficiaries WHERE first_name LIKE '[TEST]%' OR first_name LIKE '[UI]%'"
    );
    await query(`DELETE FROM donations WHERE project_id IN ${projetsTest}`);
    await query(`DELETE FROM donations WHERE donor_id IN ${donateursTest}`);
    await query("DELETE FROM projects WHERE name LIKE '[TEST]%' OR name LIKE '[UI]%'");
    await query(`DELETE FROM donor_accounts WHERE donor_id IN ${donateursTest}`);
    await query("DELETE FROM donors WHERE first_name LIKE '[TEST]%' OR first_name LIKE '[UI]%'");

    console.log('\n[HOPE] Donnees de test supprimees.');
  } catch (erreur) {
    console.log(`\n[HOPE] Nettoyage partiel : ${erreur.message}`);
  } finally {
    await fermerPool();
  }
}

executer().catch((erreur) => {
  console.error(
    `\n[HOPE] Tests interrompus : ${erreur.message}\n` +
      '       Verifiez que le backend tourne (npm run dev).\n'
  );
  console.error(erreur);
  process.exit(1);
});
