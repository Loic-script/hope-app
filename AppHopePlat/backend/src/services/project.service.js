/**
 * Service des projets.
 *
 * Cycle de vie voulu par HOPE :
 *
 *   creation -> EN COURS -> (Terminer + resultat) -> TERMINE -> ARCHIVE
 *
 * Un projet nait toujours EN COURS. Il porte son "budget necessaire" ; ce
 * budget est finance par les dons affectes et par les investissements du
 * fonds HOPE, et consomme par les depenses.
 */
import { transaction } from '../config/database.js';
import * as projectRepository from '../repositories/project.repository.js';
import * as categoryRepository from '../repositories/projectCategory.repository.js';
import * as donationRepository from '../repositories/donation.repository.js';
import * as investmentRepository from '../repositories/investment.repository.js';
import * as expenseRepository from '../repositories/expense.repository.js';
import * as documentRepository from '../repositories/document.repository.js';
import * as beneficiaryRepository from '../repositories/beneficiary.repository.js';
import * as impactRepository from '../repositories/impact.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

import * as mediaService from './media.service.js';

import { ErreurIntrouvable, ErreurRegleMetier, ErreurValidation } from '../shared/errors.js';
import { centimesVersTexte, depuisBase, enCentimes, normaliserDevise, pourcentage } from '../shared/money.js';
import {
  dateRequise,
  identifiantFacultatif,
  identifiantRequis,
  pagination,
  texteFacultatif,
  texteRequis,
  valeurParmi,
} from '../shared/validation.js';

export const STATUTS = ['IN_PROGRESS', 'COMPLETED', 'ARCHIVED'];

/**
 * Ajoute les indicateurs derives d'un projet.
 *
 *   finance   = dons affectes + investissements du fonds HOPE
 *   restant   = ce qu'il manque encore pour couvrir le budget necessaire
 *   engageable = fonds recus non encore depenses
 */
function enrichir(projet) {
  if (!projet) return null;

  const requis = depuisBase(projet.requiredBudget);
  const finance = depuisBase(projet.fundedTotal);
  const depense = depuisBase(projet.spentTotal);

  return {
    ...projet,
    fundingRate: pourcentage(finance, requis),
    spendingRate: pourcentage(depense, finance),
    remainingNeed: centimesVersTexte(Math.max(0, requis - finance)),
    availableFunds: centimesVersTexte(finance - depense),
    isFullyFunded: finance >= requis,
    isOpen: projet.status === 'IN_PROGRESS',
  };
}

/** Refuse toute ecriture sur un projet qui n'est plus en cours. */
function exigerProjetEnCours(projet) {
  if (projet.status === 'COMPLETED') {
    throw new ErreurRegleMetier(
      'Ce projet est terminé. Rouvrez-le pour pouvoir le modifier.',
      'PROJET_TERMINE'
    );
  }
  if (projet.status === 'ARCHIVED') {
    throw new ErreurRegleMetier(
      'Ce projet est archivé : aucune écriture n’est possible.',
      'PROJET_ARCHIVE'
    );
  }
}

/** Valide et normalise les champs du formulaire de projet. */
/**
 * Nombre d'objectifs specifiques acceptes par projet.
 *
 * Dix : au-dela, ce ne sont plus des objectifs mais un plan d'action,
 * et la liste cesse de se relire d'un coup d'oeil.
 */
export const MAX_OBJECTIFS = 10;

/**
 * Nettoie la liste des objectifs specifiques.
 *
 * Les lignes vides sont retirees plutot que refusees : le formulaire en
 * laisse une derriere lui des qu'on clique "+ Ajouter" sans la remplir,
 * et bloquer l'enregistrement pour cela serait penible.
 *
 * @param {unknown} valeur ce qu'a envoye le client
 * @returns {string[]} libelles, dans l'ordre de saisie
 */
