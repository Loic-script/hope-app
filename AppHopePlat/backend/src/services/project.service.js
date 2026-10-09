import { transaction } from '../config/database.js';
import * as projectRepository from '../repositories/project.repository.js';
import * as taskRepository from '../repositories/task.repository.js';
import * as categoryRepository from '../repositories/projectCategory.repository.js';
import * as donationRepository from '../repositories/donation.repository.js';
import * as funderRepository from '../repositories/funder.repository.js';
import * as investmentRepository from '../repositories/investment.repository.js';
import * as expenseRepository from '../repositories/expense.repository.js';
import * as documentRepository from '../repositories/document.repository.js';
import * as beneficiaryRepository from '../repositories/beneficiary.repository.js';
import * as impactRepository from '../repositories/impact.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

import * as mediaService from './media.service.js';
import { CATEGORIES as CATEGORIES_DEPENSE } from './expense.service.js';

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

export const TYPES = ['HOPE', 'INTERNAL'];

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

export const MAX_OBJECTIFS = 10;

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

export const MAX_POSTES_DEVIS = 30;

function preparerDevis(valeur) {
  if (!Array.isArray(valeur)) {
    throw new ErreurValidation('Le devis doit former une liste de postes.', {
      quoteItems: 'Format invalide',
    });
  }

  const lignes = valeur.filter((ligne) => {
    const categorie = String(ligne?.category ?? '').trim();
    const montant = String(ligne?.amount ?? '').trim();
    return categorie !== '' || montant !== '';
  });

  if (lignes.length > MAX_POSTES_DEVIS) {
    throw new ErreurValidation(`Un devis ne peut pas dépasser ${MAX_POSTES_DEVIS} postes.`, {
      quoteItems: 'Trop de postes',
    });
  }

  const vues = new Set();

  return lignes.map((ligne, rang) => {
    const categorie = String(ligne?.category ?? '').trim();
    if (categorie === '') {
      throw new ErreurValidation(`Le poste ${rang + 1} du devis n’a pas de catégorie.`, {
        quoteItems: 'Catégorie manquante',
      });
    }
    if (!CATEGORIES_DEPENSE.includes(categorie)) {
      throw new ErreurValidation(`La catégorie « ${categorie} » n’existe pas.`, {
        quoteItems: 'Catégorie inconnue',
      });
    }
    if (vues.has(categorie)) {
      throw new ErreurValidation(
        `La catégorie « ${categorie} » figure deux fois : additionnez les montants.`,
        { quoteItems: 'Catégorie en double' }
      );
    }
    vues.add(categorie);

    const libelle = String(ligne?.label ?? '').trim() || categorie;
    if (libelle.length > 200) {
      throw new ErreurValidation(`L’intitulé du poste ${rang + 1} dépasse 200 caractères.`, {
        quoteItems: 'Intitulé trop long',
      });
    }

    if (String(ligne?.amount ?? '').trim() === '') {
      throw new ErreurValidation(`Le poste ${rang + 1} du devis n’a pas de montant.`, {
        quoteItems: 'Montant manquant',
      });
    }
    const centimes = enCentimes(ligne.amount, `montant du poste ${rang + 1}`);
    return {
      label: libelle,
      category: categorie,
      amount: centimesVersTexte(centimes),
      centimes,
    };
  });
}

