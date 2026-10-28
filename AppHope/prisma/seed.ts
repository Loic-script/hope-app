import {
  BudgetStatus,
  PaymentScope,
  ProjectStatus,
  type PaymentMethod,
  type Project,
  type ProjectCategory,
} from '@prisma/client';
import { prisma, disconnectPrisma } from '../src/database/prisma.js';
import { createContainer } from '../src/container.js';
import { isMainModule, runScript, title, line } from '../src/shared/run-script.js';

/**
 * SEED DE REFERENCE HOPE.
 *
 * Le script est IDEMPOTENT : on peut le relancer autant de fois que l'on veut,
 * il ne cree jamais de doublon. Il alimente :
 *   1. les methodes de paiement (locales Madagascar + internationales) ;
 *   2. les categories de projet ;
 *   3. quelques projets fictifs HOPE, avec un budget d'exemple.
 *
 * Il NE cree PAS de donateurs, de dons ni de transactions : ces donnees
 * appartiennent aux scripts de demonstration (npm run demo:donation).
 */

// ---------------------------------------------------------------------------
// 1. Methodes de paiement
// ---------------------------------------------------------------------------

/**
 * `provider` designe l'implementation technique branchee sur la methode.
 * En phase 1, tout pointe vers MOCK : aucun appel reseau n'est effectue.
 * Brancher un vrai prestataire plus tard se fera en changeant cette seule
 * valeur (et en enregistrant le provider correspondant dans le registre).
 *
 * `scope` decide qui peut utiliser la methode : un donateur malgache voit les
 * methodes LOCAL et BOTH, un donateur etranger les methodes INTERNATIONAL et
 * BOTH. C'est de la DONNEE, pas du code : elle s'ajuste sans redeploiement.
 */
const PAYMENT_METHODS = [
  // --- Madagascar (local) ---
  {
    code: 'MVOLA',
    name: 'MVola (Telma)',
    provider: 'MOCK',
    scope: PaymentScope.LOCAL,
    supportedCurrencies: ['MGA'],
    description: 'Portefeuille mobile Telma, très utilisé à Madagascar.',
  },
  {
    code: 'ORANGE_MONEY',
    name: 'Orange Money',
    provider: 'MOCK',
    scope: PaymentScope.LOCAL,
    supportedCurrencies: ['MGA'],
    description: 'Portefeuille mobile Orange Madagascar.',
  },
  {
    code: 'BANK_TRANSFER',
    name: 'Virement bancaire local',
    provider: 'MOCK',
    scope: PaymentScope.LOCAL,
    supportedCurrencies: ['MGA'],
    description: 'Virement depuis une banque malgache vers le compte HOPE.',
  },
  {
    code: 'BANK_DEPOSIT',
    name: 'Dépôt en agence bancaire',
    provider: 'MOCK',
    scope: PaymentScope.LOCAL,
    supportedCurrencies: ['MGA'],
    description: 'Versement en espèces au guichet, sur le compte HOPE.',
  },
  {
    code: 'CASH',
    name: 'Espèces',
    provider: 'MOCK',
    scope: PaymentScope.LOCAL,
    supportedCurrencies: ['MGA'],
    description: 'Remise en main propre, avec reçu numéroté.',
  },

  // --- International ---
  {
    code: 'CARD',
    name: 'Carte bancaire',
    provider: 'MOCK',
    scope: PaymentScope.INTERNATIONAL,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'CHF', 'CAD'],
    description: 'Paiement par carte. Aucune donnée de carte n’est stockée par HOPE.',
  },
  {
    code: 'INTERNATIONAL_BANK_TRANSFER',
    name: 'Virement bancaire international',
    provider: 'MOCK',
    scope: PaymentScope.INTERNATIONAL,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'CHF', 'CAD'],
    description: 'Virement SWIFT / SEPA vers le compte HOPE.',
  },
  {
    code: 'PAYMENT_PLATFORM',
    name: 'Plateforme de paiement',
    provider: 'MOCK',
    scope: PaymentScope.INTERNATIONAL,
    supportedCurrencies: ['EUR', 'USD', 'GBP', 'CHF', 'CAD'],
    description: 'Plateforme tierce (PayPal, Stripe…) à brancher ultérieurement.',
  },
] as const;

// ---------------------------------------------------------------------------
// 2. Categories de projet
// ---------------------------------------------------------------------------

/**
 * LE CONTENU AFFICHE EST ECRIT EN FRANCAIS CORRECT, ACCENTS COMPRIS.
 *
 * Les commentaires de ce depot sont volontairement sans accents, pour eviter
 * tout souci d'encodage entre Windows, PostgreSQL et Git. Cette regle ne
 * s'applique PAS au contenu : un site d'ONG qui afficherait "meres
 * celibataires" a ses donateurs francophones perdrait en credibilite.
 *
 * `previousNames` permet de faire evoluer un libelle sans creer de doublon :
 * le seed reconnait l'ancienne orthographe et renomme la ligne existante.
 */
