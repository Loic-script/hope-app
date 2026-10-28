import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/database.js';
import { createTestProject, getTestServices } from '../helpers/factories.js';
import { createServer } from '../../api/server.js';
import { createContainer } from '../../container.js';

/**
 * Tests de la couche HTTP.
 *
 * Le serveur est demarre EN MEMOIRE sur un port libre : pas de processus a
 * lancer a cote, pas de port fixe qui entrerait en conflit avec le serveur de
 * developpement. C'est la vraie application Express, avec ses vrais services
 * et sa vraie base de test.
 */

let server: Server;
let baseUrl: string;

interface ApiResponse<T> {
  status: number;
  body: T;
}

async function api<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  return { status: response.status, body: (await response.json()) as T };
}

function post<T>(path: string, payload: unknown): Promise<ApiResponse<T>> {
  return api<T>(path, { method: 'POST', body: JSON.stringify(payload) });
}

/** Corps de requete valide, dont chaque test ne modifie que ce qui l'interesse. */
function checkoutPayload(overrides: Record<string, unknown> = {}) {
  return {
    donor: {
      firstName: 'Tiana',
      lastName: 'Rakotomalala',
      email: `tiana.api.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.mg`,
      phone: '+261 34 12 345 67',
      donorType: 'INDIVIDUAL',
      country: 'MG',
    },
    donation: {
      donationType: 'ONE_TIME',
      currency: 'MGA',
      amount: '100000',
    },
    paymentMethodCode: 'MVOLA',
    ...overrides,
  };
}