function preparerObjectifs(valeur) {
  if (!Array.isArray(valeur)) {
    throw new ErreurValidation('Les objectifs spécifiques doivent former une liste.', {
      objectives: 'Format invalide',
    });
  }

  const libelles = valeur
    .map((element) => (typeof element === 'string' ? element : element?.label))
    .map((libelle) => String(libelle ?? '').trim())
    .filter((libelle) => libelle !== '');

  if (libelles.length > MAX_OBJECTIFS) {
    throw new ErreurValidation(
      `Un projet ne peut pas porter plus de ${MAX_OBJECTIFS} objectifs spécifiques.`,
      { objectives: 'Trop d’objectifs' }
    );
  }

  for (const libelle of libelles) {
    if (libelle.length > 300) {
      throw new ErreurValidation('Un objectif spécifique ne peut pas dépasser 300 caractères.', {
        objectives: 'Objectif trop long',
      });
    }
  }

  return libelles;
}

async function preparerDonnees(corps, { creation }) {
  const donnees = {};

  if (creation || corps.name !== undefined) {
    donnees.name = texteRequis(corps.name, 'name', { max: 200 });
  }
  if (creation || corps.description !== undefined) {
    donnees.description = texteFacultatif(corps.description, 'description', { max: 5000 });
  }
  if (creation || corps.categoryId !== undefined) {
    donnees.categoryId = identifiantFacultatif(corps.categoryId, 'categoryId');
    if (donnees.categoryId !== null) {
      const categorie = await categoryRepository.trouverParId(donnees.categoryId);
      if (!categorie) throw new ErreurIntrouvable('La catégorie', donnees.categoryId);
    }
  }
  if (creation || corps.location !== undefined) {
    donnees.location = texteFacultatif(corps.location, 'location', { max: 160 });
  }
  if (creation || corps.managerName !== undefined) {
    donnees.managerName = texteFacultatif(corps.managerName, 'managerName', { max: 160 });
  }
  // La date de debut n'est pas saisissable : un projet demarre le jour de sa
  // creation. Elle est fixee ici, et plus jamais modifiee ensuite.
  if (creation) {
    donnees.startDate = dateRequise(null, 'startDate', { defautAujourdhui: true });
  }
  if (creation || corps.beneficiaryProfile !== undefined) {
    donnees.beneficiaryProfile = texteFacultatif(corps.beneficiaryProfile, 'beneficiaryProfile', {
      max: 200,
    });
  }
  if (creation || corps.beneficiaryTarget !== undefined) {
    donnees.beneficiaryTarget = identifiantFacultatif(corps.beneficiaryTarget, 'beneficiaryTarget');
  }
  if (creation || corps.currency !== undefined) {
    donnees.currency = normaliserDevise(corps.currency, 'currency');
  }
  if (creation || corps.mediaUrl !== undefined) {
    donnees.mediaUrl = texteFacultatif(corps.mediaUrl, 'mediaUrl', { max: 500 });
    donnees.mediaType = donnees.mediaUrl
      ? valeurParmi(corps.mediaType, 'mediaType', ['PHOTO', 'VIDEO'], { defaut: 'PHOTO' })
      : null;
  }
  if (creation || corps.objectives !== undefined) {
    donnees.objectives = preparerObjectifs(corps.objectives ?? []);
  }

  return donnees;
}

/** Liste paginee et filtrable. */
export async function lister(requete = {}) {
  const { page, taille, decalage } = pagination(requete);

  const filtres = {
    statut: requete.status ? valeurParmi(requete.status, 'status', STATUTS) : null,
    categorieId: identifiantFacultatif(requete.categoryId, 'categoryId'),
    recherche: texteFacultatif(requete.search, 'search', { max: 120 }),
    inclureArchives: requete.includeArchived === 'true' || requete.includeArchived === true,
    limite: taille,
    decalage,
  };

  const [projets, total] = await Promise.all([
    projectRepository.lister(filtres),
    projectRepository.compter(filtres),
  ]);

  return { items: projets.map(enrichir), total, page, pageSize: taille };
}

export async function recupererParId(id) {
  const projet = await projectRepository.trouverParId(identifiantRequis(id, 'id'));
  if (!projet) throw new ErreurIntrouvable('Le projet', id);
  return enrichir(projet);
}