const PROJECT_CATEGORIES = [
  {
    name: 'Scolarité',
    previousNames: ['Scolarite'],
    description: 'Frais scolaires, fournitures, transport vers l’école.',
  },
  {
    name: 'Soins',
    previousNames: [],
    description: 'Consultations, médicaments, suivi médical.',
  },
  {
    name: 'Alimentation',
    previousNames: [],
    description: 'Paniers alimentaires et repas équilibrés.',
  },
  {
    name: 'Employabilité',
    previousNames: ['Employabilite'],
    description: 'Insertion professionnelle et aide à la recherche d’emploi.',
  },
  {
    name: 'Formation professionnelle',
    previousNames: [],
    description: 'Apprentissage d’un métier : couture, cuisine, informatique.',
  },
  {
    name: 'Soutien social',
    previousNames: [],
    description: 'Accompagnement psychologique et administratif.',
  },
  {
    name: 'Urgence',
    previousNames: [],
    description: 'Réponse aux situations critiques : cyclone, maladie, expulsion.',
  },
] as const;

// ---------------------------------------------------------------------------
// 3. Projets fictifs
// ---------------------------------------------------------------------------

const PROJECTS = [
  {
    name: 'Scolarisation des orphelins d’Antananarivo 2027',
    previousNames: [],
    categoryName: 'Scolarité',
    description:
      'Prise en charge des frais de scolarité, des fournitures et du transport pour ' +
      '40 orphelins de la région d’Analamanga sur l’année scolaire 2027.',
    location: 'Antananarivo, Madagascar',
    managerName: 'Hanta Rakotoarisoa',
    startDate: '2027-01-11',
    endDate: '2027-12-17',
    status: ProjectStatus.ACTIVE,
  },
  {
    name: 'Accès aux soins de santé primaires',
    previousNames: ['Acces aux soins de sante primaires'],
    categoryName: 'Soins',
    description:
      'Consultations médicales, vaccins et médicaments essentiels pour les familles ' +
      'accompagnées par HOPE à Toamasina.',
    location: 'Toamasina, Madagascar',
    managerName: 'Dr. Naina Randrianasolo',
    startDate: '2026-03-02',
    endDate: '2027-02-28',
    status: ProjectStatus.ACTIVE,
  },
  {
    name: 'Paniers alimentaires mensuels',
    previousNames: [],
    categoryName: 'Alimentation',
    description:
      'Distribution mensuelle de riz, légumineuses et huile à 60 familles monoparentales.',
    location: 'Antananarivo, Madagascar',
    managerName: 'Voahangy Rasoanaivo',
    startDate: '2026-01-05',
    status: ProjectStatus.ACTIVE,
  },
  {
    name: 'Formation en couture pour mères célibataires',
    previousNames: ['Formation en couture pour meres celibataires'],
    categoryName: 'Formation professionnelle',
    description:
      'Formation de six mois en couture et gestion d’atelier, suivie d’un ' +
      'accompagnement à l’installation, pour 25 mères célibataires.',
    location: 'Fianarantsoa, Madagascar',
    managerName: 'Miora Andrianina',
    startDate: '2026-09-01',
    endDate: '2027-03-31',
    status: ProjectStatus.ACTIVE,
  },
  {
    name: 'Accompagnement social des familles',
    previousNames: [],
    categoryName: 'Soutien social',
    description:
      'Soutien psychologique, aide administrative et médiation pour les familles ' +
      'en situation de vulnérabilité.',
    location: 'Antananarivo, Madagascar',
    managerName: 'Fanja Ravelojaona',
    startDate: '2026-02-01',
    status: ProjectStatus.DRAFT,
  },
] as const;

/** Budget d'exemple attache au premier projet, pour illustrer les depenses. */
const SAMPLE_BUDGET = {
  projectName: 'Scolarisation des orphelins d’Antananarivo 2027',
  name: 'Budget scolarité 2027',
  totalAmount: '20000000',
  currency: 'MGA',
  startDate: '2027-01-01',
  endDate: '2027-12-31',
  items: [
    { name: 'Frais scolaires', plannedAmount: '8000000', description: 'Écolages des 40 élèves.' },
    { name: 'Matériel scolaire', plannedAmount: '6000000', description: 'Cahiers, livres, uniformes.' },
    { name: 'Transport', plannedAmount: '4000000', description: 'Trajets domicile — école.' },
    { name: 'Divers', plannedAmount: '2000000', description: 'Imprévus et frais administratifs.' },
  ],
} as const;

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export async function seedPaymentMethods(): Promise<PaymentMethod[]> {
  const { services } = createContainer();
  const created: PaymentMethod[] = [];

  for (const method of PAYMENT_METHODS) {
    created.push(
      await services.paymentService.registerPaymentMethod({
        code: method.code,
        name: method.name,
        provider: method.provider,
        scope: method.scope,
        supportedCurrencies: [...method.supportedCurrencies],
        description: method.description,
        isActive: true,
      }),
    );
  }

  return created;
}

