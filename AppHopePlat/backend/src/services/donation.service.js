import { transaction } from '../config/database.js';
import * as donationRepository from '../repositories/donation.repository.js';
import * as donorRepository from '../repositories/donor.repository.js';
import * as projectRepository from '../repositories/project.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import * as courrielsAuto from './courrielsAutomatiques.service.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

import { ErreurIntrouvable, ErreurRegleMetier } from '../shared/errors.js';
import { centimesVersTexte, depuisBase, enCentimes, normaliserDevise } from '../shared/money.js';
import {
  dateFacultative,
  identifiantFacultatif,
  identifiantRequis,
  pagination,
  texteFacultatif,
  valeurParmi,
} from '../shared/validation.js';

export const ALLOCATIONS = ['PROJECT', 'HOPE'];
export const FREQUENCES = ['ONE_TIME', 'MONTHLY'];
export const STATUTS = ['PENDING', 'RECEIVED', 'FAILED', 'REFUNDED'];

export const MOYENS_PAIEMENT = {
  LOCAL: ['Mvola', 'Orange Money', 'Airtel Money', 'Espèces', 'Virement bancaire local', 'Chèque'],
  INTERNATIONAL: ['Carte bancaire', 'PayPal', 'Virement international', 'Western Union'],
};

function libelleNotification(don) {
  const frequence = don.frequency === 'MONTHLY' ? 'mensuel' : 'ponctuel';
  const destination = don.allocation === 'HOPE' ? 'HOPE' : `le projet « ${don.projectName} »`;
  const montant = `${Number(don.amount).toLocaleString('fr-FR')} ${don.currency.trim()}`;

  return `${don.donorName} a fait un don ${frequence} de ${montant} pour ${destination}`;
}

export async function lister(requete = {}) {
  const { page, taille, decalage } = pagination(requete);

  const dons = await donationRepository.lister({
    allocation: requete.allocation ? valeurParmi(requete.allocation, 'allocation', ALLOCATIONS) : null,
    frequence: requete.frequency ? valeurParmi(requete.frequency, 'frequency', FREQUENCES) : null,
    statut: requete.status ? valeurParmi(requete.status, 'status', STATUTS) : null,
    origine: requete.origin ? valeurParmi(requete.origin, 'origin', ['LOCAL', 'INTERNATIONAL']) : null,
    projectId: identifiantFacultatif(requete.projectId, 'projectId'),
    donorId: identifiantFacultatif(requete.donorId, 'donorId'),
    recherche: texteFacultatif(requete.search, 'search', { max: 120 }),
    limite: taille,
    decalage,
  });

  return { items: dons, page, pageSize: taille };
}

export async function recupererParId(id) {
  const don = await donationRepository.trouverParId(identifiantRequis(id, 'id'));
  if (!don) throw new ErreurIntrouvable('Le don', id);
  return don;
}

export async function creer(corps = {}) {
  const donorId = identifiantRequis(corps.donorId, 'donorId');
  const montant = enCentimes(corps.amount, 'amount');
  const devise = normaliserDevise(corps.currency, 'currency');
  const allocation = valeurParmi(corps.allocation, 'allocation', ALLOCATIONS);
  const frequence = valeurParmi(corps.frequency, 'frequency', FREQUENCES, { defaut: 'ONE_TIME' });
  const statut = valeurParmi(corps.status, 'status', STATUTS, { defaut: 'RECEIVED' });

  const cree = await transaction(async (client) => {
    const donateur = await donorRepository.trouverParId(donorId, client);
    if (!donateur) throw new ErreurIntrouvable('Le donateur', donorId);

    const moyen = texteFacultatif(corps.paymentMethod, 'paymentMethod', { max: 60 });
    const moyensAutorises = MOYENS_PAIEMENT[donateur.origin] ?? [];
    if (moyen && !moyensAutorises.includes(moyen)) {
      throw new ErreurRegleMetier(
        `« ${moyen} » n’est pas proposé pour un donateur ${
          donateur.origin === 'LOCAL' ? 'à Madagascar' : "à l'étranger"
        }. Moyens acceptés : ${moyensAutorises.join(', ')}.`,
        'MOYEN_PAIEMENT_INDISPONIBLE'
      );
    }

    let projectId = null;
    if (allocation === 'PROJECT') {
      projectId = identifiantRequis(corps.projectId, 'projectId');
      const projet = await projectRepository.trouverParId(projectId, client);
      if (!projet) throw new ErreurIntrouvable('Le projet', projectId);

      if (projet.status !== 'IN_PROGRESS') {
        throw new ErreurRegleMetier(
          'Ce projet n’est plus en cours : il ne peut plus recevoir de don affecté.',
          'PROJET_FERME'
        );
      }
    }

    const don = await donationRepository.creer(
      {
        reference: await donationRepository.genererReference(client),
        donorId,
        donorAccountId: donateur.accountId ?? null,
        amount: centimesVersTexte(montant),
        currency: devise,
        allocation,
        projectId,
        frequency: frequence,
        paymentMethod: moyen,
        paymentReference: texteFacultatif(corps.paymentReference, 'paymentReference', { max: 120 }),
        status: statut,
        receivedAt: dateFacultative(corps.receivedAt, 'receivedAt'),
        message: texteFacultatif(corps.message, 'message', { max: 2000 }),
      },
      client
    );

    if (don.status === 'RECEIVED') {
      await notificationRepository.creer(
        {
          type: 'DONATION',
          label: libelleNotification(don),
          donationId: don.id,
          donorId: don.donorId,
          projectId: don.projectId,
        },
        client
      );
    }

    return don;
  });
  if (cree.status === 'RECEIVED') void courrielsAuto.donRecu(cree.id);
  return cree;
}

