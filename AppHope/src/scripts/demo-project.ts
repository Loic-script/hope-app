import {
  AllocationType,
  BeneficiaryType,
  BudgetStatus,
  DocumentType,
  DonationStatus,
  DonationType,
  DonorType,
  Gender,
  ProjectStatus,
} from '@prisma/client';
import { createContainer } from '../container.js';
import { disconnectPrisma } from '../database/prisma.js';
import { AppError } from '../shared/errors.js';
import { formatMoney } from '../shared/money.js';
import { isMainModule, line, note, runScript, step, title } from '../shared/run-script.js';

/**
 * DEMONSTRATION : cycle complet d'un projet.
 *
 *   npm run demo:project
 *
 * Ce scenario couvre tout ce qui vient APRES l'encaissement d'un don :
 *   1. un donateur international (France, EUR) fait un don par carte ;
 *   2. le don est reparti sur PLUSIEURS projets ;
 *   3. un budget avec ses lignes est cree ;
 *   4. une depense est enregistree, validee, payee ;
 *   5. un justificatif est rattache a la depense ;
 *   6. une depense trop elevee est REFUSEE (budget puis tresorerie) ;
 *   7. des beneficiaires sont inscrits au projet ;
 *   8. un impact mesurable est enregistre ;
 *   9. un remboursement est tente puis refuse car les fonds sont engages.
 */

const CURRENCY = 'EUR';
const DONATION_AMOUNT = '1000';