export async function seedProjectCategories(): Promise<ProjectCategory[]> {
  const created: ProjectCategory[] = [];

  for (const category of PROJECT_CATEGORIES) {
    // Une categorie enregistree sous une ancienne orthographe est RENOMMEE,
    // jamais dupliquee : les projets qui la referencent restent rattaches.
    const legacy = await findByPreviousName(
      (name) => prisma.projectCategory.findUnique({ where: { name } }),
      category.previousNames,
    );

    if (legacy) {
      created.push(
        await prisma.projectCategory.update({
          where: { id: legacy.id },
          data: { name: category.name, description: category.description },
        }),
      );
      continue;
    }

    created.push(
      await prisma.projectCategory.upsert({
        where: { name: category.name },
        create: { name: category.name, description: category.description },
        update: { description: category.description },
      }),
    );
  }

  return created;
}

export async function seedProjects(): Promise<Project[]> {
  const { services } = createContainer();
  const created: Project[] = [];

  for (const definition of PROJECTS) {
    const category = await services.projectService.getCategoryByName(definition.categoryName);

    // Les projets n'ont pas de cle naturelle unique en base (le `code` est
    // genere aleatoirement) : on cherche donc par nom, actuel ou ancien.
    const existing =
      (await prisma.project.findFirst({ where: { name: definition.name } })) ??
      (await findByPreviousName(
        (name) => prisma.project.findFirst({ where: { name } }),
        definition.previousNames,
      ));

    if (existing) {
      // Le contenu editorial est reactualise a chaque seed : corriger une
      // faute de frappe ou une accentuation ne doit pas obliger a repartir
      // d'une base vide. Le statut, lui, n'est pas touche : il peut avoir ete
      // change deliberement depuis.
      created.push(
        await services.projectService.updateProject(existing.id, {
          categoryId: category.id,
          name: definition.name,
          description: definition.description,
          location: definition.location,
          managerName: definition.managerName,
        }),
      );
      continue;
    }

    created.push(
      await services.projectService.createProject({
        categoryId: category.id,
        name: definition.name,
        description: definition.description,
        location: definition.location,
        managerName: definition.managerName,
        startDate: definition.startDate,
        endDate: 'endDate' in definition ? definition.endDate : null,
        status: definition.status,
      }),
    );
  }

  return created;
}

/** Cherche une ligne sous l'une de ses orthographes precedentes. */
async function findByPreviousName<T>(
  lookup: (name: string) => Promise<T | null>,
  previousNames: readonly string[],
): Promise<T | null> {
  for (const name of previousNames) {
    const found = await lookup(name);
    if (found) return found;
  }
  return null;
}

export async function seedSampleBudget(): Promise<void> {
  const { services } = createContainer();

  const project = await prisma.project.findFirst({ where: { name: SAMPLE_BUDGET.projectName } });
  if (!project) return;

  const existing = await prisma.projectBudget.findFirst({
    where: { projectId: project.id, name: SAMPLE_BUDGET.name },
  });
  if (existing) return;

  const budget = await services.budgetService.createBudget({
    projectId: project.id,
    name: SAMPLE_BUDGET.name,
    totalAmount: SAMPLE_BUDGET.totalAmount,
    currency: SAMPLE_BUDGET.currency,
    startDate: SAMPLE_BUDGET.startDate,
    endDate: SAMPLE_BUDGET.endDate,
    status: BudgetStatus.ACTIVE,
  });

  for (const item of SAMPLE_BUDGET.items) {
    await services.budgetService.addBudgetItem({
      budgetId: budget.id,
      name: item.name,
      plannedAmount: item.plannedAmount,
      description: item.description,
    });
  }
}

export async function seed(): Promise<void> {
  title('Seed HOPE - donnees de reference');

  const methods = await seedPaymentMethods();
  line('Methodes de paiement', `${methods.length} enregistrees`);

  const categories = await seedProjectCategories();
  line('Categories de projet', `${categories.length} enregistrees`);

  const projects = await seedProjects();
  line('Projets HOPE', `${projects.length} disponibles`);

  await seedSampleBudget();
  line('Budget d’exemple', `"${SAMPLE_BUDGET.name}" pret`);

  console.log('\nSeed termine. Lancez `npm run demo:donation` pour un exemple complet.\n');
}

if (isMainModule(import.meta.url)) {
  await runScript('seed', seed, disconnectPrisma);
}
