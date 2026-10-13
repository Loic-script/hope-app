import { ErreurIntrouvable } from '../shared/errors.js';
import { PAGE_INTROUVABLE, decrirePage, ficheDeLActualite, ficheDuProjet } from '../shared/pagesDuSite.js';
import { preparerCoquille } from '../shared/referencement.js';
import { actualite, projet } from '../services/vitrine.service.js';

const FICHES = {
  projet: async (id) => ficheDuProjet(await projet(id)),
  actualite: async (id) => ficheDeLActualite(await actualite(id)),
};

export function versHoteDeReference(siteUrl) {
  let reference;
  try {
    reference = new URL(siteUrl);
  } catch {
    return (_req, _res, suite) => suite();
  }
  const hote = reference.hostname;
  const autreForme = hote.startsWith('www.') ? hote.slice(4) : `www.${hote}`;

  return (req, res, suite) => {
    if ((req.method === 'GET' || req.method === 'HEAD') && req.hostname === autreForme) {
      return res.redirect(301, `${reference.origin}${req.originalUrl}`);
    }
    return suite();
  };
}

async function pageDemandee(chemin, fiches) {
  const page = decrirePage(chemin);
  if (page.genre === 'inconnue') return { ...page, statut: 404 };
  if (!fiches[page.genre]) return { ...page, statut: 200 };
  try {
    return { ...page, ...(await fiches[page.genre](page.id)), indexable: true, statut: 200 };
  } catch (erreur) {
    if (erreur instanceof ErreurIntrouvable) return { ...PAGE_INTROUVABLE, statut: 404 };
    console.error(`[HOPE] Fiche indisponible pour ${page.chemin} :`, erreur.message);
    return { ...page, statut: 503 };
  }
}

export function servirCoquille({ gabarit, siteUrl, fiches = FICHES }) {
  const rendre = preparerCoquille(gabarit, siteUrl);

  return async (req, res, suite) => {
    if (!req.accepts('html')) return suite();
    const page = await pageDemandee(req.path, fiches);
    if (page.genre === 'redirection') return res.redirect(301, page.vers);
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(page.statut).type('html').send(rendre(page));
  };
}