export async function runProjectDemo(): Promise<void> {
  const { services } = createContainer();
  const {
    donorService,
    donationService,
    paymentService,
    allocationService,
    projectService,
    budgetService,
    expenseService,
    documentService,
    beneficiaryService,
    impactService,
  } = services;

  title('Demo HOPE - projets, budgets, depenses, beneficiaires et impact');

  // -- 1. Donateur international --------------------------------------------
  step(1, 'Donateur international (France) et don de 1 000 EUR par carte');
  const donor = await donorService.createDonor({
    firstName: 'Claire',
    lastName: 'Moreau',
    email: `claire.demo.${Date.now()}@example.fr`,
    phone: '+33 6 12 34 56 78',
    donorType: DonorType.INDIVIDUAL,
    country: 'FR',
    preferredCurrency: CURRENCY,
    city: 'Lyon',
    preferredLanguage: 'fr',
    timezone: 'Europe/Paris',
  });

  const profile = await donorService.getDonorProfile(donor.id);
  line('Donateur', profile.displayName);
  line('Type de donateur', donor.donorType);
  line('Pays', donor.country);
  line('International ?', profile.isInternational ? 'oui' : 'non');
  note('Le type reste INDIVIDUAL : c’est le pays qui rend le donateur international.');

  const availableMethods = await paymentService.listPaymentMethodsForCountry(donor.country);
  line('Methodes disponibles', availableMethods.map((method) => method.code).join(', '));

  const donation = await donationService.createDonation({
    donorId: donor.id,
    donationType: DonationType.ONE_TIME,
    currency: CURRENCY,
    expectedAmount: DONATION_AMOUNT,
    status: DonationStatus.ACTIVE,
    notes: 'Don non affecte : HOPE decide de la repartition.',
  });

  const transaction = await paymentService.createTransaction({
    donationId: donation.id,
    paymentMethodCode: 'CARD',
  });
  await paymentService.confirmTransaction(transaction.id);
  line('Don', donation.reference);
  line('Encaisse', formatMoney(DONATION_AMOUNT, CURRENCY));

  // -- 2. Repartition sur plusieurs projets ---------------------------------
  step(2, 'Repartition du don sur TROIS projets');
  const projects = await ensureThreeProjects(projectService);

  const allocations = await allocationService.allocateMany({
    donationId: donation.id,
    defaultAllocationType: AllocationType.HOPE_ALLOCATED,
    splits: [
      { projectId: projects[0].id, amount: '400', notes: 'Volet scolarite.' },
      { projectId: projects[1].id, amount: '300', notes: 'Volet sante.' },
      { projectId: projects[2].id, amount: '300', notes: 'Volet alimentation.' },
    ],
  });

  for (const [index, allocation] of allocations.entries()) {
    const project = projects[index];
    line(project?.name ?? 'Projet', formatMoney(allocation.amount, allocation.currency));
  }

  const allocationSummary = await allocationService.getDonationAllocationSummary(donation.id);
  line('Total affecte', formatMoney(allocationSummary.totalAllocated, CURRENCY));
  line('Reste non affecte', formatMoney(allocationSummary.unallocatedAmount, CURRENCY));
  note('Les trois affectations ont ete ecrites dans UNE SEULE transaction PostgreSQL.');

  // -- 3. Budget ------------------------------------------------------------
  const mainProject = projects[0];
  step(3, `Budget du projet "${mainProject.name}"`);

  const budget = await budgetService.createBudget({
    projectId: mainProject.id,
    name: 'Budget scolarite - demonstration',
    totalAmount: '500',
    currency: CURRENCY,
    status: BudgetStatus.ACTIVE,
  });

  const schoolFees = await budgetService.addBudgetItem({
    budgetId: budget.id,
    name: 'Frais scolaires',
    plannedAmount: '300',
  });
  await budgetService.addBudgetItem({
    budgetId: budget.id,
    name: 'Materiel scolaire',
    plannedAmount: '150',
  });
  await budgetService.addBudgetItem({
    budgetId: budget.id,
    name: 'Transport',
    plannedAmount: '50',
  });

  const budgetSummary = await budgetService.getBudgetSummary(budget.id);
  line('Enveloppe du budget', formatMoney(budgetSummary.totalAmount, CURRENCY));
  line('Total des lignes', formatMoney(budgetSummary.totalPlanned, CURRENCY));
  line('Non reparti en lignes', formatMoney(budgetSummary.unplannedAmount, CURRENCY));
  note('Le budget est une PREVISION (500 EUR), la tresorerie du projet est du CASH (400 EUR).');

  step(4, 'Garde-fou : la somme des lignes ne peut pas depasser l’enveloppe');
  await expectRefusal(() =>
    budgetService.addBudgetItem({
      budgetId: budget.id,
      name: 'Ligne excedentaire',
      plannedAmount: '200',
    }),
  );

  // -- 4. Depenses ----------------------------------------------------------
  step(5, 'Enregistrement, validation et paiement d’une depense');
  const expense = await expenseService.createExpense({
    projectId: mainProject.id,
    budgetId: budget.id,
    budgetItemId: schoolFees.id,
    amount: '250',
    currency: CURRENCY,
    description: 'Ecolages du premier trimestre pour 10 eleves.',
    expenseDate: new Date(),
  });
  line('Depense', expense.reference);
  line('Montant', formatMoney(expense.amount, expense.currency));
  line('Statut', expense.status);
  note('Une depense DRAFT ne consomme pas encore les fonds.');

  const validated = await expenseService.validateExpense(expense.id);
  line('Apres validation', validated.status);

  const paid = await expenseService.markExpensePaid(expense.id);
  line('Apres paiement', paid.status);

  const spendingReport = await expenseService.getProjectSpendingReport(mainProject.id, CURRENCY);
  line('Depense (engage)', formatMoney(spendingReport.totalSpent, CURRENCY));
  line('Fonds restants du projet', formatMoney(spendingReport.availableFunds, CURRENCY));

  // -- 5. Justificatif ------------------------------------------------------
  step(6, 'Rattachement d’un justificatif (metadonnees uniquement)');
  const document = await documentService.attachDocument({
    expenseId: expense.id,
    documentType: DocumentType.INVOICE,
    fileName: 'facture-ecolages-T1.pdf',
    filePath: 'storage/justificatifs/2026/facture-ecolages-T1.pdf',
    mimeType: 'application/pdf',
    fileSize: 184_320,
    reference: 'FAC-2026-0142',
    issuedAt: new Date(),
  });
  line('Justificatif', document.fileName);
  line('Type', document.documentType);
  line('Reference', document.reference ?? '-');
  note('Aucun fichier n’est transfere : le backend enregistre seulement les metadonnees.');

  // -- 6. Depenses refusees -------------------------------------------------
  step(7, 'Garde-fou : depense superieure au budget restant');
  await expectRefusal(() =>
    expenseService.createExpense({
      projectId: mainProject.id,
      budgetId: budget.id,
      amount: '400',
      currency: CURRENCY,
      description: 'Depense volontairement trop elevee pour le budget.',
      expenseDate: new Date(),
    }),
  );

  step(8, 'Garde-fou : depense superieure aux fonds reellement recus');
  await expectRefusal(() =>
    expenseService.createExpense({
      projectId: mainProject.id,
      amount: '300',
      currency: CURRENCY,
      description: 'Depense hors budget mais superieure a la tresorerie du projet.',
      expenseDate: new Date(),
    }),
  );
  note('Le projet a recu 400 EUR et en a deja depense 250 : il ne reste que 150 EUR.');

  // -- 7. Beneficiaires -----------------------------------------------------
  step(9, 'Inscription de beneficiaires au projet (relation N-N)');
  const orphan = await beneficiaryService.createBeneficiary({
    beneficiaryType: BeneficiaryType.ORPHAN,
    country: 'MG',
    firstName: 'Soa',
    lastName: 'R.',
    gender: Gender.FEMALE,
    birthDate: '2015-04-22',
    city: 'Antananarivo',
  });

  const singleMother = await beneficiaryService.createBeneficiary({
    beneficiaryType: BeneficiaryType.SINGLE_MOTHER,
    country: 'MG',
    firstName: 'Noro',
    lastName: 'A.',
    gender: Gender.FEMALE,
    birthDate: '1994-11-03',
    city: 'Antananarivo',
  });

  await beneficiaryService.enrollInProject({
    projectId: mainProject.id,
    beneficiaryId: orphan.id,
  });
  await beneficiaryService.enrollInProject({
    projectId: mainProject.id,
    beneficiaryId: singleMother.id,
  });
  // Le meme beneficiaire participe aussi a un second projet.
  await beneficiaryService.enrollInProject({
    projectId: projects[1].id,
    beneficiaryId: singleMother.id,
  });

  const orphanProfile = await beneficiaryService.getBeneficiaryProfile(orphan.id);
  const motherProfile = await beneficiaryService.getBeneficiaryProfile(singleMother.id);
  line('Beneficiaire 1', `${orphan.reference} (${orphan.beneficiaryType}, ${orphanProfile.age} ans)`);
  line('Beneficiaire 2', `${singleMother.reference} (${singleMother.beneficiaryType}, ${motherProfile.age} ans)`);
  line('Projets du beneficiaire 2', motherProfile.enrollments.length);
  note('Un beneficiaire peut suivre plusieurs projets, et inversement.');

  // -- 8. Impact ------------------------------------------------------------
  step(10, 'Enregistrement de l’impact mesure');
  await impactService.recordImpact({
    projectId: mainProject.id,
    title: 'Eleves scolarises au premier trimestre',
    description: 'Dix eleves ont pu reprendre l’ecole grace au paiement des ecolages.',
    indicator: 'children_schooled',
    value: 10,
    unit: 'persons',
    measuredAt: new Date(),
  });
  await impactService.recordImpact({
    projectId: mainProject.id,
    title: 'Eleves scolarises au second trimestre',
    description: 'Huit eleves supplementaires ont rejoint le programme.',
    indicator: 'children_schooled',
    value: 8,
    unit: 'persons',
    measuredAt: new Date(),
  });

  const impactReport = await impactService.getProjectImpactReport(mainProject.id);
  for (const indicator of impactReport.indicators) {
    line(
      `Indicateur ${indicator.indicator}`,
      `${indicator.total.toString()} ${indicator.unit ?? ''} (${indicator.measurementCount} mesures)`,
    );
  }
  note('Les mesures s’additionnent : 10 + 8 = 18 enfants scolarises.');

  // -- 9. Remboursement -----------------------------------------------------
  step(11, 'Garde-fou : remboursement impossible si les fonds sont deja affectes');
  await expectRefusal(() =>
    paymentService.refundTransaction(transaction.id, {
      reason: 'Demande de remboursement du donateur.',
    }),
  );
  note('Il faudrait d’abord annuler les affectations concernees.');

  // -- Bilan ----------------------------------------------------------------
  step(12, 'Bilan du projet');
  const overview = await projectService.getFinancialOverview(mainProject.id);
  line('Projet', overview.project.name);
  line('Code', overview.project.code);
  line('Beneficiaires', overview.beneficiaryCount);
  line('Mesures d’impact', overview.impactCount);
  for (const funds of overview.fundsByCurrency) {
    line(`Fonds recus (${funds.currency})`, formatMoney(funds.totalAllocated, funds.currency));
    line(`Depenses (${funds.currency})`, formatMoney(funds.totalSpent, funds.currency));
    line(`Disponible (${funds.currency})`, formatMoney(funds.availableFunds, funds.currency));
  }

  console.log('\nDemo terminee.\n');
}

