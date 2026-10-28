import { AllocationType, DonationStatus, TransactionStatus } from '@prisma/client';
import type { CheckoutInput, CheckoutOutcome, CheckoutResult } from './checkout.types.js';
import { AllocationService } from '../allocations/allocation.service.js';
import { DonationService } from '../donations/donation.service.js';
import { DonorService } from '../donors/donor.service.js';
import { PaymentService } from '../payments/payment.service.js';
import { ProjectService } from '../projects/project.service.js';
import { AppError, BusinessRuleError } from '../../shared/errors.js';
import { logger } from '../../shared/logger.js';
import { normalizeEmail } from '../../shared/validation.js';

/**
 * SERVICE D'ORCHESTRATION DU PARCOURS DE DON.
 *
 * Il ne contient AUCUNE regle financiere nouvelle : il se contente
 * d'enchainer, dans le bon ordre, les services metier existants.
 *
 *   Donateur -> Don -> Transaction -> Prestataire -> Affectation
 *
 * POURQUOI CE SERVICE PLUTOT QUE CINQ APPELS DEPUIS LE NAVIGATEUR
 *   Un formulaire de don qui enchainerait cinq requetes HTTP peut s'arreter au
 *   milieu : connexion coupee, onglet ferme, double clic. On obtiendrait alors
 *   un donateur sans don, ou un don sans paiement, et le donateur ne saurait
 *   pas ou il en est. L'enchainement est donc pilote par le serveur, qui seul
 *   decide de l'issue.
 *
 * CE QUE LE FRONTEND NE DECIDE JAMAIS
 *   Le champ `outcome` est derive du statut REEL de la transaction en base
 *   apres passage chez le prestataire. Le navigateur ne fait que l'afficher.
 */
export class CheckoutService {
  constructor(
    private readonly donorService: DonorService = new DonorService(),
    private readonly donationService: DonationService = new DonationService(),
    private readonly paymentService: PaymentService = new PaymentService(),
    private readonly allocationService: AllocationService = new AllocationService(),
    private readonly projectService: ProjectService = new ProjectService(),
  ) {}

  async processDonation(input: CheckoutInput): Promise<CheckoutResult> {
    // --- 1. Le projet cible, verifie AVANT tout encaissement ---------------
    // Inutile de prendre l'argent d'un donateur pour un projet qui n'accepte
    // plus de fonds : on echoue tot, avant le moindre mouvement financier.
    if (input.projectId) {
      await this.projectService.assertProjectIsFundable(input.projectId);
    }

    // --- 2. Le donateur ----------------------------------------------------
    const donor = await this.findOrCreateDonor(input);

    // --- 3. Le don : un ENGAGEMENT, pas encore de l'argent ------------------
    const donation = await this.donationService.createDonation({
      donorId: donor.id,
      donationType: input.donation.donationType,
      currency: input.donation.currency,
      expectedAmount: input.donation.amount,
      frequency: input.donation.frequency ?? null,
      status: DonationStatus.ACTIVE,
      notes: input.donation.notes ?? null,
      ...(input.donation.frequency ? { startDate: new Date() } : {}),
    });

    // --- 4. La transaction : le mouvement d'argent --------------------------
    const created = await this.paymentService.createTransaction({
      donationId: donation.id,
      paymentMethodCode: input.paymentMethodCode,
      metadata: input.metadata ?? null,
    });

    // --- 5. Le passage chez le prestataire ---------------------------------
    const transaction = await this.confirmOrCaptureFailure(created.id);

    // --- 6. L'affectation, uniquement si l'argent est reellement arrive -----
    const allocation =
      transaction.status === TransactionStatus.SUCCESS && input.projectId
        ? await this.allocateReceivedFunds(donation.id, input.projectId)
        : null;

    const summary = await this.donationService.getFinancialSummary(donation.id);

    return {
      outcome: toOutcome(transaction.status),
      donor,
      donation,
      transaction,
      allocation,
      summary,
      failureReason: transaction.failureReason,
    };
  }

  // -------------------------------------------------------------------------
  // Internes
  // -------------------------------------------------------------------------

  /**
   * Reutilise le donateur si son email est deja connu.
   *
   * Sans cela, un donateur fidele verrait son deuxieme don refuse pour cause
   * d'email deja enregistre. Les coordonnees existantes ne sont pas ecrasees :
   * une correction de profil est une action deliberee, pas un effet de bord
   * d'un don.
   */
  private async findOrCreateDonor(input: CheckoutInput) {
    const email = normalizeEmail(input.donor.email);
    const existing = await this.donorService.findDonorByEmail(email);

    if (existing) {
      logger.debug('Donateur existant reutilise pour ce don.', { donorId: existing.id });
      return existing;
    }

    return this.donorService.createDonor({
      firstName: input.donor.firstName,
      lastName: input.donor.lastName,
      email,
      phone: input.donor.phone,
      donorType: input.donor.donorType,
      country: input.donor.country,
      preferredCurrency: input.donation.currency,
      organizationName: input.donor.organizationName ?? null,
      city: input.donor.city ?? null,
      preferredLanguage: input.donor.preferredLanguage ?? 'fr',
      discoverySource: 'Site web HOPE',
    });
  }

  /**
   * Demande la confirmation au prestataire.
   *
   * Un refus n'est PAS une erreur technique : c'est une issue normale du
   * parcours, que le donateur doit pouvoir comprendre. PaymentService a deja
   * ecrit le statut FAILED en base avant de lever son erreur ; on relit donc
   * la transaction pour renvoyer son etat reel plutot que de propager une
   * exception jusqu'au navigateur.
   */
  private async confirmOrCaptureFailure(transactionId: string) {
    try {
      return await this.paymentService.confirmTransaction(transactionId);
    } catch (error) {
      if (error instanceof BusinessRuleError) {
        logger.info('Paiement refuse par le prestataire.', { transactionId });
        return this.paymentService.getTransactionById(transactionId);
      }
      throw error;
    }
  }

  /**
   * Affecte au projet la totalite de ce qui vient d'etre encaisse.
   *
   * On passe par `getUnallocatedAmount` plutot que par le montant saisi : seul
   * l'argent reellement recu est affectable (regle financiere n.5), et c'est
   * AllocationService qui en reste juge.
   *
   * Une affectation qui echoue ne doit pas annuler un paiement deja encaisse :
   * l'argent reste alors non affecte, et HOPE le repartira manuellement.
   */
  private async allocateReceivedFunds(donationId: string, projectId: string) {
    try {
      const available = await this.allocationService.getUnallocatedAmount(donationId);
      if (!available.greaterThan(0)) return null;

      return await this.allocationService.allocate({
        donationId,
        projectId,
        amount: available,
        allocationType: AllocationType.DONOR_DESIGNATED,
        notes: 'Projet choisi par le donateur sur le site.',
      });
    } catch (error) {
      logger.error("L'affectation automatique a echoue : le don reste non affecte.", {
        donationId,
        projectId,
        reason: error instanceof AppError ? error.message : String(error),
      });
      return null;
    }
  }
}

/** Traduit le statut technique de la transaction en issue lisible. */
export function toOutcome(status: TransactionStatus): CheckoutOutcome {
  switch (status) {
    case TransactionStatus.SUCCESS:
      return 'SUCCESS';
    case TransactionStatus.PENDING:
    case TransactionStatus.PROCESSING:
      return 'PENDING';
    default:
      return 'FAILED';
  }
}
