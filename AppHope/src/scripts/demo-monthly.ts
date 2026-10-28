import {
  DonationFrequency,
  DonationStatus,
  DonationType,
  DonorType,
  type Transaction,
} from '@prisma/client';
import { createContainer } from '../container.js';
import { disconnectPrisma } from '../database/prisma.js';
import { AppError } from '../shared/errors.js';
import { formatMoney } from '../shared/money.js';
import { isMainModule, line, note, runScript, step, title } from '../shared/run-script.js';

/**
 * DEMONSTRATION : don MENSUEL de 50 000 MGA.
 *
 *   npm run demo:monthly
 *
 * OBJECTIF PEDAGOGIQUE : montrer qu'un don mensuel produit
 *
 *     1 DON  ---->  N TRANSACTIONS
 *
 * Le don porte l'engagement ("50 000 MGA par mois pendant 6 mois"), chaque
 * transaction porte un encaissement reel. Les deux ne se confondent jamais :
 *   - une echeance peut ECHOUER sans annuler l'engagement ;
 *   - une echeance PENDING n'est pas encore de l'argent recu ;
 *   - seules les echeances SUCCESS alimentent les fonds de HOPE.
 */

const MONTHLY_AMOUNT = '50000';
const CURRENCY = 'MGA';
const MONTHS = 6;

const MONTH_LABELS = [
  'Janvier',
  'Fevrier',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
] as const;

/**
 * Scenario des six echeances. On force volontairement un echec et une
 * echeance restee en attente, pour verifier que le calcul du montant recu
 * les exclut bien.
 */
const SCHEDULE = [
  { month: 0, outcome: 'CONFIRM' },
  { month: 1, outcome: 'CONFIRM' },
  { month: 2, outcome: 'FAIL' },
  { month: 3, outcome: 'CONFIRM' },
  { month: 4, outcome: 'PENDING' },
  { month: 5, outcome: 'CONFIRM' },
] as const;

