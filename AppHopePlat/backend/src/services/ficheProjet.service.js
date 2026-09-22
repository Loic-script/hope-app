/**
 * La fiche d'un projet hors de l'administration : ce qu'il est, son
 * financement et son impact, tels que les partenaires et les donateurs
 * les consultent.
 *
 * Chaque champ est choisi un a un, jamais recopie en bloc depuis la vue
 * de l'administration : celle-ci nomme les donateurs, les beneficiaires
 * et les partenaires, et rien de cela ne sort d'ici.
 *
 *   - la fiche est celle de l'espace benevole : ce qu'est le projet, ses
 *     objectifs, un nombre de beneficiaires ;
 *   - le financement ne donne que des totaux par origine -- dons, fonds
 *     HOPE, partenaires -- et, pour un bailleur, ce que LUI y a affecte ;
 *   - les depenses sont regroupees par poste ;
 *   - l'impact ne garde que les mesures collectives, comme le rapport :
 *     l'intitule d'une mesure individuelle peut designer la personne.
 *     Les totaux par indicateur, eux, ne nomment personne ;
 *   - l'avancement compte les actions, et nomme les dernieres realisees.
 *
 * Pas de preuves terrain : ce sont souvent des photos de beneficiaires,
 * et l'equipe les garde dans son back-office.
 *
 * L'appelant verifie d'abord que la personne a le droit de voir le projet.
 */
import * as impactRepository from '../repositories/impact.repository.js';
import * as projectRepository from '../repositories/project.repository.js';
import { INDICATEURS_SUGGERES } from './impact.service.js';
import { recupererApercu } from './project.service.js';

/**
 * @param {number} projetId  un projet dont l'acces est deja verifie
 * @param {{ bailleurId?: string|number|null }} [options]  pour un bailleur :
 *   ce qu'il a affecte au projet, a part
 */
export async function ficheHorsAdmin(projetId, { bailleurId = null } = {}) {
  const [fiche, apercu, impacts, synthese] = await Promise.all([
    projectRepository.trouverPourBailleur(projetId),
    recupererApercu(projetId),
    impactRepository.listerPourBenevole(projetId),
    impactRepository.syntheseParProjet(projetId),
  ]);

  const finance = apercu.finance;

  // Les partenaires : un total et un nombre, jamais un nom.
  const affectations = apercu.funderAllocations ?? [];
  const miennes =
    bailleurId === null ? [] : affectations.filter((a) => String(a.bailleurId) === String(bailleurId));
  const somme = (lignes) => lignes.reduce((total, a) => total + Number(a.montant ?? 0), 0);

  // Les depenses par poste ; une depense annulee ne compte pas.
  const parPoste = new Map();
  for (const depense of apercu.expenses ?? []) {
    if (depense.status === 'CANCELLED') continue;
    const poste = depense.category || 'Autre';
    parPoste.set(poste, (parPoste.get(poste) ?? 0) + Number(depense.amount ?? 0));
  }

  const taches = apercu.tasks ?? [];
  const compte = (statut) => taches.filter((t) => t.statut === statut).length;

  return {
    project: {
      ...fiche,
      currency: apercu.project.currency ?? 'MGA',
      financeParMoi: miennes.length > 0,
    },
    finance: {
      requiredBudget: finance.requiredBudget,
      fundedTotal: finance.fundedTotal,
      fundingRate: finance.fundingRate,
      remainingNeed: finance.remainingNeed,
      spentTotal: finance.spentTotal,
      spendingRate: finance.spendingRate,
      availableFunds: finance.availableFunds,
      designatedTotal: finance.designatedTotal,
      donationsCount: Number(apercu.project.donationsCount ?? 0),
      investedHopeTotal: finance.investedHopeTotal,
      partenairesTotal: somme(affectations),
      partenairesNombre: new Set(affectations.map((a) => a.bailleurId)).size,
      votreAffectation: somme(miennes),
    },
    expensesByCategory: [...parPoste.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([categorie, total]) => ({ categorie, total })),
    progress: {
      realisees: compte('livree'),
      enCours: compte('en_cours'),
      aVenir: compte('a_faire'),
      dernieresRealisees: taches
        .filter((t) => t.statut === 'livree')
        .slice(0, 6)
        .map((t) => t.titre),
    },
    impacts: impacts.filter((impact) => impact.collectif),
    impactSummary: synthese,
    indicators: INDICATEURS_SUGGERES,
  };
}
