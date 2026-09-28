/**
 * Service de l'ecran Statistiques.
 *
 * Trois familles, comme demande : le budget, les projets, les donateurs.
 * Les series sont accompagnees de leur maximum pour que le frontend dessine
 * ses barres sans avoir a recalculer une echelle.
 */
import * as statisticsRepository from '../repositories/statistics.repository.js';
import * as donationRepository from '../repositories/donation.repository.js';
import * as expenseRepository from '../repositories/expense.repository.js';

import { centimesVersTexte, depuisBase, pourcentage } from '../shared/money.js';

/** Plus grande valeur d'une serie, utilisee comme echelle des barres. */
function maximum(lignes, champ) {
  return lignes.reduce((plusGrand, ligne) => Math.max(plusGrand, depuisBase(ligne[champ])), 0);
}

export async function recuperer() {
  const [
    parMois,
    parStatut,
    parCategorie,
    meilleursProjets,
    donateurs,
    meilleursDonateurs,
    parPaiement,
    depensesParCategorie,
    fonds,
  ] = await Promise.all([
    statisticsRepository.donsParMois(),
    statisticsRepository.projetsParStatut(),
    statisticsRepository.projetsParCategorie(),
    statisticsRepository.projetsLesPlusFinances(6),
    statisticsRepository.repartitionDonateurs(),
    statisticsRepository.meilleursDonateurs(6),
    statisticsRepository.repartitionParPaiement(),
    expenseRepository.repartitionParCategorie(),
    donationRepository.etatDuFonds(),
  ]);

  const hope = depuisBase(fonds.donsHope);
  const investi = depuisBase(fonds.dejaInvesti);
  const affectes = depuisBase(fonds.donsAffectes);
  const total = depuisBase(fonds.totalRecu);

  return {
    budget: {
      designatedTotal: centimesVersTexte(affectes),
      hopeTotal: centimesVersTexte(hope),
      grandTotal: centimesVersTexte(total),
      investedTotal: centimesVersTexte(investi),
      availableTotal: centimesVersTexte(hope - investi),
      designatedShare: pourcentage(affectes, total),
      hopeShare: pourcentage(hope, total),
      monthlySeries: parMois,
      monthlyMax: maximum(parMois, 'total'),
      paymentBreakdown: parPaiement,
      paymentMax: maximum(parPaiement, 'montant'),
      expenseBreakdown: depensesParCategorie,
      expenseMax: maximum(depensesParCategorie, 'montant'),
    },
    projects: {
      byStatus: parStatut,
      byCategory: parCategorie,
      categoryMax: maximum(parCategorie, 'finance'),
      topFunded: meilleursProjets.map((projet) => ({
        ...projet,
        fundingRate: pourcentage(
          depuisBase(projet.fundedTotal),
          depuisBase(projet.requiredBudget)
        ),
      })),
    },
    donors: {
      ...donateurs,
      accountShare: pourcentage(donateurs.avecCompte, donateurs.total),
      internationalShare: pourcentage(donateurs.internationaux, donateurs.total),
      monthlyShare: pourcentage(
        donateurs.donsMensuels,
        donateurs.donsMensuels + donateurs.donsPonctuels
      ),
      top: meilleursDonateurs,
      topMax: maximum(meilleursDonateurs, 'donationsTotal'),
    },
  };
}