/** Vue complete : tout ce qu'affichent les onglets de la fiche projet. */
export async function recupererApercu(id) {
  const projectId = identifiantRequis(id, 'id');
  const projet = await projectRepository.trouverParId(projectId);
  if (!projet) throw new ErreurIntrouvable('Le projet', projectId);

  const [dons, investissements, depenses, justificatifs, beneficiaires, impacts, syntheseImpacts] =
    await Promise.all([
      donationRepository.lister({ projectId, limite: 200 }),
      investmentRepository.listerParProjet(projectId),
      expenseRepository.lister({ projectId, limite: 200 }),
      documentRepository.lister({ projectId }),
      beneficiaryRepository.listerParProjet(projectId),
      impactRepository.lister({ projectId }),
      impactRepository.syntheseParProjet(projectId),
    ]);

  const enrichi = enrichir(projet);

  return {
    project: enrichi,
    finance: {
      requiredBudget: projet.requiredBudget,
      designatedTotal: projet.designatedTotal,
      investedHopeTotal: projet.investedHopeTotal,
      fundedTotal: projet.fundedTotal,
      spentTotal: projet.spentTotal,
      remainingNeed: enrichi.remainingNeed,
      availableFunds: enrichi.availableFunds,
      fundingRate: enrichi.fundingRate,
      spendingRate: enrichi.spendingRate,
    },
    donations: dons,
    investments: investissements,
    expenses: depenses,
    documents: justificatifs,
    beneficiaries: beneficiaires,
    impacts,
    impactSummary: syntheseImpacts,
  };
}

/** Cree un projet. Il demarre systematiquement en cours. */
export async function creer(corps = {}, auteur = null) {
  const donnees = await preparerDonnees(corps, { creation: true });
  const budget = enCentimes(corps.requiredBudget, 'requiredBudget');

  const projet = await projectRepository.creer({
    ...donnees,
    reference: await projectRepository.genererReference(),
    requiredBudget: centimesVersTexte(budget),
  });

  await activityLogRepository.deposer(auteur, {
    action: 'CREATE',
    entityType: 'PROJECT',
    entityId: projet.id,
    label: `a créé le projet « ${projet.name} »`,
  });

  return enrichir(projet);
}

/** Modifie un projet en cours. */
export async function mettreAJour(id, corps = {}) {
  const projectId = identifiantRequis(id, 'id');
  const existant = await projectRepository.trouverParId(projectId);
  if (!existant) throw new ErreurIntrouvable('Le projet', projectId);
  exigerProjetEnCours(existant);

  const donnees = await preparerDonnees(corps, { creation: false });

  const colonnes = {
    category_id: donnees.categoryId,
    name: donnees.name,
    description: donnees.description,
    location: donnees.location,
    manager_name: donnees.managerName,
    start_date: donnees.startDate,
    beneficiary_profile: donnees.beneficiaryProfile,
    beneficiary_target: donnees.beneficiaryTarget,
    currency: donnees.currency,
    media_url: donnees.mediaUrl,
    media_type: donnees.mediaType,
  };

  // Le budget necessaire ne peut pas descendre sous ce qui est deja engage.
  if (corps.requiredBudget !== undefined) {
    const nouveau = enCentimes(corps.requiredBudget, 'requiredBudget');
    const depense = depuisBase(existant.spentTotal);

    if (nouveau < depense) {
      throw new ErreurRegleMetier(
        `Le budget nécessaire ne peut pas être inférieur aux ${centimesVersTexte(depense)} déjà dépensés.`,
        'BUDGET_INFERIEUR_AUX_DEPENSES'
      );
    }
    colonnes.required_budget = centimesVersTexte(nouveau);
  }

  // Les objectifs ne sont pas une colonne : ils vivent dans leur propre
  // table, et ne sont reecrits que si le client les a envoyes.
  if (donnees.objectives !== undefined) {
    await projectRepository.remplacerObjectifs(projectId, donnees.objectives);
  }

  const misAJour = await projectRepository.mettreAJour(projectId, colonnes);

  // Le media precedent devient inutile : on libere le disque. Une adresse
  // externe n'est evidemment pas touchee.
  if (colonnes.media_url !== undefined && existant.mediaUrl !== colonnes.media_url) {
    await mediaService.supprimer(existant.mediaUrl);
  }

  return enrichir(misAJour);
}

/**
 * Termine un projet et enregistre son resultat.
 * Le resultat est obligatoire : c'est lui qui alimente l'ecran Impact.
 */
