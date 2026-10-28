import { AuditRepository } from './modules/audit/audit.repository.js';
import { AuditService } from './modules/audit/audit.service.js';
import { DonorRepository } from './modules/donors/donor.repository.js';
import { DonorService } from './modules/donors/donor.service.js';
import { DonationRepository } from './modules/donations/donation.repository.js';
import { DonationService } from './modules/donations/donation.service.js';
import { PaymentMethodRepository } from './modules/payments/payment-method.repository.js';
import { TransactionRepository } from './modules/payments/transaction.repository.js';
import { PaymentService } from './modules/payments/payment.service.js';
import { paymentProviderRegistry } from './modules/payments/providers/provider.registry.js';
import { AllocationRepository } from './modules/allocations/allocation.repository.js';
import { AllocationService } from './modules/allocations/allocation.service.js';
import { ProjectCategoryRepository } from './modules/projects/project-category.repository.js';
import { ProjectRepository } from './modules/projects/project.repository.js';
import { ProjectService } from './modules/projects/project.service.js';
import { BudgetRepository } from './modules/budgets/budget.repository.js';
import { BudgetService } from './modules/budgets/budget.service.js';
import { ExpenseRepository } from './modules/expenses/expense.repository.js';
import { ExpenseService } from './modules/expenses/expense.service.js';
import { DocumentRepository } from './modules/documents/document.repository.js';
import { DocumentService } from './modules/documents/document.service.js';
import { BeneficiaryRepository } from './modules/beneficiaries/beneficiary.repository.js';
import { BeneficiaryService } from './modules/beneficiaries/beneficiary.service.js';
import { ImpactRepository } from './modules/impacts/impact.repository.js';
import { ImpactService } from './modules/impacts/impact.service.js';

/**
 * COMPOSITION ROOT : le seul endroit ou l'on assemble repositories et services.
 *
 * Chaque service accepte ses dependances par constructeur : on peut donc en
 * fabriquer un avec des doublures dans les tests, sans toucher au code metier.
 * Ici on construit simplement le graphe reel de l'application.
 */
export function createContainer() {
  // --- Repositories (acces base de donnees) --------------------------------
  const auditRepository = new AuditRepository();
  const donorRepository = new DonorRepository();
  const donationRepository = new DonationRepository();
  const transactionRepository = new TransactionRepository();
  const paymentMethodRepository = new PaymentMethodRepository();
  const allocationRepository = new AllocationRepository();
  const projectRepository = new ProjectRepository();
  const projectCategoryRepository = new ProjectCategoryRepository();
  const budgetRepository = new BudgetRepository();
  const expenseRepository = new ExpenseRepository();
  const documentRepository = new DocumentRepository();
  const beneficiaryRepository = new BeneficiaryRepository();
  const impactRepository = new ImpactRepository();

  // --- Services (logique metier) -------------------------------------------
  const auditService = new AuditService(auditRepository);

  const donorService = new DonorService(donorRepository, auditService);

  const donationService = new DonationService(
    donationRepository,
    transactionRepository,
    allocationRepository,
    donorRepository,
    auditService,
  );

  const paymentService = new PaymentService(
    transactionRepository,
    paymentMethodRepository,
    allocationRepository,
    donationRepository,
    auditService,
    paymentProviderRegistry,
  );

  const projectService = new ProjectService(
    projectRepository,
    projectCategoryRepository,
    allocationRepository,
    expenseRepository,
    auditService,
  );

  const allocationService = new AllocationService(
    allocationRepository,
    donationRepository,
    transactionRepository,
    projectRepository,
    auditService,
  );

  const budgetService = new BudgetService(
    budgetRepository,
    expenseRepository,
    projectService,
    auditService,
  );

  const expenseService = new ExpenseService(
    expenseRepository,
    budgetRepository,
    budgetService,
    projectService,
    projectRepository,
    auditService,
  );

  const documentService = new DocumentService(documentRepository, expenseRepository, auditService);

  const beneficiaryService = new BeneficiaryService(
    beneficiaryRepository,
    projectService,
    auditService,
  );

  const impactService = new ImpactService(
    impactRepository,
    beneficiaryRepository,
    projectService,
    auditService,
  );

  return {
    repositories: {
      auditRepository,
      donorRepository,
      donationRepository,
      transactionRepository,
      paymentMethodRepository,
      allocationRepository,
      projectRepository,
      projectCategoryRepository,
      budgetRepository,
      expenseRepository,
      documentRepository,
      beneficiaryRepository,
      impactRepository,
    },
    services: {
      auditService,
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
    },
    providers: paymentProviderRegistry,
  };
}

export type Container = ReturnType<typeof createContainer>;
export type Services = Container['services'];
export type Repositories = Container['repositories'];