async function preparerDonnees(corps, { creation }) {
  const donnees = {};

  if (creation || corps.name !== undefined) {
    donnees.name = texteRequis(corps.name, 'name', { max: 200 });
  }
  if (creation || corps.projectType !== undefined) {
    donnees.projectType = valeurParmi(corps.projectType, 'projectType', TYPES, {
      defaut: 'HOPE',
    });
  }
  if (creation || corps.descriptionTitre !== undefined) {
    donnees.descriptionTitre = texteFacultatif(corps.descriptionTitre, 'descriptionTitre', {
      max: 160,
    });
  }
  if (creation || corps.description !== undefined) {
    donnees.description = texteFacultatif(corps.description, 'description', { max: 5000 });
  }
  if (corps.categoryName !== undefined) {
    const nom = texteFacultatif(corps.categoryName, 'categoryName', { max: 120 });
    donnees.categoryId = nom === null ? null : (await categoryRepository.trouverOuCreerParNom(nom)).id;
  } else if (creation || corps.categoryId !== undefined) {
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
  if (creation || corps.quoteItems !== undefined) {
    donnees.quoteItems = preparerDevis(corps.quoteItems ?? []);
  }

  return donnees;
}

function budgetNecessaire(devis, montantSaisi, { obligatoire = false } = {}) {
  if (devis !== undefined && devis.length > 0) {
    return devis.reduce((total, ligne) => total + ligne.centimes, 0);
  }
  if (obligatoire || montantSaisi !== undefined) {
    return enCentimes(montantSaisi, 'requiredBudget');
  }
  return null;
}

export async function lister(requete = {}) {
  const { page, taille, decalage } = pagination(requete);

  const filtres = {
    statut: requete.status ? valeurParmi(requete.status, 'status', STATUTS) : null,
    categorieId: identifiantFacultatif(requete.categoryId, 'categoryId'),
    type: requete.projectType ? valeurParmi(requete.projectType, 'projectType', TYPES) : null,
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

export async function recupererApercu(id) {
  const projectId = identifiantRequis(id, 'id');
  const projet = await projectRepository.trouverParId(projectId);
  if (!projet) throw new ErreurIntrouvable('Le projet', projectId);

  const [
    dons,
    investissements,
    depenses,
    justificatifs,
    beneficiaires,
    impacts,
    syntheseImpacts,
    taches,
    affectationsBailleurs,
  ] = await Promise.all([
    donationRepository.lister({ projectId, limite: 200 }),
    investmentRepository.listerParProjet(projectId),
    expenseRepository.lister({ projectId, limite: 200 }),
    documentRepository.lister({ projectId }),
    beneficiaryRepository.listerParProjet(projectId),
    impactRepository.lister({ projectId }),
    impactRepository.syntheseParProjet(projectId),
    taskRepository.lister({ projetId: projectId }),
    funderRepository.affectationsDuProjet(projectId),
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
    funderAllocations: affectationsBailleurs,
    investments: investissements,
    expenses: depenses,
    documents: justificatifs,
    beneficiaries: beneficiaires,
    impacts,
    impactSummary: syntheseImpacts,
    tasks: taches,
  };
}

export async function creer(corps = {}, auteur = null) {
  const donnees = await preparerDonnees(corps, { creation: true });
  const budget = budgetNecessaire(donnees.quoteItems, corps.requiredBudget, {
    obligatoire: true,
  });

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

export async function mettreAJour(id, corps = {}) {
  const projectId = identifiantRequis(id, 'id');
  const existant = await projectRepository.trouverParId(projectId);
  if (!existant) throw new ErreurIntrouvable('Le projet', projectId);
  exigerProjetEnCours(existant);

  const donnees = await preparerDonnees(corps, { creation: false });

  const colonnes = {
    category_id: donnees.categoryId,
    name: donnees.name,
    project_type: donnees.projectType,
    description_titre: donnees.descriptionTitre,
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

  const nouveau = budgetNecessaire(donnees.quoteItems, corps.requiredBudget);
  if (nouveau !== null) {
    const depense = depuisBase(existant.spentTotal);
    const parLeDevis = donnees.quoteItems !== undefined && donnees.quoteItems.length > 0;

    if (nouveau < depense) {
      throw new ErreurRegleMetier(
        parLeDevis
          ? `Le devis totalise ${centimesVersTexte(nouveau)}, moins que les ${centimesVersTexte(depense)} déjà dépensés. Retirez moins de postes, ou revoyez leurs montants.`
          : `Le budget nécessaire ne peut pas être inférieur aux ${centimesVersTexte(depense)} déjà dépensés.`,
        'BUDGET_INFERIEUR_AUX_DEPENSES'
      );
    }
    colonnes.required_budget = centimesVersTexte(nouveau);
  }

  if (donnees.objectives !== undefined) {
    await projectRepository.remplacerObjectifs(projectId, donnees.objectives);
  }
  if (donnees.quoteItems !== undefined) {
    await projectRepository.remplacerDevis(projectId, donnees.quoteItems);
  }

  const misAJour = await projectRepository.mettreAJour(projectId, colonnes);

  if (colonnes.media_url !== undefined && existant.mediaUrl !== colonnes.media_url) {
    await mediaService.supprimer(existant.mediaUrl);
  }

  return enrichir(misAJour);
}

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

export async function rouvrir(id) {
  const projectId = identifiantRequis(id, 'id');
  const projet = await projectRepository.trouverParId(projectId);
  if (!projet) throw new ErreurIntrouvable('Le projet', projectId);

  if (projet.status === 'IN_PROGRESS') {
    throw new ErreurRegleMetier('Ce projet est déjà en cours.', 'PROJET_DEJA_EN_COURS');
  }
  return enrichir(await projectRepository.rouvrir(projectId));
}

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

export async function supprimer(id, { force = false, admin = null } = {}) {
  const projectId = identifiantRequis(id, 'id');
  const projet = await projectRepository.trouverParId(projectId);
  if (!projet) throw new ErreurIntrouvable('Le projet', projectId);

  const ecritures = await projectRepository.compterEcritures(projectId);
  const total = ecritures.dons + ecritures.investissements + ecritures.depenses;

  if (force && total > 0) {
    await transaction(async (client) => {
      const touche = await projectRepository.detacherEcritures(projectId, client);
      await activityLogRepository.deposer(
        admin,
        {
          action: 'DELETE',
          entityType: 'PROJECT',
          entityId: projectId,
          label:
            `a supprimé de force le projet « ${projet.name} » (${projet.reference}) : ` +
            `${touche.donsDetaches} don(s) rendus aux fonds HOPE, ` +
            `${touche.depenses} dépense(s), ${touche.investissements} investissement(s), ` +
            `${touche.affectations} affectation(s) de partenaire et ${touche.missions} mission(s) effacés`,
        },
        client
      );
      await projectRepository.supprimer(projectId, client);
    });

    await mediaService.supprimer(projet.mediaUrl);
    return { id: projectId, deleted: true, force: true };
  }

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

export async function listerTermines() {
  const projets = await projectRepository.listerTermines();
  return { items: projets.map(enrichir) };
}

export async function chargerProjetOuvert(projectId, client = null) {
  const projet = client
    ? await projectRepository.trouverPourMiseAJour(projectId, client)
    : await projectRepository.trouverParId(projectId);

  if (!projet) throw new ErreurIntrouvable('Le projet', projectId);
  exigerProjetEnCours(projet);
  return projet;
}
