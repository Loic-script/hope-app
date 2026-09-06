/**
 * Jeu de donnees de demonstration de l'espace administrateur.
 *
 *   npm run db:seed-demo             installe les donnees si la base est vide
 *   npm run db:seed-demo -- --force  efface les donnees metier et recommence
 *
 * Le script rejoue le parcours reel de l'argent chez HOPE :
 *
 *   donateurs (avec et sans compte, locaux et internationaux)
 *     -> dons affectes  -> directement sur un projet
 *     -> dons non affectes -> fonds HOPE -> investissements justifies
 *        -> depenses -> justificatifs
 *        -> beneficiaires -> projet termine -> impacts
 *
 * Il passe par les services : les memes regles metier que l'API
 * s'appliquent, controles de solde compris.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { fermerPool, query } from '../config/database.js';
import { DOSSIER_JUSTIFICATIFS } from '../middleware/upload.middleware.js';

import * as catalogService from '../services/catalog.service.js';
import * as projectService from '../services/project.service.js';
import * as donorService from '../services/donor.service.js';
import * as donationService from '../services/donation.service.js';
import * as fundService from '../services/fund.service.js';
import * as expenseService from '../services/expense.service.js';
import * as documentService from '../services/document.service.js';
import * as beneficiaryService from '../services/beneficiary.service.js';
import * as impactService from '../services/impact.service.js';
import * as messageService from '../services/message.service.js';

const FORCER = process.argv.includes('--force');

/** Date au format AAAA-MM-JJ, decalee de n jours. */
function jour(decalage = 0) {
  const date = new Date();
  date.setDate(date.getDate() + decalage);
  return date.toISOString().slice(0, 10);
}

/** Tables metier videes par --force, dans l'ordre des dependances. */
const TABLES_METIER = [
  'notifications',
  'messages',
  'supporting_documents',
  'expenses',
  'investments',
  'impacts',
  'project_beneficiaries',
  'beneficiaries',
  'donations',
  'donor_accounts',
  'donors',
  'projects',
];

async function viderDonneesMetier() {
  console.log('[HOPE] --force : suppression des donnees de demonstration existantes...');
  await query(`TRUNCATE ${TABLES_METIER.join(', ')} RESTART IDENTITY CASCADE`);

  try {
    const fichiers = await fs.readdir(DOSSIER_JUSTIFICATIFS);
    await Promise.all(
      fichiers
        .filter((nom) => nom.startsWith('justificatif-'))
        .map((nom) => fs.unlink(path.join(DOSSIER_JUSTIFICATIFS, nom)))
    );
  } catch (erreur) {
    if (erreur.code !== 'ENOENT') throw erreur;
  }
}

