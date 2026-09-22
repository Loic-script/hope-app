/**
 * La promesse de don, commune aux espaces donateur, bailleur et benevole.
 *
 * Un don fait depuis un espace est une PROMESSE : il part en statut
 * PENDING, l'equipe est prevenue dans sa cloche, et le passe a RECEIVED
 * quand l'argent arrive -- par le circuit deja en place cote
 * administration.
 *
 * Le don porte une fiche "donors", rattachee au compte par
 * utilisateur_id et creee au premier don. Chaque espace dit qui donne :
 * un donateur (sa fiche du parcours d'accueil), une organisation
 * partenaire (sa raison sociale), un benevole (son nom).
 *
 * Seul le donateur peut promettre un don mensuel : le bailleur finance
 * un projet, le benevole donne une fois -- tous deux choisissent leur
 * mode de paiement.
 */
import { transaction } from '../config/database.js';
import * as donationRepository from '../repositories/donation.repository.js';
import * as donorSpaceRepository from '../repositories/donorSpace.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import { ErreurValidation } from '../shared/errors.js';
import { centimesVersTexte, enCentimes, normaliserDevise } from '../shared/money.js';
import { identifiantRequis, texteFacultatif, valeurParmi } from '../shared/validation.js';
import { DEVISES, FREQUENCES, MODES_PAIEMENT, projetsProposes } from './donorProfile.service.js';

/** Les statuts d'un don, tels que les espaces les lisent. */
export const STATUTS_DON = {
  PENDING: 'En attente',
  RECEIVED: 'Reçu',
  FAILED: 'Non abouti',
  REFUNDED: 'Remboursé',
};

/** Un don tel que les espaces le lisent. */
export function presenter(don) {
  return { ...don, statutLibelle: STATUTS_DON[don.statut] ?? don.statut };
}

/** Le nom d'un pays, en francais, depuis son code ISO ("FR" -> "France"). */
const NOMS_DE_PAYS = new Intl.DisplayNames(['fr'], { type: 'region' });

/** Un pays en clair : un code ISO se traduit, un nom se garde. */
export function nomDuPays(valeur) {
  const texte = String(valeur ?? '').trim();
  if (!texte) return 'Madagascar';
  if (!/^[A-Za-z]{2}$/.test(texte)) return texte;
  try {
    return NOMS_DE_PAYS.of(texte.toUpperCase()) ?? texte;
  } catch {
    return texte;
  }
}

/** LOCAL a Madagascar, INTERNATIONAL ailleurs : la colonne donors.origin. */
export function origineDuPays(valeur) {
  const texte = String(valeur ?? '').trim().toLowerCase();
  return !texte || texte === 'mg' || texte === 'madagascar' ? 'LOCAL' : 'INTERNATIONAL';
}

/** Ce que le formulaire propose : les modes de paiement et les devises. */
export function options() {
  return { modesPaiement: MODES_PAIEMENT, devises: DEVISES };
}

/**
 * Promettre un don.
 *
 * Affecte a un projet que l'on peut encore soutenir -- en cours, et dont
 * l'objectif n'est pas atteint --, ou laisse a HOPE.
 *
 * @param {{ utilisateurId: string, qui: string, origine: string,
 *           nouvelleFiche: (client) => Promise<object> }} identite
 *   qui donne : son compte, son nom tel que l'equipe le lira, l'espace
 *   d'ou il donne ("bailleur Telma"), et de quoi creer sa fiche de don
 * @param {{ affectation, projetId?, montant, devise?, mode, frequence?, message? }} corps
 * @param {{ mensuelPermis?: boolean }} [reglages]
 */
