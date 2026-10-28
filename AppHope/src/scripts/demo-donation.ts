import { AllocationType, DonationStatus, DonationType, DonorType } from '@prisma/client';
import { createContainer } from '../container.js';
import { disconnectPrisma } from '../database/prisma.js';
import { AppError } from '../shared/errors.js';
import { formatMoney } from '../shared/money.js';
import { isMainModule, line, note, runScript, step, title } from '../shared/run-script.js';

/**
 * DEMONSTRATION : don ponctuel de 100 000 MGA paye par MVola.
 *
 *   npm run demo:donation
 *
 * Le scenario deroule tout le parcours sans aucune API HTTP :
 *   1. creation d'un donateur ;
 *   2. selection d'un projet ;
 *   3. creation d'un don de 100 000 MGA ;
 *   4. choix de MVola comme methode de paiement ;
 *   5. creation de la transaction (PENDING) ;
 *   6. simulation du paiement via MockPaymentProvider ;
 *   7. confirmation de la transaction (SUCCESS) ;
 *   8. affectation de 70 000 MGA au projet ;
 *   9. 30 000 MGA restent non affectes ;
 *  10. affichage du resultat, y compris le garde-fou anti-depassement.
 */

const DONATION_AMOUNT = '100000';
const ALLOCATED_AMOUNT = '70000';
const CURRENCY = 'MGA';