/** PDF minimal mais valide, pour que le telechargement soit testable. */
function construirePdfDemo(titre) {
  const contenu = `BT /F1 16 Tf 60 760 Td (${titre}) Tj ET`;
  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R ' +
      '/Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${contenu.length} >>\nstream\n${contenu}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const positions = [];
  objets.forEach((objet, index) => {
    positions.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${objet}\nendobj\n`;
  });

  const debutXref = pdf.length;
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  for (const position of positions) {
    pdf += `${String(position).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

/** Ecrit le PDF puis enregistre le justificatif correspondant. */
async function ajouterJustificatif(expenseId, { titre, nomAffiche, type, reference }) {
  await fs.mkdir(DOSSIER_JUSTIFICATIFS, { recursive: true });

  const nomDisque = `justificatif-${Date.now()}-${Math.random().toString(16).slice(2, 12)}.pdf`;
  const contenu = construirePdfDemo(titre);
  await fs.writeFile(path.join(DOSSIER_JUSTIFICATIFS, nomDisque), contenu);

  // On imite ce que multer aurait produit apres un televersement reel.
  return documentService.creer(
    expenseId,
    {
      filename: nomDisque,
      originalname: nomAffiche,
      mimetype: 'application/pdf',
      size: contenu.length,
      path: path.join(DOSSIER_JUSTIFICATIFS, nomDisque),
    },
    { documentType: type, reference, fileName: nomAffiche, issuedAt: jour(-10) }
  );
}

async function installerDonneesDemo(categoriesParNom) {
  const categorie = (nom) => categoriesParNom.get(nom).id;

  // ---------------------------------------------------------------
  // 1. Projets
  // ---------------------------------------------------------------
  const scolaire = await projectService.creer({
    name: 'Soutien scolaire Antananarivo',
    description:
      "Prise en charge des frais de scolarité, des fournitures et du transport pour 100 enfants orphelins d'Antananarivo, sur toute l'année scolaire.",
    categoryId: categorie('Scolarité'),
    location: 'Antananarivo',
    managerName: 'Hanta Rasoanaivo',
    startDate: jour(-120),
    requiredBudget: '5000000',
    beneficiaryProfile: 'Enfants orphelins de 6 à 14 ans',
    beneficiaryTarget: 100,
  });

  const sante = await projectService.creer({
    name: 'Santé pour tous',
    description:
      'Consultations médicales gratuites et distribution de médicaments essentiels dans la région de Toamasina.',
    categoryId: categorie('Soins'),
    location: 'Toamasina',
    managerName: 'Dr Naina Andriamahefa',
    startDate: jour(-90),
    requiredBudget: '8000000',
    beneficiaryProfile: 'Familles vulnérables du littoral est',
    beneficiaryTarget: 350,
  });

  const meres = await projectService.creer({
    name: 'Autonomisation des mères célibataires',
    description:
      "Formation à la couture et à la gestion de micro-activités, suivie d'un accompagnement à l'installation.",
    categoryId: categorie('Formation professionnelle'),
    location: 'Antsirabe',
    managerName: 'Voahangy Ratsimba',
    startDate: jour(-60),
    requiredBudget: '6000000',
    beneficiaryProfile: 'Mères célibataires sans revenu stable',
    beneficiaryTarget: 25,
  });

  const alimentation = await projectService.creer({
    name: 'Cantines scolaires de Fianarantsoa',
    description: 'Un repas chaud par jour et jardins potagers communautaires dans quatre écoles.',
    categoryId: categorie('Alimentation'),
    location: 'Fianarantsoa',
    managerName: 'Tiana Rakotomalala',
    startDate: jour(-40),
    requiredBudget: '4000000',
    beneficiaryProfile: 'Élèves des écoles primaires publiques',
    beneficiaryTarget: 200,
  });

  const puits = await projectService.creer({
    name: "Puits d'eau potable Mahajanga",
    description: "Forage et mise en service d'un puits pour le quartier d'Amborovy.",
    categoryId: categorie('Urgence'),
    location: 'Mahajanga',
    managerName: 'Fara Andrianina',
    startDate: jour(-200),
    requiredBudget: '2000000',
    beneficiaryProfile: 'Habitants du quartier Amborovy',
    beneficiaryTarget: 400,
  });

  // ---------------------------------------------------------------
  // 2. Donateurs : locaux, internationaux, avec et sans compte
  // ---------------------------------------------------------------
  const jean = await donorService.creer({
    firstName: 'Jean',
    lastName: 'Rakotoarisoa',
    email: 'jean.rakoto@example.mg',
    phone: '+261 34 12 345 67',
    country: 'Madagascar',
    city: 'Antananarivo',
  });

  const fondation = await donorService.creer({
    organizationName: 'Fondation Solidarité Océan Indien',
    email: 'contact@fsoi.example',
    country: 'France',
    city: 'Paris',
  });

  const miora = await donorService.creer({
    firstName: 'Miora',
    lastName: 'Randrianasolo',
    email: 'miora.r@example.mg',
    country: 'Madagascar',
    city: 'Toamasina',
  });

  const sophie = await donorService.creer({
    firstName: 'Sophie',
    lastName: 'Bernard',
    email: 'sophie.bernard@example.fr',
    country: 'France',
    city: 'Lyon',
  });

  const anonyme = await donorService.creer({
    firstName: 'Donateur',
    lastName: 'anonyme',
    country: 'Madagascar',
    city: 'Antananarivo',
  });

  // Deux donateurs reguliers ouvrent un compte.
  const compteJean = await donorService.ouvrirCompte(jean.id, {
    email: 'jean.rakoto@example.mg',
    password: 'donateur2026',
  });
  const compteSophie = await donorService.ouvrirCompte(sophie.id, {
    email: 'sophie.bernard@example.fr',
    password: 'donateur2026',
  });

  // ---------------------------------------------------------------
  // 3. Dons affectes : ils vont directement au projet choisi
  // ---------------------------------------------------------------
  await donationService.creer({
    donorId: jean.id,
    amount: '1000000',
    allocation: 'PROJECT',
    projectId: scolaire.id,
    frequency: 'ONE_TIME',
    paymentMethod: 'Mvola',
    paymentReference: 'MVOLA-884213',
    receivedAt: jour(-40),
    message: 'Pour que ces enfants puissent aller à l’école.',
  });

  await donationService.creer({
    donorId: sophie.id,
    amount: '600000',
    allocation: 'PROJECT',
    projectId: meres.id,
    frequency: 'MONTHLY',
    paymentMethod: 'Carte bancaire',
    paymentReference: 'CB-2026-7741',
    receivedAt: jour(-30),
  });

  await donationService.creer({
    donorId: miora.id,
    amount: '400000',
    allocation: 'PROJECT',
    projectId: alimentation.id,
    frequency: 'ONE_TIME',
    paymentMethod: 'Orange Money',
    receivedAt: jour(-12),
  });

  await donationService.creer({
    donorId: jean.id,
    amount: '2000000',
    allocation: 'PROJECT',
    projectId: puits.id,
    frequency: 'ONE_TIME',
    paymentMethod: 'Virement bancaire local',
    receivedAt: jour(-180),
  });

  // ---------------------------------------------------------------
  // 4. Dons non affectes : ils alimentent le fonds HOPE
  // ---------------------------------------------------------------
  await donationService.creer({
    donorId: fondation.id,
    amount: '4500000',
    allocation: 'HOPE',
    frequency: 'ONE_TIME',
    paymentMethod: 'Virement international',
    paymentReference: 'VIR-2026-0451',
    receivedAt: jour(-25),
    message: 'Utilisez ce don là où le besoin est le plus urgent.',
  });

  await donationService.creer({
    donorId: sophie.id,
    amount: '300000',
    allocation: 'HOPE',
    frequency: 'MONTHLY',
    paymentMethod: 'PayPal',
    receivedAt: jour(-15),
  });

  await donationService.creer({
    donorId: anonyme.id,
    amount: '250000',
    allocation: 'HOPE',
    frequency: 'ONE_TIME',
    paymentMethod: 'Espèces',
    receivedAt: jour(-6),
  });

  // ---------------------------------------------------------------
  // 5. Investissements du fonds HOPE
  // ---------------------------------------------------------------
  await fundService.investir({
    projectId: sante.id,
    amount: '2500000',
    justification:
      'Achat des médicaments essentiels de la campagne de consultations. Aucun don affecté ne couvre ce projet à ce jour.',
    investedAt: jour(-20),
  });

  await fundService.investir({
    projectId: scolaire.id,
    amount: '1200000',
    justification:
      'Complément pour couvrir le transport scolaire, non financé par les dons affectés reçus.',
    investedAt: jour(-18),
  });

  await fundService.investir({
    projectId: alimentation.id,
    amount: '800000',
    justification: 'Démarrage des jardins potagers avant la saison des pluies.',
    investedAt: jour(-10),
  });
  // Il reste volontairement du disponible dans le fonds HOPE.

  // ---------------------------------------------------------------
  // 6. Depenses et justificatifs
  // ---------------------------------------------------------------
  const fournitures = await expenseService.creer({
    projectId: scolaire.id,
    amount: '300000',
    description: 'Achat de fournitures scolaires pour 25 enfants',
    category: 'Fournitures',
    supplier: 'Librairie Ambatonakanga',
    expenseDate: jour(-15),
  });
  await ajouterJustificatif(fournitures.id, {
    titre: 'HOPE - Facture fournitures scolaires',
    nomAffiche: 'facture_fournitures.pdf',
    type: 'INVOICE',
    reference: 'FAC-2026-118',
  });

  const ecolages = await expenseService.creer({
    projectId: scolaire.id,
    amount: '750000',
    description: 'Écolages du premier trimestre',
    category: 'Formation',
    supplier: 'EPP Andohalo',
    expenseDate: jour(-10),
  });
  await ajouterJustificatif(ecolages.id, {
    titre: 'HOPE - Recu ecolages premier trimestre',
    nomAffiche: 'recu_ecolages_T1.pdf',
    type: 'RECEIPT',
    reference: 'REC-2026-042',
  });

  const medicaments = await expenseService.creer({
    projectId: sante.id,
    amount: '1200000',
    description: 'Commande de médicaments essentiels',
    category: 'Santé',
    supplier: 'Pharmacie Centrale de Toamasina',
    expenseDate: jour(-6),
  });
  await ajouterJustificatif(medicaments.id, {
    titre: 'HOPE - Facture medicaments',
    nomAffiche: 'facture_medicaments.pdf',
    type: 'INVOICE',
    reference: 'BC-2026-77',
  });

  await expenseService.creer({
    projectId: alimentation.id,
    amount: '350000',
    description: 'Semences et outillage pour les jardins potagers',
    category: 'Matériel',
    supplier: 'Coopérative Vatovavy',
    expenseDate: jour(-4),
  });

  // Le projet du puits est mene a son terme.
  const forage = await expenseService.creer({
    projectId: puits.id,
    amount: '1600000',
    description: 'Forage du puits et pose de la pompe manuelle',
    category: 'Matériel',
    supplier: 'Entreprise Hydro Boeny',
    expenseDate: jour(-120),
  });
  await ajouterJustificatif(forage.id, {
    titre: 'HOPE - Facture forage du puits',
    nomAffiche: 'facture_forage_puits.pdf',
    type: 'INVOICE',
    reference: 'HB-2026-009',
  });

  await expenseService.creer({
    projectId: puits.id,
    amount: '250000',
    description: "Analyse de potabilité de l'eau et formation du comité de gestion",
    category: 'Formation',
    supplier: 'Laboratoire régional Mahajanga',
    expenseDate: jour(-100),
  });

  // ---------------------------------------------------------------
  // 7. Beneficiaires
  // ---------------------------------------------------------------
  const beneficiaires = [
    { firstName: 'Soa', lastName: 'Rabe', beneficiaryType: 'ORPHAN', gender: 'F', birthDate: '2015-04-12', city: 'Antananarivo', projet: scolaire.id },
    { firstName: 'Tojo', lastName: 'Randria', beneficiaryType: 'ORPHAN', gender: 'M', birthDate: '2014-09-03', city: 'Antananarivo', projet: scolaire.id },
    { firstName: 'Fanja', lastName: 'Raso', beneficiaryType: 'ORPHAN', gender: 'F', birthDate: '2016-01-25', city: 'Antananarivo', projet: scolaire.id },
    { firstName: 'Naina', lastName: 'Rakoto', beneficiaryType: 'ORPHAN', gender: 'M', birthDate: '2013-11-08', city: 'Antananarivo', projet: scolaire.id },
    { firstName: 'Vola', lastName: 'Ramanana', beneficiaryType: 'SINGLE_MOTHER', gender: 'F', birthDate: '1994-06-17', city: 'Antsirabe', projet: meres.id },
    { firstName: 'Hanta', lastName: 'Razafy', beneficiaryType: 'SINGLE_MOTHER', gender: 'F', birthDate: '1990-02-28', city: 'Antsirabe', projet: meres.id },
    { firstName: 'Lalao', lastName: 'Andry', beneficiaryType: 'SINGLE_MOTHER', gender: 'F', birthDate: '1997-08-05', city: 'Antsirabe', projet: meres.id },
    { firstName: 'Famille', lastName: 'Rasoamalala', beneficiaryType: 'FAMILY', city: 'Toamasina', projet: sante.id },
    { firstName: 'Famille', lastName: 'Andrianjafy', beneficiaryType: 'FAMILY', city: 'Toamasina', projet: sante.id },
    { firstName: 'Zo', lastName: 'Rafalimanana', beneficiaryType: 'ORPHAN', gender: 'M', birthDate: '2012-03-19', city: 'Fianarantsoa', projet: alimentation.id },
    { firstName: 'Famille', lastName: 'Ravelonarivo', beneficiaryType: 'FAMILY', city: 'Mahajanga', projet: puits.id },
    { firstName: 'Famille', lastName: 'Bemananjara', beneficiaryType: 'FAMILY', city: 'Mahajanga', projet: puits.id },
  ];

  for (const { projet, ...donnees } of beneficiaires) {
    await beneficiaryService.creer({ ...donnees, projectId: projet, country: 'Madagascar' });
  }

  // ---------------------------------------------------------------
  // 8. Cloture du projet du puits et mesure de son impact
  // ---------------------------------------------------------------
  await projectService.terminer(puits.id, {
    outcome:
      "Le puits d'Amborovy a été mis en service le mois dernier. 400 habitants disposent désormais " +
      "d'un accès permanent à l'eau potable à moins de 300 mètres de leur domicile. Un comité de " +
      "gestion de six personnes a été formé pour l'entretien courant.",
  });

  await impactService.creer({
    projectId: puits.id,
    title: "Habitants desservis en eau potable",
    description: 'Relevé effectué avec le comité de quartier après la mise en service.',
    indicator: 'people_with_water_access',
    value: 400,
    unit: 'personnes',
    measuredAt: jour(-30),
  });

  await impactService.creer({
    projectId: puits.id,
    title: 'Comité de gestion formé',
    indicator: 'people_trained',
    value: 6,
    unit: 'personnes',
    measuredAt: jour(-28),
  });

  // Impacts intermediaires sur les projets en cours.
  await impactService.creer({
    projectId: scolaire.id,
    title: 'Enfants ayant reçu un kit scolaire complet',
    indicator: 'kits_distributed',
    value: 25,
    unit: 'kits',
    measuredAt: jour(-14),
  });

  await impactService.creer({
    projectId: sante.id,
    title: 'Consultations médicales gratuites réalisées',
    indicator: 'medical_consultations',
    value: 340,
    unit: 'consultations',
    measuredAt: jour(-3),
  });

  // ---------------------------------------------------------------
  // 9. Messages des donateurs disposant d'un compte
  // ---------------------------------------------------------------
  await messageService.creer({
    donorAccountId: compteJean.account.id,
    subject: 'Nouvelles du soutien scolaire',
    body:
      'Bonjour,\n\nPourrais-je recevoir des nouvelles des enfants du projet de soutien scolaire ' +
      "que je finance ? J'aimerais savoir combien ont pu faire leur rentrée.\n\nMerci pour votre travail.",
  });

  await messageService.creer({
    donorAccountId: compteSophie.account.id,
    subject: 'Reçu fiscal 2026',
    body:
      'Bonjour,\n\nJe souhaiterais obtenir un reçu fiscal pour mes dons mensuels de cette année. ' +
      'Faut-il en faire la demande chaque année ?\n\nBien cordialement,\nSophie',
  });

  return {
    projets: 5,
    donateurs: 5,
    comptes: 2,
    dons: 7,
    investissements: 3,
    depenses: 6,
    beneficiaires: beneficiaires.length,
  };
}

async function executer() {
  console.log('[HOPE] Installation des donnees de reference...');
  const categories = await catalogService.installerCategoriesParDefaut();
  console.log(`[HOPE] ${categories.length} categories de projet disponibles.`);

  if (FORCER) await viderDonneesMetier();

  const existants = await query('SELECT COUNT(*)::int AS total FROM projects');
  if (existants.rows[0].total > 0) {
    console.log(
      `[HOPE] ${existants.rows[0].total} projet(s) deja en base : donnees de demonstration ignorees.`
    );
    console.log('[HOPE] Utilisez "npm run db:seed-demo -- --force" pour les reinitialiser.');
    return;
  }

  const categoriesParNom = new Map(
    (await catalogService.listerCategories()).map((categorie) => [categorie.name, categorie])
  );

  const resume = await installerDonneesDemo(categoriesParNom);

  console.log('[HOPE] Donnees de demonstration installees :');
  console.log(`       ${resume.projets} projets (dont 1 termine), ${resume.donateurs} donateurs`);
  console.log(`       dont ${resume.comptes} avec un compte, ${resume.dons} dons,`);
  console.log(`       ${resume.investissements} investissements du fonds HOPE,`);
  console.log(`       ${resume.depenses} depenses, ${resume.beneficiaires} beneficiaires,`);
  console.log('       justificatifs, impacts et messages.');
}

executer()
  .catch((erreur) => {
    console.error('[HOPE] Echec du seed de demonstration :', erreur.message);
    if (erreur.details) console.error('       details :', erreur.details);
    process.exitCode = 1;
  })
  .finally(() => fermerPool());