export async function terminer(id, corps = {}, auteur = null) {
  const projectId = identifiantRequis(id, 'id');

  return transaction(async (client) => {
    const projet = await projectRepository.trouverPourMiseAJour(projectId, client);
    if (!projet) throw new ErreurIntrouvable('Le projet', projectId);

    if (projet.status !== 'IN_PROGRESS') {
      throw new ErreurRegleMetier("Ce projet n'est plus en cours.", 'PROJET_NON_EN_COURS');
    }

    const resultat = texteRequis(corps.outcome, 'outcome', { max: 5000 });
    const termine = await projectRepository.terminer(projectId, resultat, client);

    await notificationRepository.creer(
      {
        type: 'PROJECT_COMPLETED',
        projectId,
        label: `Le projet « ${termine.name} » est terminé`,
      },
      client
    );

    await activityLogRepository.deposer(
      auteur,
      {
        action: 'COMPLETE',
        entityType: 'PROJECT',
        entityId: projectId,
        label: `a marqué « ${termine.name} » comme terminé`,
      },
      client
    );

    return enrichir(termine);
  });
}

/** Rouvre un projet termine. */
export async function rouvrir(id) {
  const projectId = identifiantRequis(id, 'id');
  const projet = await projectRepository.trouverParId(projectId);
  if (!projet) throw new ErreurIntrouvable('Le projet', projectId);

  if (projet.status === 'IN_PROGRESS') {
    throw new ErreurRegleMetier('Ce projet est déjà en cours.', 'PROJET_DEJA_EN_COURS');
  }
  return enrichir(await projectRepository.rouvrir(projectId));
}

/** Archive un projet deja termine. */
export async function archiver(id) {
  const projectId = identifiantRequis(id, 'id');
  const projet = await projectRepository.trouverParId(projectId);
  if (!projet) throw new ErreurIntrouvable('Le projet', projectId);

  if (projet.status === 'ARCHIVED') {
    throw new ErreurRegleMetier('Ce projet est déjà archivé.', 'DEJA_ARCHIVE');
  }
  if (projet.status !== 'COMPLETED') {
    throw new ErreurRegleMetier(
      'Seul un projet terminé peut être archivé. Terminez-le d’abord.',
      'PROJET_NON_TERMINE'
    );
  }
  return enrichir(await projectRepository.archiver(projectId));
}

/**
 * Supprime un projet.
 *
 * La suppression n'est possible que sur un projet vierge de tout mouvement
 * financier : dès qu'un don, un investissement ou une dépense s'y rattache,
 * l'historique comptable prime et le projet doit être terminé puis archivé.
 */
export async function supprimer(id) {
  const projectId = identifiantRequis(id, 'id');
  const projet = await projectRepository.trouverParId(projectId);
  if (!projet) throw new ErreurIntrouvable('Le projet', projectId);

  const ecritures = await projectRepository.compterEcritures(projectId);
  const total = ecritures.dons + ecritures.investissements + ecritures.depenses;

  if (total > 0) {
    const details = [
      ecritures.dons > 0 ? `${ecritures.dons} don(s)` : null,
      ecritures.investissements > 0 ? `${ecritures.investissements} investissement(s)` : null,
      ecritures.depenses > 0 ? `${ecritures.depenses} dépense(s)` : null,
    ]
      .filter(Boolean)
      .join(', ');

    throw new ErreurRegleMetier(
      `Ce projet porte ${details} : il ne peut pas être supprimé. Terminez-le puis archivez-le pour conserver l’historique.`,
      'PROJET_AVEC_ECRITURES',
      ecritures
    );
  }

  await projectRepository.supprimer(projectId);
  await mediaService.supprimer(projet.mediaUrl);

  return { id: projectId, deleted: true };
}

/** Projets termines, pour l'ecran Impact. */
export async function listerTermines() {
  const projets = await projectRepository.listerTermines();
  return { items: projets.map(enrichir) };
}

/**
 * Charge un projet et refuse l'operation s'il n'accepte plus d'ecriture.
 * Utilise par les services investissement, depense, beneficiaire et impact.
 */
export async function chargerProjetOuvert(projectId, client = null) {
  const projet = client
    ? await projectRepository.trouverPourMiseAJour(projectId, client)
    : await projectRepository.trouverParId(projectId);

  if (!projet) throw new ErreurIntrouvable('Le projet', projectId);
  exigerProjetEnCours(projet);
  return projet;
}
