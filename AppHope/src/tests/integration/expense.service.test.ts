import { BudgetStatus, DocumentType, ExpenseStatus } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/database.js';
import { createFundedProject, createTestProject, getTestServices } from '../helpers/factories.js';
import type { Services } from '../../container.js';
import {
  BusinessRuleError,
  InsufficientFundsError,
  InvalidStatusTransitionError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.js';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../../modules/audit/audit.types.js';

describe('BudgetService et ExpenseService', () => {
  useTestDatabase();

  let services: Services;

  beforeEach(() => {
    services = getTestServices();
  });

  // -------------------------------------------------------------------------
  describe('budgets', () => {
    it('cree un budget avec ses lignes', async () => {
      const project = await createTestProject();

      const budget = await services.budgetService.createBudget({
        projectId: project.id,
        name: 'Scolarisation 2027',
        totalAmount: '5000000',
        currency: 'MGA',
        status: BudgetStatus.ACTIVE,
      });

      await services.budgetService.addBudgetItem({
        budgetId: budget.id,
        name: 'Frais scolaires',
        plannedAmount: '2000000',
      });
      await services.budgetService.addBudgetItem({
        budgetId: budget.id,
        name: 'Materiel scolaire',
        plannedAmount: '1500000',
      });
      await services.budgetService.addBudgetItem({
        budgetId: budget.id,
        name: 'Transport',
        plannedAmount: '1000000',
      });

      const summary = await services.budgetService.getBudgetSummary(budget.id);

      expect(summary.totalAmount.toString()).toBe('5000000');
      expect(summary.totalPlanned.toString()).toBe('4500000');
      expect(summary.unplannedAmount.toString()).toBe('500000');
      expect(summary.totalSpent.toString()).toBe('0');
      expect(summary.items).toHaveLength(3);
    });

    it('refuse une ligne qui ferait depasser l’enveloppe', async () => {
      const project = await createTestProject();
      const budget = await services.budgetService.createBudget({
        projectId: project.id,
        name: 'Budget serre',
        totalAmount: '1000',
        currency: 'EUR',
      });

      await services.budgetService.addBudgetItem({
        budgetId: budget.id,
        name: 'Ligne 1',
        plannedAmount: '800',
      });

      await expect(
        services.budgetService.addBudgetItem({
          budgetId: budget.id,
          name: 'Ligne 2',
          plannedAmount: '300',
        }),
      ).rejects.toThrow(BusinessRuleError);
    });

    it('respecte les transitions de statut d’un budget', async () => {
      const project = await createTestProject();
      const budget = await services.budgetService.createBudget({
        projectId: project.id,
        name: 'Budget',
        totalAmount: '1000',
        currency: 'EUR',
      });

      const active = await services.budgetService.activateBudget(budget.id);
      expect(active.status).toBe(BudgetStatus.ACTIVE);

      const closed = await services.budgetService.closeBudget(budget.id);
      expect(closed.status).toBe(BudgetStatus.CLOSED);

      await expect(services.budgetService.activateBudget(budget.id)).rejects.toThrow(
        InvalidStatusTransitionError,
      );
    });

    it('refuse une depense imputee a un budget cloture', async () => {
      const { project } = await createFundedProject({ amount: '100000' });
      const budget = await services.budgetService.createBudget({
        projectId: project.id,
        name: 'Budget',
        totalAmount: '100000',
        currency: 'MGA',
        status: BudgetStatus.ACTIVE,
      });
      await services.budgetService.closeBudget(budget.id);

      await expect(
        services.expenseService.createExpense({
          projectId: project.id,
          budgetId: budget.id,
          amount: '1000',
          currency: 'MGA',
          description: 'Depense tardive.',
          expenseDate: new Date(),
        }),
      ).rejects.toThrow(BusinessRuleError);
    });
  });

  // -------------------------------------------------------------------------
  describe('creation de depenses', () => {
    it('enregistre une depense en brouillon', async () => {
      const { project } = await createFundedProject({ amount: '100000' });

      const expense = await services.expenseService.createExpense({
        projectId: project.id,
        amount: '30000',
        currency: 'MGA',
        description: 'Achat de fournitures scolaires.',
        expenseDate: new Date(),
      });

      expect(expense.reference).toMatch(/^HOPE-EXP-\d{8}-[A-Z2-9]{6}$/);
      expect(expense.status).toBe(ExpenseStatus.DRAFT);
      expect(expense.amount.toString()).toBe('30000');
    });

    it('ne consomme pas les fonds tant que la depense est en brouillon', async () => {
      const { project } = await createFundedProject({ amount: '100000' });

      await services.expenseService.createExpense({
        projectId: project.id,
        amount: '30000',
        currency: 'MGA',
        description: 'Brouillon.',
        expenseDate: new Date(),
      });

      const available = await services.projectService.getAvailableFunds(project.id, 'MGA');
      expect(available.toString()).toBe('100000');
    });

    it('consomme les fonds une fois la depense validee', async () => {
      const { project } = await createFundedProject({ amount: '100000' });

      const expense = await services.expenseService.createExpense({
        projectId: project.id,
        amount: '30000',
        currency: 'MGA',
        description: 'Depense validee.',
        expenseDate: new Date(),
      });
      await services.expenseService.validateExpense(expense.id);

      const available = await services.projectService.getAvailableFunds(project.id, 'MGA');
      expect(available.toString()).toBe('70000');
    });

    it('deroule le cycle DRAFT -> VALIDATED -> PAID', async () => {
      const { project } = await createFundedProject({ amount: '100000' });

      const expense = await services.expenseService.createExpense({
        projectId: project.id,
        amount: '10000',
        currency: 'MGA',
        description: 'Depense.',
        expenseDate: new Date(),
      });

      const validated = await services.expenseService.validateExpense(expense.id);
      expect(validated.status).toBe(ExpenseStatus.VALIDATED);
      expect(validated.validatedAt).toBeInstanceOf(Date);

      const paid = await services.expenseService.markExpensePaid(expense.id);
      expect(paid.status).toBe(ExpenseStatus.PAID);
      expect(paid.paidAt).toBeInstanceOf(Date);
    });

    it('rend une depense PAID definitive', async () => {
      const { project } = await createFundedProject({ amount: '100000' });
      const expense = await services.expenseService.createExpense({
        projectId: project.id,
        amount: '10000',
        currency: 'MGA',
        description: 'Depense.',
        expenseDate: new Date(),
      });
      await services.expenseService.validateExpense(expense.id);
      await services.expenseService.markExpensePaid(expense.id);

      await expect(services.expenseService.cancelExpense(expense.id)).rejects.toThrow(
        InvalidStatusTransitionError,
      );
    });

    it('libere les fonds quand une depense est annulee', async () => {
      const { project } = await createFundedProject({ amount: '100000' });
      const expense = await services.expenseService.createExpense({
        projectId: project.id,
        amount: '40000',
        currency: 'MGA',
        description: 'Depense annulee.',
        expenseDate: new Date(),
      });
      await services.expenseService.validateExpense(expense.id);

      expect((await services.projectService.getAvailableFunds(project.id, 'MGA')).toString()).toBe(
        '60000',
      );

      await services.expenseService.cancelExpense(expense.id, 'Commande annulee.');

      expect((await services.projectService.getAvailableFunds(project.id, 'MGA')).toString()).toBe(
        '100000',
      );
    });

    it('journalise la depense dans l’audit', async () => {
      const { project } = await createFundedProject({ amount: '100000' });
      const expense = await services.expenseService.createExpense({
        projectId: project.id,
        amount: '10000',
        currency: 'MGA',
        description: 'Depense.',
        expenseDate: new Date(),
      });
      await services.expenseService.validateExpense(expense.id);

      const history = await services.auditService.getEntityHistory(
        AUDIT_ENTITIES.EXPENSE,
        expense.id,
      );
      const actions = history.map((entry) => entry.action);
      expect(actions).toContain(AUDIT_ACTIONS.EXPENSE_CREATED);
      expect(actions).toContain(AUDIT_ACTIONS.EXPENSE_VALIDATED);
    });
  });

  // -------------------------------------------------------------------------
  describe('plafond de tresorerie : on ne depense pas ce qu’on n’a pas', () => {
    it('refuse une depense superieure aux fonds recus par le projet', async () => {
      const { project } = await createFundedProject({ amount: '100000' });

      await expect(
        services.expenseService.createExpense({
          projectId: project.id,
          amount: '150000',
          currency: 'MGA',
          description: 'Depense trop elevee.',
          expenseDate: new Date(),
        }),
      ).rejects.toThrow(InsufficientFundsError);
    });

    it('refuse toute depense sur un projet qui n’a recu aucun fonds', async () => {
      const project = await createTestProject();

      await expect(
        services.expenseService.createExpense({
          projectId: project.id,
          amount: '1000',
          currency: 'MGA',
          description: 'Projet sans financement.',
          expenseDate: new Date(),
        }),
      ).rejects.toThrow(InsufficientFundsError);
    });

    it('refuse une seconde depense qui depasserait le solde restant', async () => {
      const { project } = await createFundedProject({ amount: '100000' });

      const first = await services.expenseService.createExpense({
        projectId: project.id,
        amount: '70000',
        currency: 'MGA',
        description: 'Premiere depense.',
        expenseDate: new Date(),
      });
      await services.expenseService.validateExpense(first.id);

      await expect(
        services.expenseService.createExpense({
          projectId: project.id,
          amount: '50000',
          currency: 'MGA',
          description: 'Seconde depense.',
          expenseDate: new Date(),
        }),
      ).rejects.toThrow(InsufficientFundsError);
    });

    it('refuse une validation devenue impossible entre-temps', async () => {
      const { project } = await createFundedProject({ amount: '100000' });

      // Deux brouillons de 60 000 : chacun passe seul, mais pas les deux.
      const first = await services.expenseService.createExpense({
        projectId: project.id,
        amount: '60000',
        currency: 'MGA',
        description: 'Brouillon 1.',
        expenseDate: new Date(),
      });
      const second = await services.expenseService.createExpense({
        projectId: project.id,
        amount: '60000',
        currency: 'MGA',
        description: 'Brouillon 2.',
        expenseDate: new Date(),
      });

      await services.expenseService.validateExpense(first.id);

      await expect(services.expenseService.validateExpense(second.id)).rejects.toThrow(
        InsufficientFundsError,
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('plafond budgetaire : la prevision est un second garde-fou', () => {
    it('refuse une depense superieure au budget restant', async () => {
      const { project } = await createFundedProject({ amount: '100000' });
      const budget = await services.budgetService.createBudget({
        projectId: project.id,
        name: 'Petit budget',
        totalAmount: '50000',
        currency: 'MGA',
        status: BudgetStatus.ACTIVE,
      });

      // Le projet a 100 000 MGA de tresorerie, mais le budget n'autorise
      // que 50 000 MGA de depenses.
      await expect(
        services.expenseService.createExpense({
          projectId: project.id,
          budgetId: budget.id,
          amount: '80000',
          currency: 'MGA',
          description: 'Depense hors budget.',
          expenseDate: new Date(),
        }),
      ).rejects.toThrow(InsufficientFundsError);
    });

    it('refuse une depense superieure a la ligne budgetaire visee', async () => {
      const { project } = await createFundedProject({ amount: '100000' });
      const budget = await services.budgetService.createBudget({
        projectId: project.id,
        name: 'Budget',
        totalAmount: '100000',
        currency: 'MGA',
        status: BudgetStatus.ACTIVE,
      });
      const item = await services.budgetService.addBudgetItem({
        budgetId: budget.id,
        name: 'Transport',
        plannedAmount: '20000',
      });

      await expect(
        services.expenseService.createExpense({
          projectId: project.id,
          budgetId: budget.id,
          budgetItemId: item.id,
          amount: '30000',
          currency: 'MGA',
          description: 'Transport trop cher.',
          expenseDate: new Date(),
        }),
      ).rejects.toThrow(InsufficientFundsError);
    });

    it('met a jour le budget restant apres validation', async () => {
      const { project } = await createFundedProject({ amount: '100000' });
      const budget = await services.budgetService.createBudget({
        projectId: project.id,
        name: 'Budget',
        totalAmount: '100000',
        currency: 'MGA',
        status: BudgetStatus.ACTIVE,
      });

      const expense = await services.expenseService.createExpense({
        projectId: project.id,
        budgetId: budget.id,
        amount: '40000',
        currency: 'MGA',
        description: 'Depense.',
        expenseDate: new Date(),
      });
      await services.expenseService.validateExpense(expense.id);

      const remaining = await services.budgetService.getRemainingBudget(budget.id);
      expect(remaining.toString()).toBe('60000');

      const summary = await services.budgetService.getBudgetSummary(budget.id);
      expect(summary.totalSpent.toString()).toBe('40000');
      expect(summary.consumptionRate).toBe(40);
    });

    it('refuse un budget appartenant a un autre projet', async () => {
      const { project } = await createFundedProject({ amount: '100000' });
      const otherProject = await createTestProject();
      const otherBudget = await services.budgetService.createBudget({
        projectId: otherProject.id,
        name: 'Budget d’un autre projet',
        totalAmount: '100000',
        currency: 'MGA',
        status: BudgetStatus.ACTIVE,
      });

      await expect(
        services.expenseService.createExpense({
          projectId: project.id,
          budgetId: otherBudget.id,
          amount: '1000',
          currency: 'MGA',
          description: 'Mauvais budget.',
          expenseDate: new Date(),
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('refuse une devise differente de celle du budget', async () => {
      const { project } = await createFundedProject({ amount: '100000' });
      const budget = await services.budgetService.createBudget({
        projectId: project.id,
        name: 'Budget en MGA',
        totalAmount: '100000',
        currency: 'MGA',
        status: BudgetStatus.ACTIVE,
      });

      await expect(
        services.expenseService.createExpense({
          projectId: project.id,
          budgetId: budget.id,
          amount: '10',
          currency: 'EUR',
          description: 'Devise incoherente.',
          expenseDate: new Date(),
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('refuse une ligne budgetaire sans budget', async () => {
      const { project } = await createFundedProject({ amount: '100000' });
      const budget = await services.budgetService.createBudget({
        projectId: project.id,
        name: 'Budget',
        totalAmount: '100000',
        currency: 'MGA',
        status: BudgetStatus.ACTIVE,
      });
      const item = await services.budgetService.addBudgetItem({
        budgetId: budget.id,
        name: 'Ligne',
        plannedAmount: '10000',
      });

      await expect(
        services.expenseService.createExpense({
          projectId: project.id,
          budgetItemId: item.id,
          amount: '1000',
          currency: 'MGA',
          description: 'Ligne sans budget.',
          expenseDate: new Date(),
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  describe('simulation de faisabilite', () => {
    it('renseigne les trois plafonds sans rien ecrire', async () => {
      const { project } = await createFundedProject({ amount: '100000' });
      const budget = await services.budgetService.createBudget({
        projectId: project.id,
        name: 'Budget',
        totalAmount: '50000',
        currency: 'MGA',
        status: BudgetStatus.ACTIVE,
      });

      const affordable = await services.expenseService.checkAffordability({
        projectId: project.id,
        currency: 'MGA',
        amount: (await services.expenseService.getTotalSpent(project.id, 'MGA')).plus('30000'),
        budgetId: budget.id,
      });

      expect(affordable.projectAvailableFunds.toString()).toBe('100000');
      expect(affordable.budgetRemaining?.toString()).toBe('50000');
      expect(affordable.budgetItemRemaining).toBeNull();
      expect(affordable.isAffordable).toBe(true);

      const expenses = await services.expenseService.listExpenses({ projectId: project.id });
      expect(expenses).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('justificatifs', () => {
    it('rattache un justificatif a une depense', async () => {
      const { project } = await createFundedProject({ amount: '100000' });
      const expense = await services.expenseService.createExpense({
        projectId: project.id,
        amount: '10000',
        currency: 'MGA',
        description: 'Depense justifiee.',
        expenseDate: new Date(),
      });

      const document = await services.documentService.attachDocument({
        expenseId: expense.id,
        documentType: DocumentType.INVOICE,
        fileName: 'facture.pdf',
        filePath: 'storage/factures/facture.pdf',
        mimeType: 'application/pdf',
        fileSize: 12_345,
        reference: 'FAC-2026-001',
      });

      expect(document.fileName).toBe('facture.pdf');
      expect(await services.documentService.hasSupportingDocument(expense.id)).toBe(true);

      const documents = await services.documentService.getDocumentsForExpense(expense.id);
      expect(documents).toHaveLength(1);
    });

    it('refuse un justificatif sur une depense inexistante', async () => {
      await expect(
        services.documentService.attachDocument({
          expenseId: '00000000-0000-4000-8000-000000000000',
          documentType: DocumentType.RECEIPT,
          fileName: 'recu.pdf',
          filePath: 'storage/recu.pdf',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('refuse une taille de fichier invalide', async () => {
      const { project } = await createFundedProject({ amount: '100000' });
      const expense = await services.expenseService.createExpense({
        projectId: project.id,
        amount: '10000',
        currency: 'MGA',
        description: 'Depense.',
        expenseDate: new Date(),
      });

      await expect(
        services.documentService.attachDocument({
          expenseId: expense.id,
          documentType: DocumentType.RECEIPT,
          fileName: 'recu.pdf',
          filePath: 'storage/recu.pdf',
          fileSize: -1,
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  describe('rapport de depenses', () => {
    it('resume les depenses d’un projet par devise', async () => {
      const { project } = await createFundedProject({ amount: '100000' });

      const paid = await services.expenseService.createExpense({
        projectId: project.id,
        amount: '30000',
        currency: 'MGA',
        description: 'Depense payee.',
        expenseDate: new Date(),
      });
      await services.expenseService.validateExpense(paid.id);
      await services.expenseService.markExpensePaid(paid.id);

      await services.expenseService.createExpense({
        projectId: project.id,
        amount: '20000',
        currency: 'MGA',
        description: 'Depense en brouillon.',
        expenseDate: new Date(),
      });

      const report = await services.expenseService.getProjectSpendingReport(project.id, 'MGA');

      expect(report.totalSpent.toString()).toBe('30000');
      expect(report.totalDraft.toString()).toBe('20000');
      expect(report.availableFunds.toString()).toBe('70000');
      expect(report.expenseCount).toBe(2);
    });
  });
});