export async function runMonthlyDemo(): Promise<void> {
  const { services } = createContainer();
  const { donorService, donationService, paymentService } = services;

  title('Demo HOPE - don mensuel : 1 don, N transactions');

  // -- Donateur -------------------------------------------------------------
  step(1, 'Creation du donateur');
  const donor = await donorService.createDonor({
    firstName: 'Faniry',
    lastName: 'Andriamanana',
    email: `faniry.demo.${Date.now()}@example.mg`,
    phone: '+261 32 98 765 43',
    donorType: DonorType.INDIVIDUAL,
    country: 'MG',
    preferredCurrency: CURRENCY,
    city: 'Antsirabe',
  });
  line('Donateur', `${donor.firstName} ${donor.lastName}`);

  // -- Le DON : un seul engagement -----------------------------------------
  step(2, 'Creation du don mensuel (UN SEUL enregistrement)');
  const startDate = new Date(Date.UTC(2026, 0, 15));
  const endDate = new Date(Date.UTC(2026, MONTHS - 1, 15));

  const donation = await donationService.createDonation({
    donorId: donor.id,
    donationType: DonationType.RECURRING,
    frequency: DonationFrequency.MONTHLY,
    currency: CURRENCY,
    expectedAmount: MONTHLY_AMOUNT,
    startDate,
    endDate,
    status: DonationStatus.ACTIVE,
    notes: `Engagement de ${MONTHLY_AMOUNT} MGA par mois pendant ${MONTHS} mois.`,
  });

  line('Reference du don', donation.reference);
  line('Type', donation.donationType);
  line('Frequence', donation.frequency ?? '-');
  line('Montant PAR ECHEANCE', formatMoney(donation.expectedAmount, CURRENCY));
  line('Debut', startDate.toISOString().slice(0, 10));
  line('Fin', endDate.toISOString().slice(0, 10));

  const initialSummary = await donationService.getFinancialSummary(donation.id);
  line('Echeances prevues', initialSummary.expectedInstallments ?? 'indeterminees');
  line('Engagement total', formatMoney(initialSummary.totalCommitted ?? 0, CURRENCY));
  note('UN seul don en base, alors que six encaissements vont avoir lieu.');

  // -- Les TRANSACTIONS : un mouvement par echeance -------------------------
  step(3, `Creation des ${MONTHS} echeances mensuelles`);
  const created: Transaction[] = [];

  for (const entry of SCHEDULE) {
    const label = MONTH_LABELS[entry.month] ?? `Mois ${entry.month + 1}`;

    // Le simulateur lit `metadata.mock` pour decider du resultat : c'est
    // ainsi qu'on rejoue un echec sans truquer le service. La cle `confirm`
    // cible l'ENCAISSEMENT : l'echeance est donc bien creee en PENDING, puis
    // refusee au moment du debit (cas reel d'une provision insuffisante).
    const transaction = await paymentService.createTransaction({
      donationId: donation.id,
      paymentMethodCode: 'MVOLA',
      installmentNumber: entry.month + 1,
      metadata: {
        month: label,
        ...(entry.outcome === 'FAIL'
          ? { mock: { confirm: { outcome: 'FAILURE', failureReason: 'Solde MVola insuffisant.' } } }
          : {}),
      },
    });

    created.push(transaction);
    console.log(
      `  Echeance ${String(entry.month + 1).padStart(2, ' ')} (${label.padEnd(9, ' ')}) ` +
        `-> ${transaction.internalReference}  [${transaction.status}]`,
    );
  }

  // -- Traitement de chaque echeance ---------------------------------------
  step(4, 'Traitement des echeances');
  for (const [index, entry] of SCHEDULE.entries()) {
    const transaction = created[index];
    if (!transaction) continue;
    const label = MONTH_LABELS[entry.month] ?? `Mois ${entry.month + 1}`;

    if (entry.outcome === 'CONFIRM') {
      const confirmed = await paymentService.confirmTransaction(transaction.id, {
        transactionDate: new Date(Date.UTC(2026, entry.month, 15)),
      });
      console.log(`  ${label.padEnd(9, ' ')} : ${confirmed.status}  (encaisse)`);
      continue;
    }

    if (entry.outcome === 'FAIL') {
      // La confirmation est refusee par le prestataire : le service marque la
      // transaction FAILED puis remonte une erreur metier explicite.
      try {
        await paymentService.confirmTransaction(transaction.id);
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        const failed = await paymentService.getTransactionById(transaction.id);
        console.log(`  ${label.padEnd(9, ' ')} : ${failed.status}  (${failed.failureReason})`);
      }
      continue;
    }

    // PENDING : on laisse volontairement l'echeance en attente.
    await paymentService.markTransactionProcessing(transaction.id);
    const pending = await paymentService.getTransactionById(transaction.id);
    console.log(`  ${label.padEnd(9, ' ')} : ${pending.status}  (pas encore encaisse)`);
  }

  // -- Verification : FAILED ne peut pas devenir SUCCESS --------------------
  step(5, 'Garde-fou : une echeance FAILED ne peut pas devenir SUCCESS');
  const failedIndex = SCHEDULE.findIndex((entry) => entry.outcome === 'FAIL');
  const failedTransaction = created[failedIndex];
  if (failedTransaction) {
    try {
      await paymentService.confirmTransaction(failedTransaction.id);
      console.log('  ATTENTION : la transition aurait du etre refusee !');
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      line('Refus attendu', error.code);
      note(error.message);
      note('Pour rattraper un echec, il faut creer une NOUVELLE transaction.');
    }
  }

  // -- Bilan ----------------------------------------------------------------
  step(6, 'Bilan : 1 DON, N TRANSACTIONS');
  const transactions = await paymentService.getTransactionsForDonation(donation.id);
  const summary = await donationService.getFinancialSummary(donation.id);

  console.log('\n  Detail des echeances :');
  console.log(`  ${'#'.padEnd(4)}${'REFERENCE'.padEnd(26)}${'STATUT'.padEnd(12)}MONTANT`);
  for (const transaction of transactions) {
    console.log(
      `  ${String(transaction.installmentNumber ?? '-').padEnd(4)}` +
        `${transaction.internalReference.padEnd(26)}` +
        `${transaction.status.padEnd(12)}` +
        `${formatMoney(transaction.amount, transaction.currency)}`,
    );
  }

  console.log('');
  line('Dons en base', 1);
  line('Transactions en base', summary.transactionCount);
  line('Engagement total', formatMoney(summary.totalCommitted ?? 0, CURRENCY));
  line('Recu (SUCCESS uniquement)', formatMoney(summary.totalReceived, CURRENCY));
  line('En attente (non compte)', formatMoney(summary.totalPending, CURRENCY));
  line('Echoue (non compte)', formatMoney(summary.totalFailed, CURRENCY));
  line('Reste a payer', formatMoney(summary.remainingCommitment ?? 0, CURRENCY));
  line('Echeances reussies', `${summary.successfulTransactionCount} / ${MONTHS}`);
  line('Affectable a des projets', formatMoney(summary.availableForAllocation, CURRENCY));

  note('Le montant recu exclut bien l’echeance echouee ET l’echeance en attente :');
  note(`${summary.successfulTransactionCount} x ${formatMoney(MONTHLY_AMOUNT, CURRENCY)} = ${formatMoney(summary.totalReceived, CURRENCY)}.`);

  console.log('\nDemo terminee.\n');
}

if (isMainModule(import.meta.url)) {
  await runScript('demo:monthly', runMonthlyDemo, disconnectPrisma);
}