export async function promettreUnDon(identite, corps = {}, { mensuelPermis = true } = {}) {
  const affectation = valeurParmi(corps.affectation, 'affectation', ['PROJECT', 'HOPE']);

  let projet = null;
  if (affectation === 'PROJECT') {
    const projetId = identifiantRequis(corps.projetId, 'projetId');
    projet = (await projetsProposes()).find((p) => Number(p.id) === projetId);
    if (!projet) {
      throw new ErreurValidation('Ce projet ne reçoit pas de dons pour le moment.', {
        projetId: 'Projet indisponible',
      });
    }
    if (projet.atteint) {
      throw new ErreurValidation('L’objectif de ce projet est déjà atteint : choisissez-en un autre.', {
        projetId: 'Objectif atteint',
      });
    }
  }

  const montant = enCentimes(corps.montant, 'montant', { minimum: 100 });
  const devise = normaliserDevise(corps.devise || 'MGA', 'devise');
  const mode = MODES_PAIEMENT.find((m) => m.cle === corps.mode);
  if (!mode) {
    throw new ErreurValidation('Choisissez un mode de paiement.', { mode: 'Choix obligatoire' });
  }
  const frequence = mensuelPermis
    ? valeurParmi(corps.frequence, 'frequence', FREQUENCES.map((f) => f.cle))
    : 'ONE_TIME';
  const message = texteFacultatif(corps.message, 'message', { max: 500 });

  const don = await transaction(async (client) => {
    const existante = await donorSpaceRepository.ficheDuCompte(identite.utilisateurId, client);
    const donorId =
      existante?.id ??
      (
        await donorSpaceRepository.creerFicheDuCompte(
          { utilisateurId: identite.utilisateurId, ...(await identite.nouvelleFiche(client)) },
          client
        )
      ).id;

    const reference = await donationRepository.genererReference(client);
    const cree = await donationRepository.creer(
      {
        reference,
        donorId,
        donorAccountId: null,
        amount: centimesVersTexte(montant),
        currency: devise,
        allocation: affectation,
        projectId: projet ? Number(projet.id) : null,
        frequency: frequence,
        paymentMethod: mode.libelle,
        paymentReference: null,
        status: 'PENDING',
        receivedAt: null,
        message: message || null,
      },
      client
    );

    // L'equipe l'apprend dans sa cloche : c'est elle qui confirme la
    // reception, et la personne attend ce retour.
    await notificationRepository.creer(
      {
        type: 'DONATION',
        label:
          `Promesse de don : ${centimesVersTexte(montant)} ${devise} de ${identite.qui} ` +
          `(${identite.origine}, ${mode.libelle})` +
          `${projet ? ` pour « ${projet.nom} »` : ''} — à confirmer à réception.`,
        donationId: cree.id,
        donorId,
        projectId: projet ? Number(projet.id) : null,
      },
      client
    );

    return cree;
  });

  const lu = await donorSpaceRepository.unDeMesDons(identite.utilisateurId, don.id);
  return {
    don: presenter(lu),
    message:
      'Merci ! Votre promesse de don est enregistrée. L’équipe HOPE la confirme dès réception ' +
      'de votre paiement.',
  };
}

/** Qui donne, depuis l'espace bailleur : l'organisation, par son contact. */
export function identiteBailleur(bailleur) {
  const contact = [bailleur.prenom, bailleur.nom].filter(Boolean).join(' ');
  return {
    utilisateurId: bailleur.utilisateurId,
    qui: bailleur.raisonSociale || contact || bailleur.email,
    origine: 'partenaire',
    nouvelleFiche: async () => ({
      prenom: bailleur.prenom || null,
      nom: bailleur.nom || null,
      organisation: bailleur.raisonSociale || null,
      email: bailleur.email,
      telephone: bailleur.telephone || null,
      pays: nomDuPays(bailleur.pays),
      ville: null,
      origine: origineDuPays(bailleur.pays),
    }),
  };
}

/** Qui donne, depuis l'espace benevole. */
export function identiteBenevole(benevole) {
  return {
    utilisateurId: benevole.id,
    qui: [benevole.prenom, benevole.nom].filter(Boolean).join(' ') || benevole.email,
    origine: 'bénévole',
    nouvelleFiche: async () => ({
      prenom: benevole.prenom || null,
      nom: benevole.nom || null,
      organisation: null,
      email: benevole.email,
      telephone: benevole.telephone || null,
      pays: 'Madagascar',
      ville: null,
      origine: 'LOCAL',
    }),
  };
}
