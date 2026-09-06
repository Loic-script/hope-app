/**
 * Service des dons.
 *
 * Un don est soit AFFECTE — le donateur a choisi le projet, l'argent va
 * directement a ce projet — soit NON AFFECTE, et il alimente alors le fonds
 * HOPE que l'administrateur investira ensuite.
 *
 * Chaque don enregistre depose une notification :
 *   « <donateur> a fait un don <ponctuel|mensuel> de <somme> pour
 *     <HOPE|projet> »
 */
import { transaction } from '../config/database.js';
import * as donationRepository from '../repositories/donation.repository.js';
import * as donorRepository from '../repositories/donor.repository.js';
import * as projectRepository from '../repositories/project.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';

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

/**
 * Moyens de paiement proposes selon la localisation du donateur.
 * Un donateur local ne paie pas par PayPal ; un donateur a l'etranger n'a
 * pas de compte Mvola.
 */
export const MOYENS_PAIEMENT = {
  LOCAL: ['Mvola', 'Orange Money', 'Airtel Money', 'Espèces', 'Virement bancaire local', 'Chèque'],
  INTERNATIONAL: ['Carte bancaire', 'PayPal', 'Virement international', 'Western Union'],
};

/** Formate le libelle de la notification decrite au cahier des charges. */
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

/**
 * Enregistre un don recu.
 *
 * En attendant le formulaire public destine aux donateurs, c'est
 * l'administrateur qui saisit les dons encaisses hors ligne.
 */
export async function creer(corps = {}) {
  const donorId = identifiantRequis(corps.donorId, 'donorId');
  const montant = enCentimes(corps.amount, 'amount');
  const devise = normaliserDevise(corps.currency, 'currency');
  const allocation = valeurParmi(corps.allocation, 'allocation', ALLOCATIONS);
  const frequence = valeurParmi(corps.frequency, 'frequency', FREQUENCES, { defaut: 'ONE_TIME' });
  const statut = valeurParmi(corps.status, 'status', STATUTS, { defaut: 'RECEIVED' });

  return transaction(async (client) => {
    const donateur = await donorRepository.trouverParId(donorId, client);
    if (!donateur) throw new ErreurIntrouvable('Le donateur', donorId);

    // Le moyen de paiement doit exister pour la localisation du donateur.
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

    // Un don affecte designe un projet, qui doit encore accepter des fonds.
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

    // Seul un don reellement encaisse merite une notification.
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
}

/** Change le statut d'un don (encaissement, echec, remboursement). */
export async function changerStatut(id, corps = {}) {
  const donationId = identifiantRequis(id, 'id');
  const don = await donationRepository.trouverParId(donationId);
  if (!don) throw new ErreurIntrouvable('Le don', donationId);

  const statut = valeurParmi(corps.status, 'status', STATUTS);
  if (statut === don.status) return don;

  return transaction(async (client) => {
    // Retirer un don encaisse d'un projet ne doit pas rendre ses depenses
    // impossibles a couvrir.
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

    const misAJour = await donationRepository.mettreAJour(donationId, { status: statut }, client);

    // Le don devient encaisse : il entre dans les comptes, on notifie.
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
}
