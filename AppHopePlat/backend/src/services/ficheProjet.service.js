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
 *   - les depenses sont regroupees par poste : jamais le detail ligne a
 *     ligne, dont le libelle libre et le fournisseur peuvent nommer
 *     quelqu'un. C'est la regle du rapport envoye aux partenaires ;
 *   - les beneficiaires ne sont que des comptes -- par type, par genre,
 *     par tranche d'age, par lieu. Aucune identite ne sort d'ici ;
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

/** Les libelles lisibles des types de beneficiaire et des genres. */
const TYPES_BENEFICIAIRE = {
  ORPHAN: 'Orphelins',
  SINGLE_MOTHER: 'Mères célibataires',
  FAMILY: 'Familles',
  OTHER: 'Autres',
};

const GENRES = { F: 'Féminin', M: 'Masculin', OTHER: 'Autre' };

/** Compte les elements par cle, du plus nombreux au moins nombreux. */
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

/** La tranche d'age, jamais la date de naissance elle-meme. */
function tranchDage(naissance) {
  if (!naissance) return 'Âge non renseigné';
  const jour = new Date(naissance);
  if (Number.isNaN(jour.getTime())) return 'Âge non renseigné';

  const age = Math.floor((Date.now() - jour.getTime()) / (365.25 * 24 * 3600 * 1000));
  if (age < 18) return 'Moins de 18 ans';
  if (age < 60) return 'De 18 à 59 ans';
  return '60 ans et plus';
}

/**
 * Les beneficiaires d'un projet, en comptes seulement.
 *
 * Un partenaire lit combien de personnes sont accompagnees, et comment
 * elles se repartissent. Ni nom, ni date de naissance, ni note : ces
 * champs ne quittent pas l'espace d'administration.
 */
function resumeBeneficiaires(liste, cible) {
  // Comme dans le rapport : une personne sortie du projet n'est plus
  // comptee parmi les accompagnes.
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

  // Les depenses par poste ; une depense annulee ne compte pas. On garde
  // le montant et le nombre de depenses, jamais leur libelle.
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
