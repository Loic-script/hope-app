import {
  BeneficiaryType,
  Gender,
  ProjectBeneficiaryStatus,
  ProjectStatus,
} from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../helpers/database.js';
import { createTestProject, getTestServices } from '../helpers/factories.js';
import type { Services } from '../../container.js';
import {
  ConflictError,
  InvalidStatusTransitionError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.js';

describe('BeneficiaryService, ImpactService et ProjectService', () => {
  useTestDatabase();

  let services: Services;

  beforeEach(() => {
    services = getTestServices();
  });

  // -------------------------------------------------------------------------
  describe('beneficiaires', () => {
    it('cree un beneficiaire avec une reference anonyme', async () => {
      const beneficiary = await services.beneficiaryService.createBeneficiary({
        beneficiaryType: BeneficiaryType.ORPHAN,
        country: 'MG',
        firstName: 'Soa',
        gender: Gender.FEMALE,
        birthDate: '2015-04-22',
      });

      expect(beneficiary.reference).toMatch(/^HOPE-BEN-\d{8}-[A-Z2-9]{6}$/);
      expect(beneficiary.beneficiaryType).toBe(BeneficiaryType.ORPHAN);
      expect(beneficiary.status).toBe('ACTIVE');
    });

    it('accepte un beneficiaire anonyme (sans nom ni prenom)', async () => {
      const beneficiary = await services.beneficiaryService.createBeneficiary({
        beneficiaryType: BeneficiaryType.SINGLE_MOTHER,
        country: 'MG',
      });

      expect(beneficiary.firstName).toBeNull();
      expect(beneficiary.lastName).toBeNull();
      expect(beneficiary.reference).toBeTruthy();
    });

    it('refuse une date de naissance dans le futur', async () => {
      await expect(
        services.beneficiaryService.createBeneficiary({
          beneficiaryType: BeneficiaryType.ORPHAN,
          country: 'MG',
          birthDate: new Date(Date.now() + 86_400_000),
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('refuse un code pays invalide', async () => {
      await expect(
        services.beneficiaryService.createBeneficiary({
          beneficiaryType: BeneficiaryType.ORPHAN,
          country: 'MADAGASCAR',
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  // -------------------------------------------------------------------------
  describe('relation N-N entre projets et beneficiaires', () => {
    it('inscrit plusieurs beneficiaires a un meme projet', async () => {
      const project = await createTestProject();
      const first = await services.beneficiaryService.createBeneficiary({
        beneficiaryType: BeneficiaryType.ORPHAN,
        country: 'MG',
      });
      const second = await services.beneficiaryService.createBeneficiary({
        beneficiaryType: BeneficiaryType.SINGLE_MOTHER,
        country: 'MG',
      });

      await services.beneficiaryService.enrollInProject({
        projectId: project.id,
        beneficiaryId: first.id,
      });
      await services.beneficiaryService.enrollInProject({
        projectId: project.id,
        beneficiaryId: second.id,
      });

      const enrolled = await services.beneficiaryService.getProjectBeneficiaries(project.id);
      expect(enrolled).toHaveLength(2);
    });

    it('inscrit un meme beneficiaire a plusieurs projets', async () => {
      const scolarite = await createTestProject();
      const sante = await createTestProject();
      const beneficiary = await services.beneficiaryService.createBeneficiary({
        beneficiaryType: BeneficiaryType.SINGLE_MOTHER,
        country: 'MG',
      });

      await services.beneficiaryService.enrollInProject({
        projectId: scolarite.id,
        beneficiaryId: beneficiary.id,
      });
      await services.beneficiaryService.enrollInProject({
        projectId: sante.id,
        beneficiaryId: beneficiary.id,
      });

      const profile = await services.beneficiaryService.getBeneficiaryProfile(beneficiary.id);
      expect(profile.enrollments).toHaveLength(2);
      expect(profile.activeProjectCount).toBe(2);
    });

    it('refuse une double inscription au meme projet', async () => {
      const project = await createTestProject();
      const beneficiary = await services.beneficiaryService.createBeneficiary({
        beneficiaryType: BeneficiaryType.ORPHAN,
        country: 'MG',
      });

      await services.beneficiaryService.enrollInProject({
        projectId: project.id,
        beneficiaryId: beneficiary.id,
      });

      await expect(
        services.beneficiaryService.enrollInProject({
          projectId: project.id,
          beneficiaryId: beneficiary.id,
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('enregistre la sortie d’un beneficiaire', async () => {
      const project = await createTestProject();
      const beneficiary = await services.beneficiaryService.createBeneficiary({
        beneficiaryType: BeneficiaryType.ORPHAN,
        country: 'MG',
      });
      await services.beneficiaryService.enrollInProject({
        projectId: project.id,
        beneficiaryId: beneficiary.id,
      });

      const left = await services.beneficiaryService.leaveProject(project.id, beneficiary.id, {
        status: ProjectBeneficiaryStatus.COMPLETED,
        notes: 'Programme termine avec succes.',
      });

      expect(left.status).toBe(ProjectBeneficiaryStatus.COMPLETED);
      expect(left.leftAt).toBeInstanceOf(Date);

      const profile = await services.beneficiaryService.getBeneficiaryProfile(beneficiary.id);
      expect(profile.activeProjectCount).toBe(0);
    });

    it('refuse une date de sortie anterieure a la date d’entree', async () => {
      const project = await createTestProject();
      const beneficiary = await services.beneficiaryService.createBeneficiary({
        beneficiaryType: BeneficiaryType.ORPHAN,
        country: 'MG',
      });
      await services.beneficiaryService.enrollInProject({
        projectId: project.id,
        beneficiaryId: beneficiary.id,
        joinedAt: new Date(Date.UTC(2026, 5, 1)),
      });

      await expect(
        services.beneficiaryService.leaveProject(project.id, beneficiary.id, {
          leftAt: new Date(Date.UTC(2026, 0, 1)),
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('filtre les beneficiaires d’un projet', async () => {
      const project = await createTestProject();
      const other = await createTestProject();

      const inProject = await services.beneficiaryService.createBeneficiary({
        beneficiaryType: BeneficiaryType.ORPHAN,
        country: 'MG',
      });
      await services.beneficiaryService.createBeneficiary({
        beneficiaryType: BeneficiaryType.FAMILY,
        country: 'MG',
      });

      await services.beneficiaryService.enrollInProject({
        projectId: project.id,
        beneficiaryId: inProject.id,
      });

      expect(
        await services.beneficiaryService.listBeneficiaries({ projectId: project.id }),
      ).toHaveLength(1);
      expect(
        await services.beneficiaryService.listBeneficiaries({ projectId: other.id }),
      ).toHaveLength(0);
      expect(await services.beneficiaryService.countBeneficiaries()).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  describe('impact', () => {
    it('enregistre un impact collectif mesurable', async () => {
      const project = await createTestProject();

      const impact = await services.impactService.recordImpact({
        projectId: project.id,
        title: 'Meres celibataires formees',
        description: 'Formation en couture achevee.',
        indicator: 'women_trained',
        value: 25,
        unit: 'persons',
        measuredAt: new Date(),
      });

      expect(impact.indicator).toBe('women_trained');
      expect(impact.value?.toString()).toBe('25');
      expect(impact.beneficiaryId).toBeNull();
    });

    it('cumule les mesures d’un meme indicateur', async () => {
      const project = await createTestProject();

      await services.impactService.recordImpact({
        projectId: project.id,
        title: 'Premiere promotion',
        description: 'Session 1.',
        indicator: 'women_trained',
        value: 25,
        unit: 'persons',
        measuredAt: new Date(),
      });
      await services.impactService.recordImpact({
        projectId: project.id,
        title: 'Seconde promotion',
        description: 'Session 2.',
        indicator: 'women_trained',
        value: 18,
        unit: 'persons',
        measuredAt: new Date(),
      });

      const totals = await services.impactService.getIndicatorTotals(project.id);
      expect(totals).toHaveLength(1);
      expect(totals[0]?.indicator).toBe('women_trained');
      expect(totals[0]?.total.toString()).toBe('43');
      expect(totals[0]?.measurementCount).toBe(2);
    });

    it('rattache un impact a un beneficiaire precis', async () => {
      const project = await createTestProject();
      const beneficiary = await services.beneficiaryService.createBeneficiary({
        beneficiaryType: BeneficiaryType.ORPHAN,
        country: 'MG',
      });

      const impact = await services.impactService.recordImpact({
        projectId: project.id,
        beneficiaryId: beneficiary.id,
        title: 'Passage en classe superieure',
        description: 'Annee scolaire validee.',
        measuredAt: new Date(),
      });

      expect(impact.beneficiaryId).toBe(beneficiary.id);
    });

    it('accepte une valeur decimale (taux, pourcentage)', async () => {
      const project = await createTestProject();

      const impact = await services.impactService.recordImpact({
        projectId: project.id,
        title: 'Taux de reussite scolaire',
        description: 'Resultats de fin d’annee.',
        indicator: 'success_rate',
        value: '87.5',
        unit: 'percent',
        measuredAt: new Date(),
      });

      expect(impact.value?.toString()).toBe('87.5');
    });

    it('refuse un indicateur sans valeur mesurable', async () => {
      const project = await createTestProject();

      await expect(
        services.impactService.recordImpact({
          projectId: project.id,
          title: 'Indicateur incomplet',
          description: 'Sans valeur.',
          indicator: 'women_trained',
          measuredAt: new Date(),
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('refuse une valeur negative', async () => {
      const project = await createTestProject();

      await expect(
        services.impactService.recordImpact({
          projectId: project.id,
          title: 'Valeur negative',
          description: 'Impossible.',
          indicator: 'women_trained',
          value: -5,
          measuredAt: new Date(),
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('refuse un beneficiaire inexistant', async () => {
      const project = await createTestProject();

      await expect(
        services.impactService.recordImpact({
          projectId: project.id,
          beneficiaryId: '00000000-0000-4000-8000-000000000000',
          title: 'Impact orphelin',
          description: 'Beneficiaire inconnu.',
          measuredAt: new Date(),
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('produit un rapport d’impact par projet', async () => {
      const project = await createTestProject();

      await services.impactService.recordImpact({
        projectId: project.id,
        title: 'Enfants scolarises',
        description: 'Rentree 2027.',
        indicator: 'children_schooled',
        value: 40,
        unit: 'persons',
        measuredAt: new Date(),
      });

      const report = await services.impactService.getProjectImpactReport(project.id);
      expect(report.totalMeasurements).toBe(1);
      expect(report.indicators).toHaveLength(1);
      expect(report.impacts).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('projets', () => {
    it('cree un projet avec un code unique', async () => {
      const project = await createTestProject();
      expect(project.code).toMatch(/^HOPE-PRJ-\d{8}-[A-Z2-9]{6}$/);
    });

    it('respecte les transitions de statut', async () => {
      const project = await createTestProject({ status: ProjectStatus.DRAFT });

      const active = await services.projectService.activateProject(project.id);
      expect(active.status).toBe(ProjectStatus.ACTIVE);

      const suspended = await services.projectService.changeProjectStatus(
        project.id,
        ProjectStatus.SUSPENDED,
      );
      expect(suspended.status).toBe(ProjectStatus.SUSPENDED);

      const reactivated = await services.projectService.changeProjectStatus(
        project.id,
        ProjectStatus.ACTIVE,
      );
      expect(reactivated.status).toBe(ProjectStatus.ACTIVE);

      await services.projectService.changeProjectStatus(project.id, ProjectStatus.COMPLETED);
      await expect(
        services.projectService.changeProjectStatus(project.id, ProjectStatus.ACTIVE),
      ).rejects.toThrow(InvalidStatusTransitionError);
    });

    it('refuse une categorie inexistante', async () => {
      await expect(
        services.projectService.createProject({
          categoryId: '00000000-0000-4000-8000-000000000000',
          name: 'Projet sans categorie',
          description: 'Test.',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('refuse une categorie en double', async () => {
      await services.projectService.createCategory({ name: 'Nouvelle categorie' });
      await expect(
        services.projectService.createCategory({ name: 'Nouvelle categorie' }),
      ).rejects.toThrow(ConflictError);
    });

    it('recherche un projet par nom', async () => {
      await createTestProject({ name: 'Scolarisation des orphelins' });
      await createTestProject({ name: 'Formation professionnelle' });

      const found = await services.projectService.listProjects({ search: 'scolarisation' });
      expect(found).toHaveLength(1);
    });
  });
});
