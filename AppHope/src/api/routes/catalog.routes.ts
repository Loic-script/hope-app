import { Router } from 'express';
import { z } from 'zod';
import { getQuery, validateQuery } from '../middleware/validate.js';
import { toPaymentMethodDto, toProjectCategoryDto } from '../dto/mappers.js';
import { StatsPresenter } from '../presenters/stats.presenter.js';
import type { Container } from '../../container.js';
import { normalizeCountry } from '../../shared/geography.js';

/**
 * Donnees de reference lues par le site : categories, moyens de paiement,
 * chiffres cles. Uniquement de la lecture, aucune ecriture.
 */

const paymentMethodQuerySchema = z.object({
  /** Pays du donateur : decide des methodes proposees (locales ou internationales). */
  country: z.string().trim().length(2).optional(),
});

export function createCatalogRouter(container: Container): Router {
  const router = Router();
  const { services, repositories } = container;
  const statsPresenter = new StatsPresenter(services, repositories);

  router.get('/project-categories', async (_req, res) => {
    const categories = await services.projectService.listCategories();
    res.json({ data: categories.map(toProjectCategoryDto) });
  });

  /**
   * Les moyens de paiement proposes dependent du pays du donateur : MVola
   * n'existe qu'a Madagascar, la carte bancaire sert aux dons internationaux.
   * C'est le backend qui tranche (`listPaymentMethodsForCountry`), pas un
   * filtre ecrit dans le navigateur.
   */
  router.get(
    '/payment-methods',
    validateQuery(paymentMethodQuerySchema),
    async (_req, res) => {
      const query = getQuery<z.infer<typeof paymentMethodQuerySchema>>(res);

      const methods = query.country
        ? await services.paymentService.listPaymentMethodsForCountry(
            normalizeCountry(query.country),
          )
        : await services.paymentService.listPaymentMethods();

      res.json({ data: methods.map(toPaymentMethodDto) });
    },
  );

  router.get('/stats', async (_req, res) => {
    res.json({ data: await statsPresenter.build() });
  });

  router.get('/impacts', async (_req, res) => {
    const indicators = await services.impactService.getGlobalIndicatorTotals();
    res.json({
      data: indicators.map((indicator) => ({
        indicator: indicator.indicator,
        unit: indicator.unit,
        total: indicator.total.toString(),
        measurementCount: indicator.measurementCount,
      })),
    });
  });

  return router;
}
