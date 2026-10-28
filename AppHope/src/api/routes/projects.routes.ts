import { ProjectStatus, type Project } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { getQuery, readParam, validateQuery } from '../middleware/validate.js';
import { toBudgetDto, toImpactDto } from '../dto/mappers.js';
import { ProjectPresenter } from '../presenters/project.presenter.js';
import type { Container } from '../../container.js';
import { NotFoundError } from '../../shared/errors.js';

/**
 * Projets publies sur le site.
 *
 * Seuls les projets ACTIVE et COMPLETED sont visibles par defaut : un projet
 * en brouillon n'est pas encore une promesse que HOPE veut afficher, et un
 * projet annule ne doit plus attirer de dons.
 */

const PUBLIC_STATUSES: readonly ProjectStatus[] = [ProjectStatus.ACTIVE, ProjectStatus.COMPLETED];

const listQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  categoryId: z.uuid().optional(),
  status: z.enum(ProjectStatus).optional(),
  take: z.coerce.number().int().min(1).max(60).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

export function createProjectsRouter(container: Container): Router {
  const router = Router();
  const { services } = container;
  const presenter = new ProjectPresenter(services);

  router.get('/', validateQuery(listQuerySchema), async (_req, res) => {
    const query = getQuery<z.infer<typeof listQuerySchema>>(res);

    // Un statut demande explicitement doit rester dans le perimetre public :
    // on ne veut pas qu'une URL bricolee expose les brouillons.
    const requestedStatus =
      query.status && PUBLIC_STATUSES.includes(query.status) ? query.status : undefined;

    const projects = await services.projectService.listProjects(
      {
        ...(query.search ? { search: query.search } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(requestedStatus ? { status: requestedStatus } : {}),
      },
      { take: query.take ?? 24, skip: query.skip ?? 0 },
    );

    const visible = requestedStatus
      ? projects
      : projects.filter((project) => PUBLIC_STATUSES.includes(project.status));

    res.json({ data: await presenter.summarizeMany(visible) });
  });

  router.get('/:id', async (req, res) => {
    const project = await findPublicProject(services, readParam(req.params, 'id'));
    res.json({ data: await presenter.detail(project) });
  });

  router.get('/:id/impacts', async (req, res) => {
    const project = await findPublicProject(services, readParam(req.params, 'id'));
    const report = await services.impactService.getProjectImpactReport(project.id);

    res.json({
      data: {
        impacts: report.impacts.map(toImpactDto),
        indicators: report.indicators.map((indicator) => ({
          indicator: indicator.indicator,
          unit: indicator.unit,
          total: indicator.total.toString(),
          measurementCount: indicator.measurementCount,
        })),
        totalMeasurements: report.totalMeasurements,
      },
    });
  });

  router.get('/:id/budgets', async (req, res) => {
    const project = await findPublicProject(services, readParam(req.params, 'id'));
    const budgets = await services.budgetService.listBudgetsForProject(project.id);
    const summaries = await Promise.all(
      budgets.map((budget) => services.budgetService.getBudgetSummary(budget.id)),
    );

    res.json({ data: summaries.map(toBudgetDto) });
  });

  return router;
}

/**
 * Recherche un projet par UUID ou par code lisible (HOPE-PRJ-...).
 *
 * Accepter les deux permet de partager une URL parlante sans exposer d'UUID,
 * et un projet non publie reste introuvable dans les deux cas.
 */
async function findPublicProject(
  services: Container['services'],
  identifier: string,
): Promise<Project> {
  const value = identifier;
  if (value === '') throw new NotFoundError('Projet', '(identifiant manquant)');

  const isUuid = z.uuid().safeParse(value).success;
  const project = isUuid
    ? await services.projectService.getProjectById(value)
    : await services.projectService.getProjectByCode(value.toUpperCase());

  if (!PUBLIC_STATUSES.includes(project.status)) {
    // On renvoie 404 plutot que 403 : confirmer l'existence d'un projet non
    // publie serait deja une fuite d'information.
    throw new NotFoundError('Projet', value);
  }

  return project;
}
