import { transaction } from '../config/database.js';
import * as donationRepository from '../repositories/donation.repository.js';
import * as investmentRepository from '../repositories/investment.repository.js';
import * as projectRepository from '../repositories/project.repository.js';
import * as expenseRepository from '../repositories/expense.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

import { ErreurIntrouvable, ErreurRegleMetier } from '../shared/errors.js';
import { centimesVersTexte, depuisBase, enCentimes, normaliserDevise, pourcentage } from '../shared/money.js';
import { dateFacultative, identifiantRequis, texteFacultatif, texteRequis } from '../shared/validation.js';

export async function etat() {
  const [fonds, investissements, projets, depenses] = await Promise.all([
    donationRepository.etatDuFonds(),
    investmentRepository.lister({ limite: 50 }),
    projectRepository.lister({ limite: 200 }),
    expenseRepository.lister({ limite: 1 }),
  ]);

  const affectes = depuisBase(fonds.donsAffectes);
  const hope = depuisBase(fonds.donsHope);
  const investi = depuisBase(fonds.dejaInvesti);
  const total = depuisBase(fonds.totalRecu);

  const disponible = hope - investi;

  return {
    summary: {
      designatedTotal: centimesVersTexte(affectes),
      hopeTotal: centimesVersTexte(hope),
      grandTotal: centimesVersTexte(total),

      investedTotal: centimesVersTexte(investi),
      availableTotal: centimesVersTexte(disponible),
      investedRate: pourcentage(investi, hope),

      designatedShare: pourcentage(affectes, total),
      hopeShare: pourcentage(hope, total),

      donationsCount: fonds.nombreDons,
      designatedCount: fonds.nombreAffectes,
      hopeCount: fonds.nombreHope,
      monthlyCount: fonds.nombreMensuels,
      investmentsCount: investissements.length,
      unusedFlag: disponible > 0,
    },
    investments: investissements,
    projects: projets
      .filter((projet) => projet.status === 'IN_PROGRESS')
      .map((projet) => {
        const requis = depuisBase(projet.requiredBudget);
        const finance = depuisBase(projet.fundedTotal);
        return {
          id: projet.id,
          reference: projet.reference,
          name: projet.name,
          currency: projet.currency,
          requiredBudget: projet.requiredBudget,
          fundedTotal: projet.fundedTotal,
          remainingNeed: centimesVersTexte(Math.max(0, requis - finance)),
          fundingRate: pourcentage(finance, requis),
        };
      }),
    hasExpenses: depenses.length > 0,
  };
}

export async function listerInvestissements(requete = {}) {
  const investissements = await investmentRepository.lister({
    recherche: texteFacultatif(requete.search, 'search', { max: 120 }),
  });
  return { items: investissements };
}

export async function investir(corps = {}, auteur = null) {
  const projectId = identifiantRequis(corps.projectId, 'projectId');
  const montant = enCentimes(corps.amount, 'amount');
  const justification = texteRequis(corps.justification, 'justification', { max: 2000 });
  const devise = normaliserDevise(corps.currency, 'currency');

  return transaction(async (client) => {
    const projet = await projectRepository.trouverPourMiseAJour(projectId, client);
    if (!projet) throw new ErreurIntrouvable('Le projet', projectId);

    if (projet.status !== 'IN_PROGRESS') {
      throw new ErreurRegleMetier(
        'Seul un projet en cours peut recevoir un investissement.',
        'PROJET_FERME'
      );
    }

    const fonds = await donationRepository.verrouillerFondsHope(client);
    const disponible = depuisBase(fonds.donsHope) - depuisBase(fonds.dejaInvesti);

    if (montant > disponible) {
      throw new ErreurRegleMetier(
        `Fonds HOPE insuffisant : il reste ${centimesVersTexte(disponible)} à investir.`,
        'FONDS_INSUFFISANT',
        {
          hopeTotal: fonds.donsHope,
          investedTotal: fonds.dejaInvesti,
          availableTotal: centimesVersTexte(disponible),
          requestedAmount: centimesVersTexte(montant),
        }
      );
    }

    const requis = depuisBase(projet.requiredBudget);
    const finance = depuisBase(projet.designatedTotal) + depuisBase(projet.investedHopeTotal);
    const besoinRestant = requis - finance;

    if (besoinRestant <= 0) {
      throw new ErreurRegleMetier(
        `« ${projet.name} » couvre déjà son budget nécessaire de ${centimesVersTexte(requis)}.`,
        'PROJET_DEJA_FINANCE',
        { requiredBudget: projet.requiredBudget, fundedTotal: centimesVersTexte(finance) }
      );
    }

    if (montant > besoinRestant) {
      throw new ErreurRegleMetier(
        `« ${projet.name} » n’a plus besoin que de ${centimesVersTexte(besoinRestant)}.`,
        'INVESTISSEMENT_SUPERIEUR_AU_BESOIN',
        {
          requiredBudget: projet.requiredBudget,
          fundedTotal: centimesVersTexte(finance),
          remainingNeed: centimesVersTexte(besoinRestant),
          requestedAmount: centimesVersTexte(montant),
        }
      );
    }

    const investissement = await investmentRepository.creer(
      {
        reference: await investmentRepository.genererReference(client),
        projectId,
        amount: centimesVersTexte(montant),
        currency: devise,
        justification,
        investedAt: dateFacultative(corps.investedAt, 'investedAt'),
      },
      client
    );

    await notificationRepository.creer(
      {
        type: 'INVESTMENT',
        projectId,
        label:
          `${centimesVersTexte(montant)} ${devise} du fonds HOPE investis ` +
          `dans « ${projet.name} »`,
      },
      client
    );

    await activityLogRepository.deposer(
      auteur,
      {
        action: 'INVEST',
        entityType: 'PROJECT',
        entityId: projectId,
        label:
          `a investi ${centimesVersTexte(montant)} ${devise} du fonds HOPE ` +
          `dans « ${projet.name} »`,
      },
      client
    );

    return {
      investment: investissement,
      availableTotal: centimesVersTexte(disponible - montant),
      remainingNeed: centimesVersTexte(besoinRestant - montant),
    };
  });
}
