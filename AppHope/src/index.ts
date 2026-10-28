/**
 * HOPE - Hope for a Better Life : point d'entree du backend.
 *
 * PHASE 1 : AUCUNE API HTTP.
 * Il n'y a ni serveur, ni routes, ni controleurs. Les fonctionnalites
 * s'utilisent directement en appelant les services :
 *
 *   import { createContainer } from './container.js';
 *
 *   const { services } = createContainer();
 *   const donation = await services.donationService.createDonation({ ... });
 *   const transaction = await services.paymentService.createTransaction({ ... });
 *   await services.paymentService.confirmTransaction(transaction.id);
 *
 * Voir les scripts de demonstration dans src/scripts/ pour des exemples
 * complets et executables (npm run demo:donation, npm run demo:monthly).
 */

export { createContainer } from './container.js';
export type { Container, Repositories, Services } from './container.js';

export { prisma, disconnectPrisma } from './database/prisma.js';
export { runInTransaction } from './database/unit-of-work.js';
export { env } from './config/env.js';
export { logger } from './shared/logger.js';

// --- Utilitaires partages ---------------------------------------------------
export * from './shared/errors.js';
export * from './shared/money.js';
export * from './shared/currency.js';
export * from './shared/geography.js';
export * from './shared/reference.js';
export { createStateMachine } from './shared/state-machine.js';
export type { StateMachine } from './shared/state-machine.js';

// --- Modules ----------------------------------------------------------------
export { DonorService } from './modules/donors/donor.service.js';
export type * from './modules/donors/donor.types.js';

export { DonationService } from './modules/donations/donation.service.js';
export * from './modules/donations/donation.rules.js';
export type * from './modules/donations/donation.types.js';

export { PaymentService } from './modules/payments/payment.service.js';
export * from './modules/payments/transaction-status.js';
export type * from './modules/payments/payment.types.js';
export type { PaymentProvider } from './modules/payments/providers/payment-provider.interface.js';
export { MockPaymentProvider } from './modules/payments/providers/mock-payment.provider.js';
export {
  PaymentProviderRegistry,
  paymentProviderRegistry,
  createDefaultProviderRegistry,
} from './modules/payments/providers/provider.registry.js';

export { AllocationService } from './modules/allocations/allocation.service.js';
export type * from './modules/allocations/allocation.types.js';

export { ProjectService, projectStateMachine } from './modules/projects/project.service.js';
export type * from './modules/projects/project.types.js';

export { BudgetService, budgetStateMachine } from './modules/budgets/budget.service.js';
export type * from './modules/budgets/budget.types.js';

export { ExpenseService, expenseStateMachine } from './modules/expenses/expense.service.js';
export type * from './modules/expenses/expense.types.js';

export { DocumentService } from './modules/documents/document.service.js';
export type * from './modules/documents/document.types.js';

export { BeneficiaryService, computeAge } from './modules/beneficiaries/beneficiary.service.js';
export type * from './modules/beneficiaries/beneficiary.types.js';

export { ImpactService } from './modules/impacts/impact.service.js';
export type * from './modules/impacts/impact.types.js';

export { AuditService } from './modules/audit/audit.service.js';
export { AUDIT_ACTIONS, AUDIT_ENTITIES } from './modules/audit/audit.types.js';
export type { AuditAction, AuditEntityType } from './modules/audit/audit.types.js';