export async function genererEcheancesMensuelles(auteur = null) {
  const attendues = await donationRepository.echeancesMensuellesAGenerer();

  if (attendues.length === 0) {
    return { created: 0, items: [], message: 'Aucune échéance à générer ce mois-ci.' };
  }

  const crees = [];

  for (const modele of attendues) {
    const don = await transaction(async (client) => {
      return donationRepository.creer(
        {
          reference: await donationRepository.genererReference(client),
          donorId: modele.donorId,
          donorAccountId: modele.donorAccountId,
          amount: modele.amount,
          currency: modele.currency,
          allocation: modele.allocation,
          projectId: modele.projectId,
          frequency: 'MONTHLY',
          paymentMethod: modele.paymentMethod,
          paymentReference: null,
          status: 'PENDING',
          receivedAt: null,
          message: null,
        },
        client
      );
    });
    crees.push(don);
  }

  await activityLogRepository.deposer(auteur, {
    action: 'GENERATE',
    entityType: 'DONATION',
    entityId: null,
    label: `a généré ${crees.length} échéance(s) de dons mensuels, en attente d’encaissement`,
  });

  return {
    created: crees.length,
    items: crees,
    message: `${crees.length} échéance(s) créée(s), en attente d’encaissement.`,
  };
}

export async function changerStatut(id, corps = {}) {
  const donationId = identifiantRequis(id, 'id');
  const don = await donationRepository.trouverParId(donationId);
  if (!don) throw new ErreurIntrouvable('Le don', donationId);

  const statut = valeurParmi(corps.status, 'status', STATUTS);
  if (statut === don.status) return don;

  const misAJourFinal = await transaction(async (client) => {
    if (don.status === 'RECEIVED' && statut !== 'RECEIVED' && don.projectId) {
      const projet = await projectRepository.trouverPourMiseAJour(don.projectId, client);
      const finance = depuisBase(projet.designatedTotal) + depuisBase(projet.investedHopeTotal);
      const depense = depuisBase(projet.spentTotal);
      const montant = depuisBase(don.amount);

      if (finance - montant < depense) {
        throw new ErreurRegleMetier(
          `Ce don finance des dépenses déjà engagées sur « ${projet.name} ». ` +
            `Il resterait ${centimesVersTexte(finance - montant)} pour ${centimesVersTexte(depense)} dépensés.`,
          'DON_DEJA_CONSOMME'
        );
      }
    }

    const colonnes =
      don.status === 'PENDING' && statut === 'RECEIVED'
        ? { status: statut, received_at: new Date() }
        : { status: statut };
    const misAJour = await donationRepository.mettreAJour(donationId, colonnes, client);

    if (statut === 'RECEIVED') {
      await notificationRepository.creer(
        {
          type: 'DONATION',
          label: libelleNotification(misAJour),
          donationId: misAJour.id,
          donorId: misAJour.donorId,
          projectId: misAJour.projectId,
        },
        client
      );
    }

    return misAJour;
  });
  if (statut === 'RECEIVED') void courrielsAuto.donRecu(donationId);
  return misAJourFinal;
}