/**
 * Cree TROIS projets neufs, dedies a cette execution.
 *
 * On ne reprend volontairement pas les projets du seed : le script montre des
 * garde-fous chiffres ("il ne reste que 150 EUR"), et reutiliser un projet
 * deja finance par une execution precedente fausserait ces montants.
 *
 * Ces projets restent en DRAFT, donc absents du site public : l'API ne publie
 * que les projets ACTIVE et COMPLETED. Un projet DRAFT reste pourtant
 * finançable, si bien que la demonstration se deroule normalement sans
 * encombrer la vitrine de projets de test.
 */
async function ensureThreeProjects(
  projectService: ReturnType<typeof createContainer>['services']['projectService'],
) {
  const categories = await projectService.listCategories();
  if (categories.length === 0) {
    throw new Error('Aucune categorie de projet : lancez d’abord `npm run seed`.');
  }

  const runId = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
  const labels = ['Scolarite', 'Sante', 'Alimentation'];
  const projects = [];

  for (const [index, label] of labels.entries()) {
    const category = categories[index % categories.length]!;
    const created = await projectService.createProject({
      categoryId: category.id,
      name: `Demo ${label} ${runId}`,
      description: 'Projet cree automatiquement par le script de demonstration.',
      location: 'Antananarivo, Madagascar',
      status: ProjectStatus.DRAFT,
    });
    projects.push(created);
  }

  return [projects[0]!, projects[1]!, projects[2]!] as const;
}

/** Execute une operation qui DOIT etre refusee, et affiche le refus. */
async function expectRefusal(operation: () => Promise<unknown>): Promise<void> {
  try {
    await operation();
    console.log('  ATTENTION : l’operation aurait du etre refusee !');
  } catch (error) {
    if (error instanceof AppError) {
      line('Refus attendu', error.code);
      note(error.message);
      return;
    }
    throw error;
  }
}

if (isMainModule(import.meta.url)) {
  await runScript('demo:project', runProjectDemo, disconnectPrisma);
}
