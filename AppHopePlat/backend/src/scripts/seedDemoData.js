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
 *        -> beneficiaires -> impacts mesures
 *
 * Les cinq projets restent en cours et leurs taux de financement vont de
 * 18 % a 100 %, de quoi remplir le flux de publications de l'accueil.
 *
 * Il passe par les services : les memes regles metier que l'API
 * s'appliquent, controles de solde compris.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fermerPool, query } from '../config/database.js';
import {
  DOSSIER_JUSTIFICATIFS,
  DOSSIER_MEDIAS,
  PREFIXE_MEDIAS,
} from '../middleware/upload.middleware.js';

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

  // Les fichiers poses par un seed precedent n'ont plus de ligne en base.
  for (const [dossier, prefixe] of [
    [DOSSIER_JUSTIFICATIFS, 'justificatif-'],
    [DOSSIER_MEDIAS, 'projet-'],
  ]) {
    try {
      const fichiers = await fs.readdir(dossier);
      await Promise.all(
        fichiers
          .filter((nom) => nom.startsWith(prefixe))
          .map((nom) => fs.unlink(path.join(dossier, nom)))
      );
    } catch (erreur) {
      if (erreur.code !== 'ENOENT') throw erreur;
    }
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

/** Dossier des visuels livres avec le script. */
const DOSSIER_MEDIAS_DEMO = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'medias-demo'
);

/** Nature du media deduite de son extension. */
const NATURES = new Map([
  ['.jpg', 'PHOTO'],
  ['.png', 'PHOTO'],
  ['.webp', 'PHOTO'],
  ['.mp4', 'VIDEO'],
  ['.webm', 'VIDEO'],
]);

/**
 * Copie un visuel de demonstration dans le dossier des medias et renvoie de
 * quoi illustrer un projet.
 *
 * On imite ce qu'aurait produit un televersement reel : le fichier recoit un
 * nom genere, jamais celui d'origine, et le projet ne garde qu'une adresse.
 *
 * @param {string} nomSource fichier present dans medias-demo/
 * @returns {Promise<{ mediaUrl: string, mediaType: 'PHOTO'|'VIDEO' }>}
 */
