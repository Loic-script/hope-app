import {
  DonationStatus,
  DonationType,
  PaymentScope,
  Prisma,
  TransactionStatus,
  type PaymentMethod,
  type Transaction,
} from '@prisma/client';
import { PaymentMethodRepository } from './payment-method.repository.js';
import { TransactionRepository } from './transaction.repository.js';
import { netReceivedAmount, transactionStateMachine } from './transaction-status.js';
import type {
  CancelTransactionInput,
  ConfirmTransactionInput,
  CreatePaymentMethodInput,
  CreateTransactionInput,
  DonationTransactionTotals,
  FailTransactionInput,
  RefundTransactionInput,
  TransactionFilters,
} from './payment.types.js';
import {
  paymentProviderRegistry,
  type PaymentProviderRegistry,
} from './providers/provider.registry.js';
import type {
  PaymentContext,
  PaymentProviderResult,
  RefundContext,
} from './providers/payment-provider.interface.js';
import { AllocationRepository } from '../allocations/allocation.repository.js';
import {
  DonationRepository,
  type DonationWithDonor,
} from '../donations/donation.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../audit/audit.types.js';
import { runInTransaction } from '../../database/unit-of-work.js';
import { normalizeCurrency } from '../../shared/currency.js';
import {
  BusinessRuleError,
  InsufficientFundsError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.js';
import { allowedPaymentScopes } from '../../shared/geography.js';
import { formatMoney, toDecimal, type Decimal } from '../../shared/money.js';
import { REFERENCE_PREFIXES, createWithUniqueReference } from '../../shared/reference.js';
import type { DbClient, PaginationOptions } from '../../shared/types.js';
import { optionalText, requireDate, requireText } from '../../shared/validation.js';

/**
 * MODULE PRIORITAIRE : gestion des mouvements financiers reels.
 *
 * RAPPEL DU MODELE
 *   Un DON (Donation) est un ENGAGEMENT. Une TRANSACTION est un MOUVEMENT
 *   D'ARGENT. Un don mensuel de 50 000 MGA sur 12 mois = 1 don et jusqu'a
 *   12 transactions. Les deux entites ne doivent jamais etre confondues.
 *
 * REGLES APPLIQUEES
 *   - toutes les ecritures liees passent par une transaction PostgreSQL ;
 *   - les transitions de statut incoherentes sont refusees ;
 *   - une transaction confirmee n'est jamais supprimee, seulement remboursee ;
 *   - un remboursement ne peut pas rendre les affectations superieures aux
 *     fonds reellement disponibles.
 *
 * APPELS PRESTATAIRE : POURQUOI HORS TRANSACTION POSTGRESQL
 *   Chaque operation se deroule en trois temps :
 *     1. lecture et validation ;
 *     2. appel au prestataire, EN DEHORS de toute transaction SQL ;
 *     3. ecriture du resultat dans une transaction courte, apres avoir relu
 *        et revalide le statut (il a pu changer entre-temps).
 *
 *   Deux raisons a ce decoupage :
 *     - un appel reseau lent ne doit pas maintenir ouverte une transaction
 *       SERIALIZABLE, qui bloquerait les autres ecritures ;
 *     - surtout : quand le prestataire REFUSE un paiement, il faut a la fois
 *       ENREGISTRER l'echec et LEVER une erreur. Or les deux sont
 *       incompatibles dans une meme transaction : le `throw` declencherait un
 *       rollback qui effacerait l'echec, et la transaction resterait
 *       faussement PENDING. L'echec est donc ecrit dans sa propre transaction,
 *       puis l'erreur est levee.
 */
export class PaymentService {
  constructor(
    private readonly transactionRepository: TransactionRepository = new TransactionRepository(),
    private readonly paymentMethodRepository: PaymentMethodRepository = new PaymentMethodRepository(),
    private readonly allocationRepository: AllocationRepository = new AllocationRepository(),
    private readonly donationRepository: DonationRepository = new DonationRepository(),
    private readonly auditService: AuditService = new AuditService(),
    private readonly providers: PaymentProviderRegistry = paymentProviderRegistry,
  ) {}

  // -------------------------------------------------------------------------
  // Methodes de paiement (catalogue)
  // -------------------------------------------------------------------------

  async registerPaymentMethod(input: CreatePaymentMethodInput): Promise<PaymentMethod> {
    const code = requireText(input.code, 'code', 60).toUpperCase();
    const currencies = (input.supportedCurrencies ?? []).map((currency) =>
      normalizeCurrency(currency, 'supportedCurrencies'),
    );

    return this.paymentMethodRepository.upsertByCode(code, {
      name: requireText(input.name, 'name', 120),
      provider: requireText(input.provider, 'provider', 60).toUpperCase(),
      scope: input.scope,
      isActive: input.isActive ?? true,
      supportedCurrencies: currencies,
      description: optionalText(input.description, 'description'),
    });
  }

  async getPaymentMethodByCode(code: string, tx?: DbClient): Promise<PaymentMethod> {
    const method = await this.paymentMethodRepository.findByCode(code, tx);
    if (!method) throw new NotFoundError('Methode de paiement', code);
    return method;
  }

  async listPaymentMethods(scope?: PaymentScope[]): Promise<PaymentMethod[]> {
    return this.paymentMethodRepository.findActive(scope);
  }

  /** Methodes utilisables par un donateur situe dans ce pays. */
  async listPaymentMethodsForCountry(country: string): Promise<PaymentMethod[]> {
    const scopes = allowedPaymentScopes(country) as PaymentScope[];
    return this.paymentMethodRepository.findActive(scopes);
  }

  // -------------------------------------------------------------------------
  // Cycle de vie d'une transaction
  // -------------------------------------------------------------------------

  /**
   * Cree une transaction en statut PENDING et demande au prestataire
   * d'initialiser le paiement.
   *
   * Le montant par defaut est le montant attendu du don : pour un don mensuel
   * de 50 000 MGA, chaque appel cree donc une echeance de 50 000 MGA.
   *
   * DECOUPAGE EN TROIS TEMPS (voir la note "Appels prestataire" plus bas) :
   *   1. transaction PostgreSQL courte : validations et creation de la ligne ;
   *   2. appel au prestataire, HORS transaction SQL ;
   *   3. transaction PostgreSQL courte : enregistrement de sa reponse.
   */
  async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    // --- Temps 1 : validations et creation de la ligne PENDING ---
    const { created, paymentMethodCode, providerCode } = await runInTransaction(async (tx) => {
      const donation = await this.loadDonationForPayment(input.donationId, tx);
      const paymentMethod = await this.getPaymentMethodByCode(input.paymentMethodCode, tx);

      assertPaymentMethodUsable(paymentMethod, donation);

      // Resolution du fournisseur AVANT toute ecriture : un fournisseur
      // inconnu doit echouer sans laisser de transaction orpheline en base.
      this.providers.get(paymentMethod.provider);

      const currency = normalizeCurrency(donation.currency);
      const amount = resolveTransactionAmount(input.amount, donation.expectedAmount, currency);

      const installmentNumber = await this.resolveInstallmentNumber(donation, input, tx);
      const metadata = (input.metadata ?? null) as Record<string, unknown> | null;

      const row = await createWithUniqueReference(REFERENCE_PREFIXES.TRANSACTION, (reference) =>
        this.transactionRepository.create(
          {
            donationId: donation.id,
            paymentMethodId: paymentMethod.id,
            amount,
            currency,
            status: TransactionStatus.PENDING,
            internalReference: reference,
            installmentNumber,
            metadata: metadata === null ? Prisma.DbNull : (metadata as Prisma.InputJsonValue),
          },
          tx,
        ),
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.TRANSACTION,
          entityId: row.id,
          action: AUDIT_ACTIONS.TRANSACTION_CREATED,
          newData: auditView(row),
        },
        tx,
      );

      return {
        created: row,
        paymentMethodCode: paymentMethod.code,
        providerCode: paymentMethod.provider,
      };
    });

    // --- Temps 2 : appel au fournisseur (phase 1 : Mock, aucun reseau) ---
    const provider = this.providers.get(providerCode);
    const result = await provider.initializePayment(
      buildPaymentContext(created, paymentMethodCode),
    );

    // --- Temps 3 : enregistrement de la reponse du prestataire ---
    return runInTransaction((tx) => this.applyProviderInitialization(created, result, tx));
  }

  /** Passe une transaction en cours de traitement chez le prestataire. */
  async markTransactionProcessing(transactionId: string): Promise<Transaction> {
    return runInTransaction(async (tx) => {
      const current = await this.getTransactionById(transactionId, tx);
      transactionStateMachine.assert(current.status, TransactionStatus.PROCESSING);

      const updated = await this.transactionRepository.update(
        transactionId,
        { status: TransactionStatus.PROCESSING },
        tx,
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.TRANSACTION,
          entityId: transactionId,
          action: AUDIT_ACTIONS.TRANSACTION_PROCESSING,
          oldData: auditView(current),
          newData: auditView(updated),
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Confirme l'encaissement : c'est LE moment ou l'argent devient reellement
   * disponible pour HOPE (regle n.4).
   *
   * Si le prestataire repond FAILED, la transaction est marquee FAILED (dans
   * SA PROPRE transaction PostgreSQL, pour que la trace survive) puis une
   * erreur metier est levee : on ne "force" jamais un succes.
   */
  async confirmTransaction(
    transactionId: string,
    input: ConfirmTransactionInput = {},
  ): Promise<Transaction> {
    // --- Temps 1 : lecture et validation, sans rien ecrire ---
    const current = await this.getTransactionById(transactionId);
    transactionStateMachine.assert(current.status, TransactionStatus.SUCCESS);

    const paymentMethod = await this.loadPaymentMethod(current.paymentMethodId);
    const provider = this.providers.get(paymentMethod.provider);

    // --- Temps 2 : appel au prestataire, hors transaction PostgreSQL ---
    const result = await provider.confirmPayment({
      ...buildPaymentContext(current, paymentMethod.code),
      providerReference: input.providerReference ?? current.providerReference,
    });

    // --- Temps 3 : enregistrement du resultat ---
    if (result.status === 'FAILED') {
      const reason = result.failureReason ?? 'Confirmation refusee par le prestataire.';

      // L'echec est ecrit dans une transaction QUI ABOUTIT. S'il etait ecrit
      // dans la meme transaction que le `throw` ci-dessous, PostgreSQL
      // annulerait l'ecriture par rollback et la transaction resterait
      // faussement PENDING.
      const failed = await runInTransaction((tx) => this.applyFailure(current, reason, tx));

      throw new BusinessRuleError(
        `Le prestataire a refuse la confirmation de ${current.internalReference} : ` +
          `${failed.failureReason}`,
        { transactionId, providerStatus: result.status },
      );
    }

    if (result.status !== 'SUCCEEDED') {
      throw new BusinessRuleError(
        `Le prestataire n'a pas confirme l'encaissement de ${current.internalReference} ` +
          `(statut renvoye : ${result.status}). La transaction reste ${current.status}.`,
        { transactionId, providerStatus: result.status },
      );
    }

    const transactionDate = input.transactionDate
      ? requireDate(input.transactionDate, 'transactionDate')
      : new Date();

    return runInTransaction(async (tx) => {
      // Le statut est relu et revalide : il a pu changer pendant l'appel au
      // prestataire (double confirmation, annulation concurrente...).
      const fresh = await this.getTransactionById(transactionId, tx);
      transactionStateMachine.assert(fresh.status, TransactionStatus.SUCCESS);

      const updated = await this.transactionRepository.update(
        transactionId,
        {
          status: TransactionStatus.SUCCESS,
          transactionDate,
          providerReference:
            result.providerReference ?? input.providerReference ?? fresh.providerReference,
          failureReason: null,
          metadata: mergeMetadata(fresh.metadata, result.raw),
        },
        tx,
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.TRANSACTION,
          entityId: transactionId,
          action: AUDIT_ACTIONS.TRANSACTION_CONFIRMED,
          oldData: auditView(fresh),
          newData: auditView(updated),
        },
        tx,
      );

      return updated;
    });
  }

  /** Marque une transaction comme echouee. Statut FINAL : voir la note ci-dessous. */
  async failTransaction(
    transactionId: string,
    input: FailTransactionInput,
  ): Promise<Transaction> {
    const reason = requireText(input.reason, 'reason');
    return runInTransaction(async (tx) => {
      const current = await this.getTransactionById(transactionId, tx);
      transactionStateMachine.assert(current.status, TransactionStatus.FAILED);
      return this.applyFailure(current, reason, tx);
    });
  }

  /**
   * Annule une transaction qui n'a pas encore ete encaissee.
   *
   * On ne peut PAS annuler une transaction SUCCESS : de l'argent reellement
   * recu se rembourse (refundTransaction), il ne se supprime pas.
   */
  async cancelTransaction(
    transactionId: string,
    input: CancelTransactionInput = {},
  ): Promise<Transaction> {
    const current = await this.getTransactionById(transactionId);
    transactionStateMachine.assert(current.status, TransactionStatus.CANCELLED);

    const paymentMethod = await this.loadPaymentMethod(current.paymentMethodId);
    const provider = this.providers.get(paymentMethod.provider);
    const result = await provider.cancelPayment(buildPaymentContext(current, paymentMethod.code));

    return runInTransaction(async (tx) => {
      const fresh = await this.getTransactionById(transactionId, tx);
      transactionStateMachine.assert(fresh.status, TransactionStatus.CANCELLED);

      const updated = await this.transactionRepository.update(
        transactionId,
        {
          status: TransactionStatus.CANCELLED,
          failureReason: optionalText(input.reason, 'reason'),
          metadata: mergeMetadata(fresh.metadata, result.raw),
        },
        tx,
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.TRANSACTION,
          entityId: transactionId,
          action: AUDIT_ACTIONS.TRANSACTION_CANCELLED,
          oldData: auditView(fresh),
          newData: auditView(updated),
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Rembourse tout ou partie d'une transaction encaissee.
   *
   * DEUX GARDE-FOUS
   *   1. seule une transaction SUCCESS peut etre remboursee ;
   *   2. le remboursement ne peut pas faire passer les fonds recus du don
   *      SOUS le montant deja affecte a des projets (regle n.5). Il faut
   *      d'abord annuler les affectations concernees.
   *
   * Un remboursement partiel laisse la transaction en SUCCESS avec un
   * `refundedAmount` ; un remboursement total la fait passer en REFUNDED.
   * Dans les deux cas, la ligne est CONSERVEE : la trace reste (regle n.9).
   */
  async refundTransaction(
    transactionId: string,
    input: RefundTransactionInput,
  ): Promise<Transaction> {
    const reason = requireText(input.reason, 'reason');

    // --- Temps 1 : validations et calcul du montant a rembourser ---
    const current = await this.getTransactionById(transactionId);

    if (current.status !== TransactionStatus.SUCCESS) {
      throw new BusinessRuleError(
        `Seule une transaction SUCCESS peut etre remboursee. ` +
          `${current.internalReference} est actuellement ${current.status}.`,
        { transactionId, status: current.status },
      );
    }

    const currency = normalizeCurrency(current.currency);
    const alreadyRefunded = toDecimal(current.refundedAmount);
    const refundable = toDecimal(current.amount).minus(alreadyRefunded);

    const refundAmount =
      input.amount === undefined ? refundable : toDecimal(input.amount, 'amount');

    if (!refundAmount.greaterThan(0)) {
      throw new ValidationError('Le montant du remboursement doit etre strictement positif.', {
        transactionId,
        amount: refundAmount.toString(),
      });
    }

    if (refundAmount.greaterThan(refundable)) {
      throw new BusinessRuleError(
        `Remboursement de ${formatMoney(refundAmount, currency)} impossible : ` +
          `le montant remboursable de ${current.internalReference} est ` +
          `${formatMoney(refundable, currency)}.`,
        {
          transactionId,
          requested: refundAmount.toString(),
          refundable: refundable.toString(),
        },
      );
    }

    // Controle des fonds avant d'appeler le prestataire : inutile de demander
    // un remboursement qu'on refusera ensuite d'enregistrer.
    await this.assertRefundKeepsAllocationsValid(current.donationId, refundAmount, currency);

    // --- Temps 2 : appel au prestataire, hors transaction PostgreSQL ---
    const paymentMethod = await this.loadPaymentMethod(current.paymentMethodId);
    const provider = this.providers.get(paymentMethod.provider);
    const refundContext: RefundContext = {
      ...buildPaymentContext(current, paymentMethod.code),
      refundAmount,
      reason,
    };
    const result = await provider.refundPayment(refundContext);

    // --- Temps 3 : ecriture, avec revalidation sous verrou ---
    return runInTransaction(async (tx) => {
      const fresh = await this.getTransactionById(transactionId, tx);

      if (fresh.status !== TransactionStatus.SUCCESS) {
        throw new BusinessRuleError(
          `Seule une transaction SUCCESS peut etre remboursee. ` +
            `${fresh.internalReference} est actuellement ${fresh.status}.`,
          { transactionId, status: fresh.status },
        );
      }

      // Les affectations ont pu changer pendant l'appel au prestataire.
      await this.assertRefundKeepsAllocationsValid(
        fresh.donationId,
        refundAmount,
        currency,
        tx,
      );

      const newRefundedTotal = toDecimal(fresh.refundedAmount).plus(refundAmount);
      const isFullRefund = newRefundedTotal.greaterThanOrEqualTo(toDecimal(fresh.amount));

      if (isFullRefund) {
        transactionStateMachine.assert(fresh.status, TransactionStatus.REFUNDED);
      }

      const updated = await this.transactionRepository.update(
        transactionId,
        {
          status: isFullRefund ? TransactionStatus.REFUNDED : TransactionStatus.SUCCESS,
          refundedAmount: newRefundedTotal,
          refundedAt: new Date(),
          refundReason: reason,
          metadata: mergeMetadata(fresh.metadata, result.raw),
        },
        tx,
      );

      await this.auditService.record(
        {
          entityType: AUDIT_ENTITIES.TRANSACTION,
          entityId: transactionId,
          action: AUDIT_ACTIONS.TRANSACTION_REFUNDED,
          oldData: auditView(fresh),
          newData: { ...auditView(updated), refundAmount: refundAmount.toString(), reason },
        },
        tx,
      );

      return updated;
    });
  }

  /** Interroge le prestataire et renvoie son statut, sans rien modifier. */
  async getProviderStatus(transactionId: string): Promise<PaymentProviderResult> {
    const transaction = await this.getTransactionById(transactionId);
    const paymentMethod = await this.loadPaymentMethod(transaction.paymentMethodId);
    const provider = this.providers.get(paymentMethod.provider);
    return provider.getPaymentStatus(buildPaymentContext(transaction, paymentMethod.code));
  }

  // -------------------------------------------------------------------------
  // Lectures et calculs
  // -------------------------------------------------------------------------

  async getTransactionById(id: string, tx?: DbClient): Promise<Transaction> {
    const transaction = await this.transactionRepository.findById(id, tx);
    if (!transaction) throw new NotFoundError('Transaction', id);
    return transaction;
  }

  async getTransactionByReference(reference: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findByInternalReference(reference);
    if (!transaction) throw new NotFoundError('Transaction', reference);
    return transaction;
  }

  /** Toutes les transactions d'un don, dans l'ordre des echeances. */
  async getTransactionsForDonation(
    donationId: string,
    options: PaginationOptions = {},
  ): Promise<Transaction[]> {
    return this.transactionRepository.findByDonationId(donationId, options);
  }

  async listTransactions(
    filters: TransactionFilters = {},
    options: PaginationOptions = {},
  ): Promise<Transaction[]> {
    return this.transactionRepository.findMany(filters, options);
  }

  /** Totaux par statut : recu, en attente, echoue, annule, rembourse. */
  async getDonationTotals(
    donationId: string,
    tx?: DbClient,
  ): Promise<DonationTransactionTotals> {
    return this.transactionRepository.getDonationTotals(donationId, tx);
  }

  /** Montant NET effectivement paye pour un don (regles n.2, n.3 et n.4). */
  async getTotalPaidForDonation(donationId: string, tx?: DbClient): Promise<Decimal> {
    return this.transactionRepository.sumNetReceived(donationId, tx);
  }

  /** Montant net apporte par une transaction precise. */
  netAmountOf(transaction: Transaction): Decimal {
    return netReceivedAmount(transaction);
  }

  // -------------------------------------------------------------------------
  // Internes
  // -------------------------------------------------------------------------

  private async loadDonationForPayment(
    donationId: string,
    tx: DbClient,
  ): Promise<DonationWithDonor> {
    const donation = await this.donationRepository.findByIdWithDonor(donationId, tx);
    if (!donation) throw new NotFoundError('Don', donationId);

    if (donation.status === DonationStatus.CANCELLED) {
      throw new BusinessRuleError(
        `Impossible de creer une transaction : le don ${donation.reference} est annule.`,
        { donationId, status: donation.status },
      );
    }
    if (donation.status === DonationStatus.COMPLETED) {
      throw new BusinessRuleError(
        `Impossible de creer une transaction : le don ${donation.reference} est deja cloture.`,
        { donationId, status: donation.status },
      );
    }

    return donation;
  }

  private async loadPaymentMethod(id: string, tx?: DbClient): Promise<PaymentMethod> {
    const method = await this.paymentMethodRepository.findById(id, tx);
    if (!method) throw new NotFoundError('Methode de paiement', id);
    return method;
  }

  /** Numerote automatiquement les echeances d'un don recurrent. */
  private async resolveInstallmentNumber(
    donation: DonationWithDonor,
    input: CreateTransactionInput,
    tx: DbClient,
  ): Promise<number | null> {
    if (donation.donationType !== DonationType.RECURRING) {
      return input.installmentNumber ?? null;
    }
    if (input.installmentNumber != null) {
      if (!Number.isInteger(input.installmentNumber) || input.installmentNumber < 1) {
        throw new ValidationError('installmentNumber doit etre un entier superieur ou egal a 1.', {
          installmentNumber: input.installmentNumber,
        });
      }
      return input.installmentNumber;
    }
    const last = await this.transactionRepository.getLastInstallmentNumber(donation.id, tx);
    return last + 1;
  }

  private async applyProviderInitialization(
    transaction: Transaction,
    result: PaymentProviderResult,
    tx: DbClient,
  ): Promise<Transaction> {
    if (result.status === 'FAILED') {
      return this.applyFailure(
        transaction,
        result.failureReason ?? "Initialisation refusee par le prestataire.",
        tx,
      );
    }

    return this.transactionRepository.update(
      transaction.id,
      {
        providerReference: result.providerReference,
        metadata: mergeMetadata(transaction.metadata, result.raw),
      },
      tx,
    );
  }

  private async applyFailure(
    current: Transaction,
    reason: string,
    tx: DbClient,
  ): Promise<Transaction> {
    const updated = await this.transactionRepository.update(
      current.id,
      { status: TransactionStatus.FAILED, failureReason: reason },
      tx,
    );

    await this.auditService.record(
      {
        entityType: AUDIT_ENTITIES.TRANSACTION,
        entityId: current.id,
        action: AUDIT_ACTIONS.TRANSACTION_FAILED,
        oldData: auditView(current),
        newData: auditView(updated),
      },
      tx,
    );

    return updated;
  }

  /**
   * Empeche un remboursement qui rendrait les affectations superieures aux
   * fonds reellement disponibles (regle n.5).
   */
  private async assertRefundKeepsAllocationsValid(
    donationId: string,
    refundAmount: Decimal,
    currency: string,
    tx?: DbClient,
  ): Promise<void> {
    const [received, allocated] = await Promise.all([
      this.transactionRepository.sumNetReceived(donationId, tx),
      this.allocationRepository.sumByDonation(donationId, tx),
    ]);

    const receivedAfterRefund = received.minus(refundAmount);

    if (receivedAfterRefund.lessThan(allocated)) {
      throw new InsufficientFundsError(
        `Remboursement impossible : apres remboursement de ` +
          `${formatMoney(refundAmount, currency)}, le don n'aurait plus que ` +
          `${formatMoney(receivedAfterRefund, currency)} recus alors que ` +
          `${formatMoney(allocated, currency)} sont deja affectes a des projets. ` +
          `Annulez d'abord les affectations concernees.`,
        {
          donationId,
          received: received.toString(),
          allocated: allocated.toString(),
          refundAmount: refundAmount.toString(),
        },
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Fonctions pures : testables sans base de donnees
// ---------------------------------------------------------------------------

/**
 * Verifie qu'une methode de paiement est utilisable pour ce don :
 * active, compatible avec la devise, et coherente avec le pays du donateur.
 */
export function assertPaymentMethodUsable(
  paymentMethod: PaymentMethod,
  donation: DonationWithDonor,
): void {
  if (!paymentMethod.isActive) {
    throw new BusinessRuleError(
      `La methode de paiement ${paymentMethod.code} est desactivee.`,
      { paymentMethodCode: paymentMethod.code },
    );
  }

  const currency = normalizeCurrency(donation.currency);

  if (
    paymentMethod.supportedCurrencies.length > 0 &&
    !paymentMethod.supportedCurrencies.map((value) => value.trim()).includes(currency)
  ) {
    throw new ValidationError(
      `La methode ${paymentMethod.code} n'accepte pas la devise ${currency} ` +
        `(devises acceptees : ${paymentMethod.supportedCurrencies.join(', ')}).`,
      { paymentMethodCode: paymentMethod.code, currency },
    );
  }

  const scopes = allowedPaymentScopes(donation.donor.country);
  if (!scopes.includes(paymentMethod.scope)) {
    throw new ValidationError(
      `La methode ${paymentMethod.code} (portee ${paymentMethod.scope}) n'est pas ` +
        `utilisable depuis le pays ${donation.donor.country}. ` +
        `Portees autorisees : ${scopes.join(', ')}.`,
      {
        paymentMethodCode: paymentMethod.code,
        scope: paymentMethod.scope,
        country: donation.donor.country,
      },
    );
  }
}

/** Montant de l'echeance : celui fourni, sinon le montant attendu du don. */
export function resolveTransactionAmount(
  provided: CreateTransactionInput['amount'],
  expectedAmount: Decimal | string | number,
  currency: string,
): Decimal {
  const amount = provided === undefined ? toDecimal(expectedAmount) : toDecimal(provided, 'amount');

  if (!amount.greaterThan(0)) {
    throw new ValidationError(
      `Le montant d'une transaction doit etre strictement positif ` +
        `(recu : ${formatMoney(amount, currency)}).`,
      { amount: amount.toString(), currency },
    );
  }
  return amount;
}

function buildPaymentContext(transaction: Transaction, paymentMethodCode: string): PaymentContext {
  return {
    transactionId: transaction.id,
    internalReference: transaction.internalReference,
    amount: toDecimal(transaction.amount),
    currency: transaction.currency,
    paymentMethodCode,
    providerReference: transaction.providerReference,
    metadata: (transaction.metadata as Record<string, unknown> | null) ?? null,
  };
}

/** Conserve l'historique des reponses prestataire dans transactions.metadata. */
function mergeMetadata(
  existing: Prisma.JsonValue | null,
  incoming: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  if (!incoming) return undefined;

  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};

  const history = Array.isArray(base['providerHistory']) ? base['providerHistory'] : [];

  return {
    ...base,
    providerHistory: [...history, { ...incoming, at: new Date().toISOString() }],
  } as Prisma.InputJsonValue;
}

/** Projection compacte d'une transaction pour le journal d'audit. */
function auditView(transaction: Transaction): Record<string, unknown> {
  return {
    id: transaction.id,
    internalReference: transaction.internalReference,
    donationId: transaction.donationId,
    amount: transaction.amount.toString(),
    currency: transaction.currency,
    status: transaction.status,
    refundedAmount: transaction.refundedAmount.toString(),
    netAmount: netReceivedAmount(transaction).toString(),
    providerReference: transaction.providerReference,
    failureReason: transaction.failureReason,
    transactionDate: transaction.transactionDate,
    installmentNumber: transaction.installmentNumber,
  };
}

