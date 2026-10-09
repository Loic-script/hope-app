import * as impactRepository from '../repositories/impact.repository.js';
import * as projectRepository from '../repositories/project.repository.js';
import { INDICATEURS_SUGGERES } from './impact.service.js';
import { recupererApercu } from './project.service.js';

const TYPES_BENEFICIAIRE = {
  ORPHAN: 'Orphelins',
  SINGLE_MOTHER: 'Mères célibataires',
  FAMILY: 'Familles',
  OTHER: 'Autres',
};

const GENRES = { F: 'Féminin', M: 'Masculin', OTHER: 'Autre' };

function repartir(lignes, cle) {
  const comptes = new Map();
  for (const ligne of lignes) {
    const libelle = cle(ligne);
    comptes.set(libelle, (comptes.get(libelle) ?? 0) + 1);
  }
  return [...comptes.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([libelle, nombre]) => ({ libelle, nombre }));
}

function tranchDage(naissance) {
  if (!naissance) return 'Âge non renseigné';
  const jour = new Date(naissance);
  if (Number.isNaN(jour.getTime())) return 'Âge non renseigné';

  const age = Math.floor((Date.now() - jour.getTime()) / (365.25 * 24 * 3600 * 1000));
  if (age < 18) return 'Moins de 18 ans';
  if (age < 60) return 'De 18 à 59 ans';
  return '60 ans et plus';
}

function resumeBeneficiaires(liste, cible) {
  const suivis = liste.filter((personne) => personne.status !== 'WITHDRAWN');
  const nombreCible = Number(cible) || 0;

  return {
    accompagnes: suivis.length,
    cible: nombreCible || null,
    part: nombreCible > 0 ? Math.round((suivis.length * 1000) / nombreCible) / 10 : null,
    sortis: liste.length - suivis.length,
    parType: repartir(suivis, (p) => TYPES_BENEFICIAIRE[p.beneficiaryType] ?? 'Autres'),
    parGenre: repartir(suivis, (p) => GENRES[p.gender] ?? 'Non précisé'),
    parAge: repartir(suivis, (p) => tranchDage(p.birthDate)),
    parLieu: repartir(suivis, (p) => p.city || 'Lieu non précisé').slice(0, 8),
  };
}

export async function ficheHorsAdmin(projetId, { bailleurId = null } = {}) {
  const [fiche, apercu, impacts, synthese] = await Promise.all([
    projectRepository.trouverPourBailleur(projetId),
    recupererApercu(projetId),
    impactRepository.listerPourBenevole(projetId),
    impactRepository.syntheseParProjet(projetId),
  ]);

  const finance = apercu.finance;

  const affectations = apercu.funderAllocations ?? [];
  const miennes =
    bailleurId === null ? [] : affectations.filter((a) => String(a.bailleurId) === String(bailleurId));
  const somme = (lignes) => lignes.reduce((total, a) => total + Number(a.montant ?? 0), 0);

  const parPoste = new Map();
  for (const depense of apercu.expenses ?? []) {
    if (depense.status === 'CANCELLED') continue;
    const poste = depense.category || 'Autre';
    const cumul = parPoste.get(poste) ?? { total: 0, nombre: 0 };
    cumul.total += Number(depense.amount ?? 0);
    cumul.nombre += 1;
    parPoste.set(poste, cumul);
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
      .sort((a, b) => b[1].total - a[1].total)
      .map(([categorie, cumul]) => ({ categorie, total: cumul.total, nombre: cumul.nombre })),
    beneficiaires: resumeBeneficiaires(
      apercu.beneficiaries ?? [],
      apercu.project.beneficiaryTarget
    ),
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