async function poserMedia(nomSource) {
  await fs.mkdir(DOSSIER_MEDIAS, { recursive: true });

  const extension = path.extname(nomSource).toLowerCase();
  const identifiant = crypto.randomBytes(16).toString('hex');
  const nomDisque = `projet-${Date.now()}-${identifiant}${extension}`;

  await fs.copyFile(
    path.join(DOSSIER_MEDIAS_DEMO, nomSource),
    path.join(DOSSIER_MEDIAS, nomDisque)
  );

  return {
    mediaUrl: `${PREFIXE_MEDIAS}/${nomDisque}`,
    mediaType: NATURES.get(extension) ?? 'PHOTO',
  };
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
    ...(await poserMedia('scolarite.jpg')),
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
    ...(await poserMedia('sante.jpg')),
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
    ...(await poserMedia('formation.jpg')),
  });

  // Ce projet reste volontairement sans visuel : l'accueil doit aussi
  // montrer l'invitation a en ajouter un.
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
    ...(await poserMedia('eau-potable.webm')),
  });

  // ---------------------------------------------------------------
  // 2. Donateurs : locaux et internationaux, avec et sans compte
  //
  // Quinze profils decrits en table plutot qu'un bloc par personne :
  // la liste se lit d'un coup d'oeil et reste simple a etendre.
  // L'origine se deduit du pays, et c'est elle qui commande les moyens
  // de paiement acceptes pour chaque don.
  // ---------------------------------------------------------------
  const PROFILS = [
    // --- Madagascar ---
    { cle: 'jean', firstName: 'Jean', lastName: 'Rakotoarisoa',
      email: 'jean.rakoto@example.mg', phone: '+261 34 12 345 67',
      country: 'Madagascar', city: 'Antananarivo' },
    { cle: 'miora', firstName: 'Miora', lastName: 'Randrianasolo',
      email: 'miora.r@example.mg', country: 'Madagascar', city: 'Toamasina' },
    { cle: 'hery', firstName: 'Hery', lastName: 'Andrianarison',
      email: 'hery.andria@example.mg', phone: '+261 32 45 678 90',
      country: 'Madagascar', city: 'Antsirabe' },
    { cle: 'lanto', firstName: 'Lanto', lastName: 'Rakotobe',
      email: 'lanto.rakotobe@example.mg', country: 'Madagascar', city: 'Fianarantsoa' },
    { cle: 'vero', firstName: 'Vero', lastName: 'Razanadrakoto',
      email: 'vero.raza@example.mg', country: 'Madagascar', city: 'Mahajanga' },
    { cle: 'rado', firstName: 'Rado', lastName: 'Raharimanana',
      email: 'rado.rahari@example.mg', country: 'Madagascar', city: 'Antananarivo' },
    { cle: 'noro', firstName: 'Noro', lastName: 'Rasoarimalala',
      email: 'noro.rasoa@example.mg', country: 'Madagascar', city: 'Toamasina' },
    { cle: 'tafita', organizationName: 'Entreprise Tafita Mada',
      email: 'don@tafitamada.example.mg', phone: '+261 20 22 123 45',
      country: 'Madagascar', city: 'Antananarivo' },
    { cle: 'anonyme', firstName: 'Donateur', lastName: 'anonyme',
      country: 'Madagascar', city: 'Antananarivo' },

    // --- Etranger ---
    { cle: 'fondation', organizationName: 'Fondation Solidarité Océan Indien',
      email: 'contact@fsoi.example', country: 'France', city: 'Paris' },
    { cle: 'sophie', firstName: 'Sophie', lastName: 'Bernard',
      email: 'sophie.bernard@example.fr', country: 'France', city: 'Lyon' },
    { cle: 'marc', firstName: 'Marc', lastName: 'Delaunay',
      email: 'marc.delaunay@example.fr', country: 'France', city: 'Nantes' },
    { cle: 'anna', firstName: 'Anna', lastName: 'Schmidt',
      email: 'anna.schmidt@example.de', country: 'Allemagne', city: 'Berlin' },
    { cle: 'luca', firstName: 'Luca', lastName: 'Moretti',
      email: 'luca.moretti@example.it', country: 'Italie', city: 'Milan' },
    { cle: 'diaspora', organizationName: 'Association Diaspora Malagasy',
      email: 'bureau@diaspora-mg.example', country: 'Canada', city: 'Montréal' },
  ];

  const donateurs = new Map();
  for (const { cle, ...profil } of PROFILS) {
    donateurs.set(cle, await donorService.creer(profil));
  }

  // Quatre donateurs reguliers ouvrent un compte : ce sont eux qui peuvent
  // ecrire a l'association depuis leur espace.
  const comptes = new Map();
  for (const cle of ['jean', 'sophie', 'marc', 'tafita']) {
    const donateur = donateurs.get(cle);
    const ouverture = await donorService.ouvrirCompte(donateur.id, {
      email: donateur.email,
      password: 'donateur2026',
    });
    comptes.set(cle, ouverture.account);
  }

  // ---------------------------------------------------------------
  // 3. Dons
  //
  // Un don affecte (projet renseigne) va directement au projet choisi.
  // Un don non affecte alimente le fonds HOPE, que l'administrateur
  // investit ensuite en justifiant son choix.
  //
  // Les taux de financement obtenus s'echelonnent de 18 % a 100 % :
  // l'accueil montre ainsi aussi bien un projet entierement couvert
  // qu'un projet qui manque encore de presque tout.
  // ---------------------------------------------------------------
  const DONS = [
    // --- Soutien scolaire : 3 800 000 sur 5 000 000 ---
    { donateur: 'jean', projet: scolaire, amount: '1000000', frequency: 'ONE_TIME',
      paymentMethod: 'Mvola', paymentReference: 'MVOLA-884213', receivedAt: jour(-40),
      message: 'Pour que ces enfants puissent aller à l’école.' },
    { donateur: 'hery', projet: scolaire, amount: '250000', frequency: 'ONE_TIME',
      paymentMethod: 'Mvola', receivedAt: jour(-35) },
    { donateur: 'marc', projet: scolaire, amount: '450000', frequency: 'MONTHLY',
      paymentMethod: 'Carte bancaire', paymentReference: 'CB-2026-3318', receivedAt: jour(-28) },
    { donateur: 'diaspora', projet: scolaire, amount: '900000', frequency: 'ONE_TIME',
      paymentMethod: 'Virement international', paymentReference: 'VIR-2026-0912',
      receivedAt: jour(-21), message: 'De la part des Malagasy de Montréal.' },

    // --- Sante pour tous : 4 160 000 sur 8 000 000 ---
    { donateur: 'noro', projet: sante, amount: '160000', frequency: 'ONE_TIME',
      paymentMethod: 'Orange Money', receivedAt: jour(-26) },
    { donateur: 'anna', projet: sante, amount: '700000', frequency: 'ONE_TIME',
      paymentMethod: 'PayPal', receivedAt: jour(-19) },
    { donateur: 'tafita', projet: sante, amount: '800000', frequency: 'ONE_TIME',
      paymentMethod: 'Virement bancaire local', paymentReference: 'VBL-2026-0077',
      receivedAt: jour(-11), message: 'Notre contribution annuelle à la santé publique.' },

    // --- Meres celibataires : 1 080 000 sur 6 000 000 ---
    { donateur: 'sophie', projet: meres, amount: '600000', frequency: 'MONTHLY',
      paymentMethod: 'Carte bancaire', paymentReference: 'CB-2026-7741', receivedAt: jour(-30) },
    { donateur: 'vero', projet: meres, amount: '180000', frequency: 'ONE_TIME',
      paymentMethod: 'Mvola', receivedAt: jour(-16) },
    { donateur: 'luca', projet: meres, amount: '300000', frequency: 'MONTHLY',
      paymentMethod: 'Carte bancaire', receivedAt: jour(-7) },

    // --- Cantines scolaires : 1 360 000 sur 4 000 000 ---
    { donateur: 'miora', projet: alimentation, amount: '400000', frequency: 'ONE_TIME',
      paymentMethod: 'Orange Money', receivedAt: jour(-12) },
    { donateur: 'lanto', projet: alimentation, amount: '160000', frequency: 'ONE_TIME',
      paymentMethod: 'Airtel Money', receivedAt: jour(-9) },

    // --- Puits : le budget est entierement couvert ---
    { donateur: 'jean', projet: puits, amount: '2000000', frequency: 'ONE_TIME',
      paymentMethod: 'Virement bancaire local', paymentReference: 'VBL-2025-0410',
      receivedAt: jour(-60) },

    // --- Fonds HOPE : dons laisses au libre emploi de l'association ---
    { donateur: 'fondation', amount: '4500000', frequency: 'ONE_TIME',
      paymentMethod: 'Virement international', paymentReference: 'VIR-2026-0451',
      receivedAt: jour(-25), message: 'Utilisez ce don là où le besoin est le plus urgent.' },
    { donateur: 'sophie', amount: '300000', frequency: 'MONTHLY',
      paymentMethod: 'PayPal', receivedAt: jour(-15) },
    { donateur: 'rado', amount: '350000', frequency: 'ONE_TIME',
      paymentMethod: 'Espèces', receivedAt: jour(-13) },
    { donateur: 'anonyme', amount: '250000', frequency: 'ONE_TIME',
      paymentMethod: 'Espèces', receivedAt: jour(-6) },
    { donateur: 'diaspora', amount: '1200000', frequency: 'ONE_TIME',
      paymentMethod: 'Virement international', receivedAt: jour(-5) },
    { donateur: 'anna', amount: '200000', frequency: 'MONTHLY',
      paymentMethod: 'PayPal', receivedAt: jour(-2) },
  ];

  for (const { donateur, projet, ...don } of DONS) {
    await donationService.creer({
      donorId: donateurs.get(donateur).id,
      ...(projet
        ? { allocation: 'PROJECT', projectId: projet.id }
        : { allocation: 'HOPE' }),
      ...don,
    });
  }


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
  // 8. Impacts mesures
  //
  // Les cinq projets restent en cours : l'accueil doit pouvoir montrer
  // cinq publications. Le puits, entierement finance, est le plus
  // avance et porte deja ses premiers releves.
  // ---------------------------------------------------------------
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
    donorAccountId: comptes.get('jean').id,
    subject: 'Nouvelles du soutien scolaire',
    body:
      'Bonjour,\n\nPourrais-je recevoir des nouvelles des enfants du projet de soutien scolaire ' +
      "que je finance ? J'aimerais savoir combien ont pu faire leur rentrée.\n\nMerci pour votre travail.",
  });

  await messageService.creer({
    donorAccountId: comptes.get('sophie').id,
    subject: 'Reçu fiscal 2026',
    body:
      'Bonjour,\n\nJe souhaiterais obtenir un reçu fiscal pour mes dons mensuels de cette année. ' +
      'Faut-il en faire la demande chaque année ?\n\nBien cordialement,\nSophie',
  });

  await messageService.creer({
    donorAccountId: comptes.get('marc').id,
    subject: 'Passer mon don mensuel à 600 000 Ar',
    body:
      'Bonjour,\n\nJe souhaite augmenter mon don mensuel pour le soutien scolaire, de 450 000 ' +
      'à 600 000 Ar à partir du mois prochain. Que dois-je faire de mon côté ?\n\nMarc',
  });

  await messageService.creer({
    donorAccountId: comptes.get('tafita').id,
    subject: 'Convention de mécénat 2027',
    body:
      'Bonjour,\n\nNotre direction souhaite formaliser un partenariat sur trois ans avec HOPE. ' +
      "Pourriez-vous nous indiquer si l'association peut établir une convention de mécénat, et " +
      'quels documents vous seraient nécessaires ?\n\nBien cordialement,\nEntreprise Tafita Mada',
  });

  return {
    projets: 5,
    donateurs: PROFILS.length,
    comptes: comptes.size,
    dons: DONS.length,
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
  console.log(`       ${resume.projets} projets en cours, ${resume.donateurs} donateurs`);
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