export async function runDonationDemo(): Promise<void> {
  const { services } = createContainer();
  const {
    donorService,
    donationService,
    paymentService,
    allocationService,
    projectService,
  } = services;

  title('Demo HOPE - don ponctuel de 100 000 MGA via MVola');

  // -- 1. Donateur ----------------------------------------------------------
  step(1, 'Creation du donateur');
  const donor = await donorService.createDonor({
    firstName: 'Tiana',
    lastName: 'Rakotomalala',
    email: `tiana.demo.${Date.now()}@example.mg`,
    phone: '+261 34 12 345 67',
    donorType: DonorType.INDIVIDUAL,
    country: 'MG',
    preferredCurrency: CURRENCY,
    city: 'Antananarivo',
    profession: 'Enseignante',
    discoverySource: 'Bouche a oreille',
  });
  const profile = await donorService.getDonorProfile(donor.id);
  line('Donateur', profile.displayName);
  line('Type', donor.donorType);
  line('Pays', donor.country);
  line('International ?', profile.isInternational ? 'oui' : 'non (donateur local)');
  note('Le type de donateur et le pays sont deux informations distinctes :');
  note('"international" se DEDUIT du pays, il n’est jamais stocke.');

  // -- 2. Projet ------------------------------------------------------------
  step(2, 'Selection du projet beneficiaire');
  const project = await pickProject(projectService);
  line('Projet', project.name);
  line('Code', project.code);
  line('Statut', project.status);

  // -- 3. Don ---------------------------------------------------------------
  step(3, 'Creation du don (un ENGAGEMENT, pas un mouvement d’argent)');
  const donation = await donationService.createDonation({
    donorId: donor.id,
    donationType: DonationType.ONE_TIME,
    currency: CURRENCY,
    expectedAmount: DONATION_AMOUNT,
    status: DonationStatus.ACTIVE,
    notes: 'Don ponctuel de demonstration.',
  });
  line('Reference du don', donation.reference);
  line('Montant attendu', formatMoney(donation.expectedAmount, donation.currency));
  line('Montant deja recu', formatMoney(0, CURRENCY));
  note('A ce stade HOPE n’a recu AUCUN argent : le don n’est qu’une intention.');

  // -- 4 & 5. Methode de paiement et transaction ----------------------------
  step(4, 'Choix de la methode de paiement et creation de la transaction');
  const mvola = await paymentService.getPaymentMethodByCode('MVOLA');
  line('Methode', `${mvola.name} (${mvola.code})`);
  line('Portee', mvola.scope);
  line('Fournisseur technique', mvola.provider);

  const transaction = await paymentService.createTransaction({
    donationId: donation.id,
    paymentMethodCode: 'MVOLA',
    metadata: { phone: '+261 34 12 345 67' },
  });
  line('Reference transaction', transaction.internalReference);
  line('Montant', formatMoney(transaction.amount, transaction.currency));
  line('Statut', transaction.status);
  line('Reference prestataire', transaction.providerReference ?? '(aucune)');

  // -- 6. Simulation du paiement -------------------------------------------
  step(5, 'Simulation du paiement (MockPaymentProvider, aucun appel reseau)');
  const providerStatus = await paymentService.getProviderStatus(transaction.id);
  line('Statut renvoye par le prestataire', providerStatus.status);

  const beforeConfirmation = await donationService.getFinancialSummary(donation.id);
  line('Recu avant confirmation', formatMoney(beforeConfirmation.totalReceived, CURRENCY));
  line('En attente', formatMoney(beforeConfirmation.totalPending, CURRENCY));
  note('Une transaction PENDING ne compte pas comme de l’argent recu.');

  // -- 7. Confirmation ------------------------------------------------------
  step(6, 'Confirmation de la transaction');
  const confirmed = await paymentService.confirmTransaction(transaction.id);
  line('Statut', confirmed.status);
  line('Date du mouvement', confirmed.transactionDate?.toISOString() ?? '(non renseignee)');

  const afterConfirmation = await donationService.getFinancialSummary(donation.id);
  line('Montant reellement recu', formatMoney(afterConfirmation.totalReceived, CURRENCY));
  line('Affectable', formatMoney(afterConfirmation.availableForAllocation, CURRENCY));

  // -- 8 & 9. Affectation ---------------------------------------------------
  step(7, 'Affectation de 70 000 MGA au projet');
  const allocation = await allocationService.allocate({
    donationId: donation.id,
    projectId: project.id,
    amount: ALLOCATED_AMOUNT,
    allocationType: AllocationType.DONOR_DESIGNATED,
    notes: 'Le donateur souhaite financer ce projet precis.',
  });
  line('Montant affecte', formatMoney(allocation.amount, allocation.currency));
  line('Type d’affectation', allocation.allocationType);

  const allocationSummary = await allocationService.getDonationAllocationSummary(donation.id);
  line('Total affecte', formatMoney(allocationSummary.totalAllocated, CURRENCY));
  line('Reste NON affecte', formatMoney(allocationSummary.unallocatedAmount, CURRENCY));
  note('Les 30 000 MGA restants pourront etre repartis plus tard par HOPE.');

  // -- 10. Garde-fou --------------------------------------------------------
  step(8, 'Garde-fou : on ne peut pas affecter plus que ce qui a ete recu');
  await expectRefusal(async () => {
    await allocationService.allocate({
      donationId: donation.id,
      projectId: project.id,
      amount: '50000',
      allocationType: AllocationType.HOPE_ALLOCATED,
    });
  });

  // -- Bilan ----------------------------------------------------------------
  step(9, 'Bilan final');
  const finalSummary = await donationService.getFinancialSummary(donation.id);
  line('Don', finalSummary.reference);
  line('Statut du don', finalSummary.status);
  line('Attendu', formatMoney(finalSummary.expectedAmountPerInstallment, CURRENCY));
  line('Recu (net)', formatMoney(finalSummary.totalReceived, CURRENCY));
  line('Affecte a des projets', formatMoney(finalSummary.totalAllocated, CURRENCY));
  line('Non affecte', formatMoney(finalSummary.unallocatedAmount, CURRENCY));
  line('Reste a payer sur l’engagement', formatMoney(finalSummary.remainingCommitment ?? 0, CURRENCY));
  line('Nombre de transactions', finalSummary.transactionCount);

  const projectFunds = await projectService.getProjectFunds(project.id);
  const mgaFunds = projectFunds.find((row) => row.currency === CURRENCY);
  line('Fonds recus par le projet', formatMoney(mgaFunds?.totalAllocated ?? 0, CURRENCY));
  line('Fonds disponibles du projet', formatMoney(mgaFunds?.availableFunds ?? 0, CURRENCY));

  console.log('\nDemo terminee.\n');
}

/**
 * Cree un projet neuf, dedie a cette execution.
 *
 * DEUX RAISONS DE NE PAS REPRENDRE UN PROJET DU SEED
 *   1. les fonds s'accumuleraient d'une execution a l'autre, et le bilan final
 *      n'afficherait plus les 70 000 MGA de CETTE demonstration ;
 *   2. le projet est laisse en DRAFT, donc invisible sur le site public :
 *      l'API ne publie que les projets ACTIVE et COMPLETED. Les affectations
 *      fonctionnent pourtant (un projet DRAFT reste finançable), si bien que
 *      la demonstration se deroule sans polluer la vitrine.
 */
async function pickProject(
  projectService: ReturnType<typeof createContainer>['services']['projectService'],
) {
  const [category] = await projectService.listCategories();
  if (!category) {
    throw new Error('Aucune categorie de projet : lancez d’abord `npm run seed`.');
  }

  const runId = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
  const created = await projectService.createProject({
    categoryId: category.id,
    name: `Demo don ponctuel ${runId}`,
    description: 'Projet cree automatiquement par le script de demonstration.',
    location: 'Antananarivo, Madagascar',
  });
  return created;
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
  await runScript('demo:donation', runDonationDemo, disconnectPrisma);
}
