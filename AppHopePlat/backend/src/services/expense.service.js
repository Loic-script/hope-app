import { query, transaction } from '../config/database.js';
import * as expenseRepository from '../repositories/expense.repository.js';
import * as projectRepository from '../repositories/project.repository.js';

import { ErreurIntrouvable, ErreurRegleMetier } from '../shared/errors.js';
import { centimesVersTexte, depuisBase, enCentimes, normaliserDevise } from '../shared/money.js';
import {
  dateRequise,
  identifiantFacultatif,
  identifiantRequis,
  pagination,
  texteFacultatif,
  texteRequis,
  valeurParmi,
} from '../shared/validation.js';

export const STATUTS = ['RECORDED', 'CANCELLED'];

export const CATEGORIES = [
  'Matériel',
  'Fournitures',
  'Transport',
  'Alimentation',
  'Santé',
  'Formation',
  'Personnel',
  'Location',
  'Communication',
  'Autre',
];

async function verifierFondsDisponibles(client, projet, montant, { saufDepenseId = null } = {}) {
  const finance = depuisBase(projet.designatedTotal) + depuisBase(projet.investedHopeTotal);
  const dejaDepense = depuisBase(
    await expenseRepository.totalParProjet(projet.id, { saufDepenseId }, client)
  );
  const disponible = finance - dejaDepense;

  if (montant > disponible) {
    throw new ErreurRegleMetier(
      `Fonds insuffisants sur ce projet : il reste ${centimesVersTexte(disponible)} disponibles.`,
      'FONDS_PROJET_INSUFFISANTS',
      {
        fundedTotal: centimesVersTexte(finance),
        spentTotal: centimesVersTexte(dejaDepense),
        availableTotal: centimesVersTexte(disponible),
        requestedAmount: centimesVersTexte(montant),
      }
    );
  }

  return disponible;
}

export async function lister(requete = {}) {
  const { page, taille, decalage } = pagination(requete);

  const depenses = await expenseRepository.lister({
    projectId: identifiantFacultatif(requete.projectId, 'projectId'),
    statut: requete.status ? valeurParmi(requete.status, 'status', STATUTS) : null,
    recherche: texteFacultatif(requete.search, 'search', { max: 120 }),
    sansJustificatif: requete.withoutDocument === 'true' || requete.withoutDocument === true,
    beneficiaryId: identifiantFacultatif(requete.beneficiaryId, 'beneficiaryId'),
    limite: taille,
    decalage,
  });

  return { items: depenses, page, pageSize: taille, categories: CATEGORIES };
}

export async function recupererParId(id) {
  const depense = await expenseRepository.trouverParId(identifiantRequis(id, 'id'));
  if (!depense) throw new ErreurIntrouvable('La dépense', id);
  return depense;
}

export async function creer(corps = {}) {
  return transaction((client) => enregistrer(client, corps));
}

export async function enregistrer(client, corps = {}) {
  const projectId = identifiantRequis(corps.projectId, 'projectId');
  const montant = enCentimes(corps.amount, 'amount');
  const devise = normaliserDevise(corps.currency, 'currency');
  const description = texteRequis(corps.description, 'description', { max: 2000 });
  const dateDepense = dateRequise(corps.expenseDate, 'expenseDate', { defautAujourdhui: true });
  const beneficiaryId = identifiantFacultatif(corps.beneficiaryId, 'beneficiaryId');

  {
    const projet = await projectRepository.trouverPourMiseAJour(projectId, client);
    if (!projet) throw new ErreurIntrouvable('Le projet', projectId);

    if (projet.status !== 'IN_PROGRESS') {
      throw new ErreurRegleMetier(
        'Seul un projet en cours peut enregistrer une dépense.',
        'PROJET_FERME'
      );
    }

    if (beneficiaryId !== null) {
      const { rows } = await query(
        'SELECT 1 FROM project_beneficiaries WHERE project_id = $1 AND beneficiary_id = $2',
        [projectId, beneficiaryId],
        client
      );
      if (rows.length === 0) {
        throw new ErreurRegleMetier(
          'Ce bénéficiaire n’est pas rattaché à ce projet : rattachez-le d’abord, ou choisissez un de ses projets.',
          'BENEFICIAIRE_NON_RATTACHE'
        );
      }
    }

    await verifierFondsDisponibles(client, projet, montant);

    return expenseRepository.creer(
      {
        projectId,
        amount: centimesVersTexte(montant),
        currency: devise,
        description,
        category: texteFacultatif(corps.category, 'category', { max: 60 }),
        supplier: texteFacultatif(corps.supplier, 'supplier', { max: 200 }),
        expenseDate: dateDepense,
        beneficiaryId,
      },
      client
    );
  }
}

export async function mettreAJour(id, corps = {}) {
  const expenseId = identifiantRequis(id, 'id');

  return transaction(async (client) => {
    const depense = await expenseRepository.trouverPourMiseAJour(expenseId, client);
    if (!depense) throw new ErreurIntrouvable('La dépense', expenseId);

    if (depense.status === 'CANCELLED') {
      throw new ErreurRegleMetier(
        'Une dépense annulée ne peut plus être modifiée.',
        'DEPENSE_ANNULEE'
      );
    }

    const colonnes = {};
    if (corps.description !== undefined) {
      colonnes.description = texteRequis(corps.description, 'description', { max: 2000 });
    }
    if (corps.category !== undefined) {
      colonnes.category = texteFacultatif(corps.category, 'category', { max: 60 });
    }
    if (corps.supplier !== undefined) {
      colonnes.supplier = texteFacultatif(corps.supplier, 'supplier', { max: 200 });
    }
    if (corps.expenseDate !== undefined) {
      colonnes.expense_date = dateRequise(corps.expenseDate, 'expenseDate');
    }
    if (corps.currency !== undefined) {
      colonnes.currency = normaliserDevise(corps.currency, 'currency');
    }

    if (corps.amount !== undefined) {
      const montant = enCentimes(corps.amount, 'amount');
      const projet = await projectRepository.trouverPourMiseAJour(depense.projectId, client);
      await verifierFondsDisponibles(client, projet, montant, { saufDepenseId: expenseId });
      colonnes.amount = centimesVersTexte(montant);
    }

    return expenseRepository.mettreAJour(expenseId, colonnes, client);
  });
}

export async function annuler(id) {
  const expenseId = identifiantRequis(id, 'id');
  const depense = await expenseRepository.trouverParId(expenseId);
  if (!depense) throw new ErreurIntrouvable('La dépense', expenseId);

  if (depense.status === 'CANCELLED') {
    throw new ErreurRegleMetier('Cette dépense est déjà annulée.', 'DEJA_ANNULEE');
  }

  return expenseRepository.mettreAJour(expenseId, { status: 'CANCELLED' });
}
