/**
 * Service de la page d'accueil administrateur.
 *
 * Assemble en un seul appel ce qu'affiche l'ecran /admin : chiffres cles,
 * etat du fonds, projets en cours et fil d'activite.
 */
import * as dashboardRepository from '../repositories/dashboard.repository.js';
import * as projectRepository from '../repositories/project.repository.js';

import { centimesVersTexte, depuisBase, pourcentage } from '../shared/money.js';

/** Reprend les indicateurs derives utilises dans la liste des projets. */
function enrichirProjet(projet) {
  const requis = depuisBase(projet.requiredBudget);
  const finance = depuisBase(projet.fundedTotal);
  const depense = depuisBase(projet.spentTotal);

  return {
    ...projet,
    fundingRate: pourcentage(finance, requis),
    remainingNeed: centimesVersTexte(Math.max(0, requis - finance)),
    availableFunds: centimesVersTexte(finance - depense),
  };
}

export async function recupererAccueil() {
  const [chiffres, variations, projets, activites] = await Promise.all([
    dashboardRepository.chiffresCles(),
    dashboardRepository.variationsDuMois(),
    projectRepository.lister({ statut: 'IN_PROGRESS', limite: 5 }),
    dashboardRepository.activitesRecentes(8),
  ]);

  const hope = depuisBase(chiffres.donsHope);
  const investi = depuisBase(chiffres.investi);
  const affectes = depuisBase(chiffres.donsAffectes);
  const total = depuisBase(chiffres.donsTotal);
  const depenses = depuisBase(chiffres.depensesTotal);

  return {
    stats: {
      ...chiffres,
      // Ce que HOPE peut encore engager librement.
      fondsDisponible: centimesVersTexte(hope - investi),
      tauxInvestissement: pourcentage(investi, hope),
      tauxDepense: pourcentage(depenses, affectes + investi),
      partAffectee: pourcentage(affectes, total),
      partHope: pourcentage(hope, total),
    },
    trends: variations,
    activeProjects: projets.map(enrichirProjet),
    recentActivities: activites,
  };
}