describe('API HTTP', () => {
  useTestDatabase();

  beforeAll(async () => {
    const app = createServer({ container: createContainer() });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // -------------------------------------------------------------------------
  describe('lectures publiques', () => {
    it('repond a la sonde de sante', async () => {
      const { status, body } = await api<{ data: { status: string } }>('/api/health');
      expect(status).toBe(200);
      expect(body.data.status).toBe('ok');
    });

    it('liste les categories de projet', async () => {
      const { status, body } = await api<{ data: { name: string }[] }>('/api/project-categories');
      expect(status).toBe(200);
      expect(body.data.map((category) => category.name)).toContain('Scolarite');
    });

    it('ne propose que les methodes locales a un donateur malgache', async () => {
      const { body } = await api<{ data: { code: string }[] }>('/api/payment-methods?country=MG');
      const codes = body.data.map((method) => method.code);

      expect(codes).toContain('MVOLA');
      expect(codes).not.toContain('CARD');
    });

    it('ne propose que les methodes internationales a un donateur francais', async () => {
      const { body } = await api<{ data: { code: string }[] }>('/api/payment-methods?country=FR');
      const codes = body.data.map((method) => method.code);

      expect(codes).toContain('CARD');
      expect(codes).not.toContain('MVOLA');
    });

    it('refuse un code pays mal forme', async () => {
      const { status, body } = await api<{ error: { code: string } }>(
        '/api/payment-methods?country=MADAGASCAR',
      );
      expect(status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('publie les projets actifs avec leur financement', async () => {
      const project = await createTestProject();

      const { status, body } = await api<{
        data: { id: string; funding: { currency: string; fundedAmount: string } }[];
      }>('/api/projects');

      expect(status).toBe(200);
      const found = body.data.find((entry) => entry.id === project.id);
      expect(found).toBeDefined();
      // Un montant est TOUJOURS une chaine : jamais un flottant JavaScript.
      expect(typeof found?.funding.fundedAmount).toBe('string');
    });

    it('masque les projets en brouillon', async () => {
      const draft = await createTestProject({ status: 'DRAFT' });

      const { body } = await api<{ data: { id: string }[] }>('/api/projects');
      expect(body.data.map((entry) => entry.id)).not.toContain(draft.id);

      const detail = await api<{ error: { code: string } }>(`/api/projects/${draft.id}`);
      expect(detail.status).toBe(404);
    });

    it('accepte le code lisible du projet dans l’URL', async () => {
      const project = await createTestProject();

      const { status, body } = await api<{ data: { id: string } }>(
        `/api/projects/${project.code}`,
      );
      expect(status).toBe(200);
      expect(body.data.id).toBe(project.id);
    });

    it('renvoie 404 pour un projet inexistant', async () => {
      const { status, body } = await api<{ error: { code: string } }>(
        '/api/projects/00000000-0000-4000-8000-000000000000',
      );
      expect(status).toBe(404);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('renvoie 404 pour une route inconnue', async () => {
      const { status, body } = await api<{ error: { code: string } }>('/api/nexistepas');
      expect(status).toBe(404);
      expect(body.error.code).toBe('ROUTE_NOT_FOUND');
    });

    it('expose les chiffres cles calcules depuis la base', async () => {
      const { status, body } = await api<{
        data: { beneficiaries: { total: number }; projects: { active: number } };
      }>('/api/stats');

      expect(status).toBe(200);
      expect(body.data.beneficiaries.total).toBe(0);
      expect(body.data.projects.active).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('parcours de don complet', () => {
    it('encaisse un don ponctuel affecte a un projet', async () => {
      const project = await createTestProject();

      const { status, body } = await post<{
        data: {
          outcome: string;
          donor: { id: string };
          donation: { reference: string; expectedAmount: string };
          transaction: { internalReference: string; status: string; amount: string };
          allocation: { amount: string; projectId: string } | null;
          summary: { totalReceived: string; totalAllocated: string };
        };
      }>('/api/checkout', checkoutPayload({ projectId: project.id }));

      expect(status).toBe(201);
      expect(body.data.outcome).toBe('SUCCESS');

      // La reference vient bien du backend, au format attendu.
      expect(body.data.transaction.internalReference).toMatch(/^HOPE-TXN-\d{8}-[A-Z2-9]{6}$/);
      expect(body.data.donation.reference).toMatch(/^HOPE-DON-\d{8}-[A-Z2-9]{6}$/);

      expect(body.data.transaction.status).toBe('SUCCESS');
      expect(body.data.transaction.amount).toBe('100000');
      expect(body.data.summary.totalReceived).toBe('100000');

      // Le don a bien ete affecte au projet demande.
      expect(body.data.allocation?.projectId).toBe(project.id);
      expect(body.data.allocation?.amount).toBe('100000');
      expect(body.data.summary.totalAllocated).toBe('100000');
    });

    it('fait apparaitre le don dans le financement du projet', async () => {
      const project = await createTestProject();
      await post('/api/checkout', checkoutPayload({ projectId: project.id }));

      const { body } = await api<{ data: { funding: { fundedAmount: string } } }>(
        `/api/projects/${project.id}`,
      );
      expect(body.data.funding.fundedAmount).toBe('100000');
    });

    it('accepte un don non affecte', async () => {
      const { status, body } = await post<{
        data: { outcome: string; allocation: null; summary: { unallocatedAmount: string } };
      }>('/api/checkout', checkoutPayload());

      expect(status).toBe(201);
      expect(body.data.outcome).toBe('SUCCESS');
      expect(body.data.allocation).toBeNull();
      expect(body.data.summary.unallocatedAmount).toBe('100000');
    });

    it('signale un paiement refuse sans crier a la panne serveur', async () => {
      const project = await createTestProject();

      const { status, body } = await post<{
        data: {
          outcome: string;
          failureReason: string | null;
          transaction: { status: string };
          allocation: null;
          summary: { totalReceived: string };
        };
      }>('/api/checkout', checkoutPayload({ projectId: project.id, simulate: 'FAILURE' }));

      // 201 et non 500 : les entites ont bien ete creees, seul le paiement
      // a ete refuse. C'est une information metier, pas un incident.
      expect(status).toBe(201);
      expect(body.data.outcome).toBe('FAILED');
      expect(body.data.transaction.status).toBe('FAILED');
      expect(body.data.failureReason).toContain('Solde insuffisant');

      // Aucun argent recu, donc aucune affectation.
      expect(body.data.allocation).toBeNull();
      expect(body.data.summary.totalReceived).toBe('0');
    });

    it('reutilise un donateur deja connu au lieu de refuser son second don', async () => {
      const payload = checkoutPayload();

      const first = await post<{ data: { donor: { id: string } } }>('/api/checkout', payload);
      const second = await post<{ data: { donor: { id: string } } }>('/api/checkout', payload);

      expect(second.status).toBe(201);
      expect(second.body.data.donor.id).toBe(first.body.data.donor.id);
    });

    it('refuse un moyen de paiement incompatible avec le pays du donateur', async () => {
      const { status, body } = await post<{ error: { code: string } }>(
        '/api/checkout',
        checkoutPayload({ paymentMethodCode: 'CARD' }),
      );

      expect(status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('refuse un don vers un projet non finançable', async () => {
      const project = await createTestProject({ status: 'DRAFT' });
      const services = getTestServices();
      await services.projectService.changeProjectStatus(project.id, 'CANCELLED');

      const { status, body } = await post<{ error: { code: string } }>(
        '/api/checkout',
        checkoutPayload({ projectId: project.id }),
      );

      expect(status).toBe(422);
      expect(body.error.code).toBe('BUSINESS_RULE_VIOLATION');
    });

    it('detaille les champs invalides du formulaire', async () => {
      const { status, body } = await post<{
        error: { code: string; details: { field: string }[] };
      }>('/api/checkout', checkoutPayload({ donor: { firstName: '', email: 'pas-un-email' } }));

      expect(status).toBe(400);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details.map((detail) => detail.field)).toContain('donor.email');
    });

    it('refuse un montant qui n’est pas un nombre', async () => {
      const { status } = await post(
        '/api/checkout',
        checkoutPayload({ donation: { donationType: 'ONE_TIME', currency: 'MGA', amount: 'abc' } }),
      );
      expect(status).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  describe('suivi de transaction', () => {
    it('retrouve une transaction par sa reference HOPE', async () => {
      const checkout = await post<{ data: { transaction: { internalReference: string } } }>(
        '/api/checkout',
        checkoutPayload(),
      );
      const reference = checkout.body.data.transaction.internalReference;

      const { status, body } = await api<{
        data: { transaction: { internalReference: string }; outcome: string };
      }>(`/api/transactions/${reference}`);

      expect(status).toBe(200);
      expect(body.data.transaction.internalReference).toBe(reference);
      expect(body.data.outcome).toBe('SUCCESS');
    });

    it('n’expose ni la reference prestataire ni les metadonnees', async () => {
      const checkout = await post<{ data: { transaction: { id: string } } }>(
        '/api/checkout',
        checkoutPayload(),
      );

      const { body } = await api<{ data: { transaction: Record<string, unknown> } }>(
        `/api/transactions/${checkout.body.data.transaction.id}`,
      );

      expect(body.data.transaction).not.toHaveProperty('providerReference');
      expect(body.data.transaction).not.toHaveProperty('metadata');
    });
  });

  // -------------------------------------------------------------------------
  describe('don mensuel : 1 DON, N TRANSACTIONS', () => {
    it('rattache une seconde echeance au meme don', async () => {
      const checkout = await post<{ data: { donation: { id: string; reference: string } } }>(
        '/api/checkout',
        checkoutPayload({
          donation: {
            donationType: 'RECURRING',
            currency: 'MGA',
            amount: '50000',
            frequency: 'MONTHLY',
          },
        }),
      );
      const donationId = checkout.body.data.donation.id;

      const second = await post<{ data: { id: string; status: string } }>(
        `/api/donations/${donationId}/transactions`,
        { paymentMethodCode: 'MVOLA' },
      );
      expect(second.status).toBe(201);

      await post(`/api/transactions/${second.body.data.id}/process`, {});

      const { body } = await api<{
        data: {
          donation: { reference: string };
          transactions: { status: string }[];
          summary: { totalReceived: string; successfulTransactionCount: number };
        };
      }>(`/api/donations/${donationId}`);

      // UN seul don...
      expect(body.data.donation.reference).toMatch(/^HOPE-DON-/);
      // ...mais DEUX echeances.
      expect(body.data.transactions).toHaveLength(2);
      expect(body.data.summary.successfulTransactionCount).toBe(2);
      expect(body.data.summary.totalReceived).toBe('100000');
    });
  });

  // -------------------------------------------------------------------------
  describe('affectation manuelle', () => {
    it('refuse d’affecter plus que le montant recu', async () => {
      const project = await createTestProject();
      const checkout = await post<{ data: { donation: { id: string } } }>(
        '/api/checkout',
        checkoutPayload(),
      );

      const { status, body } = await post<{ error: { code: string } }>(
        `/api/donations/${checkout.body.data.donation.id}/allocations`,
        { projectId: project.id, amount: '500000' },
      );

      expect(status).toBe(422);
      expect(body.error.code).toBe('INSUFFICIENT_FUNDS');
    });
  });
});
