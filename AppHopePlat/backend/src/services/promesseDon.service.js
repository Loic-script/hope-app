import { transaction } from '../config/database.js';
import * as donationRepository from '../repositories/donation.repository.js';
import * as donorSpaceRepository from '../repositories/donorSpace.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import { ErreurValidation } from '../shared/errors.js';
import { centimesVersTexte, enCentimes, normaliserDevise } from '../shared/money.js';
import { identifiantRequis, texteFacultatif, valeurParmi } from '../shared/validation.js';
import { DEVISES, FREQUENCES, MODES_PAIEMENT, projetsProposes } from './donorProfile.service.js';
import * as courrielsAuto from './courrielsAutomatiques.service.js';

async function ficheDuDonateur(identite, client) {
  if (identite.ficheId) return identite.ficheId(client);
  const existante = await donorSpaceRepository.ficheDuCompte(identite.utilisateurId, client);
  if (existante) return existante.id;
  const creee = await donorSpaceRepository.creerFicheDuCompte(
    { utilisateurId: identite.utilisateurId, ...(await identite.nouvelleFiche(client)) },
    client
  );
  return creee.id;
}

function relireLeDon(identite, donId) {
  if (identite.relire) return identite.relire(donId);
  return donorSpaceRepository.unDeMesDons(identite.utilisateurId ?? identite.id, donId);
}

export const STATUTS_DON = {
  PENDING: 'En attente',
  RECEIVED: 'Reçu',
  FAILED: 'Non abouti',
  REFUNDED: 'Remboursé',
};

export function presenter(don) {
  return { ...don, statutLibelle: STATUTS_DON[don.statut] ?? don.statut };
}

const NOMS_DE_PAYS = new Intl.DisplayNames(['fr'], { type: 'region' });

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

export function origineDuPays(valeur) {
  const texte = String(valeur ?? '').trim().toLowerCase();
  return !texte || texte === 'mg' || texte === 'madagascar' ? 'LOCAL' : 'INTERNATIONAL';
}

export function options() {
  return { modesPaiement: MODES_PAIEMENT, devises: DEVISES };
}

export async function promettreUnDon(
  identite,
  corps = {},
  { mensuelPermis = true, enLigne = false } = {}
) {
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
  const paiement = justificatif(corps, mode);
  const carte = facturation(corps, mode, identite);
  const precision = precisionDuMoyen(corps, mode);

  const don = await transaction(async (client) => {
    const donorId = await ficheDuDonateur(identite, client);

    if (paiement.reference && (await donationRepository.referencePaiementPrise(paiement.reference, client))) {
      throw new ErreurValidation('Cette référence de transaction a déjà été déclarée pour un autre don.', {
        referencePaiement: 'Référence déjà utilisée',
      });
    }

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
        paymentReference: paiement.reference,
        status: 'PENDING',
        receivedAt: null,
        message: message || null,
      },
      client
    );

    if (!enLigne) {
      await notificationRepository.creer(
        {
          type: 'DONATION',
          label:
            `Promesse de don : ${centimesVersTexte(montant)} ${devise} de ${identite.qui} ` +
            `(${identite.origine}, ${mode.libelle})` +
            `${projet ? ` pour « ${projet.nom} »` : ''}` +
            `${paiement.reference ? `, réf. ${paiement.reference}` : ''}` +
            `${paiement.numero ? ` depuis le ${paiement.numero}` : ''} — à confirmer à réception.` +
            `${carte ? ` ${carte}` : ''}` +
            `${precision ? ` ${precision}` : ''}`,
          donationId: cree.id,
          donorId,
          projectId: projet ? Number(projet.id) : null,
        },
        client
      );
    }

    return cree;
  });

  if (!enLigne) {
    void courrielsAuto.promesseEnregistree(don.id);
    void courrielsAuto.promesseAConfirmer(don.id);
  }

  const lu = await relireLeDon(identite, don.id);
  return {
    don: presenter(lu),
    message: enLigne
      ? 'Votre don est enregistré. Il ne reste qu’à le régler par carte.'
      : 'Merci ! Votre promesse de don est enregistrée. L’équipe HOPE la confirme dès réception ' +
        'de votre paiement.',
  };
}

const OPERATEURS_MOBILES = {
  mvola: { numero: /^3[48]\d{7}$/, aide: 'Un numéro Yas (ex-Telma) : 034 ou 038' },
  orange_money: { numero: /^3[27]\d{7}$/, aide: 'Un numéro Orange : 032 ou 037' },
};

function justificatif(corps, mode) {
  const reference = texteFacultatif(corps.referencePaiement, 'referencePaiement', { max: 40 });
  if (reference && !/^[A-Za-z0-9][A-Za-z0-9.-]{3,39}$/.test(reference)) {
    throw new ErreurValidation('La référence de transaction n’est pas valide.', {
      referencePaiement: 'Lettres, chiffres, points et tirets uniquement',
    });
  }

  let numero = null;
  const saisi = String(corps.numeroPayeur ?? '').replace(/[\s.-]/g, '');
  if (saisi) {
    const national = saisi.replace(/^(\+?261|0)/, '');
    const operateur = OPERATEURS_MOBILES[mode.cle];
    if (!operateur || !operateur.numero.test(national)) {
      throw new ErreurValidation(`Ce numéro n’est pas un numéro ${mode.libelle}.`, {
        numeroPayeur: operateur?.aide ?? 'Numéro de paiement mobile inattendu',
      });
    }
    numero = `+261${national}`;
  }

  return { reference: reference ? reference.toUpperCase() : null, numero };
}

export const PLATEFORMES = {
  taptap_send: 'Taptap Send',
  remitly: 'Remitly',
  sendwave: 'Sendwave',
  worldremit: 'WorldRemit',
  paysend: 'Paysend',
  orange_money_europe: 'Orange Money Europe',
  western_union: 'Western Union',
  moneygram: 'MoneyGram',
  ria: 'Ria',
  xoom: 'Xoom (PayPal)',
  global_transfert: 'Global Transfert Océan Indien',
  revolut: 'Revolut',
};

function precisionDuMoyen(corps, mode) {
  if (mode.cle === 'plateforme' && corps.plateforme !== undefined) {
    const nom = PLATEFORMES[corps.plateforme];
    if (!nom) {
      throw new ErreurValidation('Choisissez une plateforme de la liste.', { plateforme: 'Plateforme inconnue' });
    }
    return `Via ${nom}.`;
  }

  if (mode.cle === 'especes' && corps.remise) {
    const { lieu, date, moment, adresse } = corps.remise;
    if (!['bureau', 'domicile'].includes(lieu)) {
      throw new ErreurValidation('Choisissez où remettre votre don.', { lieu: 'Au bureau ou chez vous' });
    }
    const jour = new Date(`${date}T12:00:00`);
    const demain = new Date();
    demain.setHours(0, 0, 0, 0);
    const limite = new Date(demain);
    limite.setDate(limite.getDate() + 90);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || Number.isNaN(jour.getTime()) || jour < demain || jour > limite) {
      throw new ErreurValidation('Choisissez une date dans les trois prochains mois.', { date: 'Date invalide' });
    }
    if (!['matin', 'apres-midi'].includes(moment)) {
      throw new ErreurValidation('Choisissez le matin ou l’après-midi.', { moment: 'Moment invalide' });
    }
    let ou = 'au bureau de HOPE';
    if (lieu === 'domicile') {
      const texte = texteFacultatif(adresse, 'adresse', { max: 255 });
      if (!texte) throw new ErreurValidation('Indiquez l’adresse où passer.', { adresse: 'Champ obligatoire' });
      ou = `chez le donateur : ${texte}`;
    }
    const quand = jour.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return `Remise en espèces ${ou}, le ${quand} ${moment === 'matin' ? 'au matin' : 'l’après-midi'}.`;
  }

  return null;
}

export async function declarerJustificatif(compte, don, corps = {}) {
  const reference = texteFacultatif(corps.referencePaiement, 'referencePaiement', { max: 40 });
  if (!reference || !/^[A-Za-z0-9][A-Za-z0-9./ -]{3,39}$/.test(reference)) {
    throw new ErreurValidation('Recopiez la référence de votre paiement.', {
      referencePaiement: 'Lettres, chiffres, points, tirets',
    });
  }
  const propre = reference.toUpperCase().replace(/\s+/g, ' ');

  await transaction(async (client) => {
    if (await donationRepository.referencePaiementPrise(propre, client)) {
      throw new ErreurValidation('Cette référence a déjà été déclarée pour un autre don.', {
        referencePaiement: 'Référence déjà utilisée',
      });
    }
    await donationRepository.mettreAJour(don.id, { payment_reference: propre }, client);
    await notificationRepository.creer(
      {
        type: 'DONATION',
        label:
          `Paiement signalé : ${[compte.prenom, compte.nom].filter(Boolean).join(' ') || compte.email} ` +
          `dit avoir réglé ${don.reference} (${centimesVersTexte(enCentimes(don.montant, 'montant'))} ${don.devise}), ` +
          `réf. ${propre} — à rapprocher du relevé.`,
        donationId: don.id,
      },
      client
    );
  });

  const lu = await relireLeDon(compte, don.id);
  return { don: presenter(lu), message: 'Merci ! L’équipe HOPE rapproche votre paiement de son relevé.' };
}

const RESEAUX_CARTE = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  jcb: 'JCB',
  autre: 'bancaire',
};

function facturation(corps, mode, identite) {
  if (mode.cle !== 'carte_bancaire' || !corps.facturation) return null;
  const f = corps.facturation;

  if (/\d{13,19}/.test(JSON.stringify(f).replace(/[\s.-]/g, ''))) {
    throw new ErreurValidation('Un numéro de carte ne s’envoie jamais à HOPE.', { carte: 'Numéro refusé' });
  }

  let carte = '';
  if (f.carte) {
    const reseau = RESEAUX_CARTE[f.carte.marque];
    if (!reseau || !/^\d{4}$/.test(String(f.carte.fin ?? ''))) {
      throw new ErreurValidation('La carte indiquée n’est pas reconnue.', { carte: 'Carte non reconnue' });
    }
    carte = `carte ${reseau} •••• ${f.carte.fin} ; `;
  }

  const titulaire = texteFacultatif(f.titulaire, 'titulaire', { max: 120 });
  if (!titulaire) {
    throw new ErreurValidation('Indiquez le nom du titulaire de la carte.', { titulaire: 'Champ obligatoire' });
  }
  const adresse = [
    texteFacultatif(f.adresse, 'adresse', { max: 255 }),
    [texteFacultatif(f.codePostal, 'codePostal', { max: 20 }), texteFacultatif(f.ville, 'ville', { max: 120 })]
      .filter(Boolean)
      .join(' '),
    nomDuPays(texteFacultatif(f.pays, 'pays', { max: 60 })),
  ]
    .filter(Boolean)
    .join(', ');

  return (
    `Lien de paiement par carte à envoyer${identite.email ? ` à ${identite.email}` : ''} ` +
    `(${carte}titulaire : ${titulaire} ; facturation : ${adresse}).`
  );
}

export function identiteBailleur(bailleur) {
  const contact = [bailleur.prenom, bailleur.nom].filter(Boolean).join(' ');
  return {
    utilisateurId: bailleur.utilisateurId,
    qui: bailleur.raisonSociale || contact || bailleur.email,
    email: bailleur.email,
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

export function identiteBenevole(benevole) {
  return {
    utilisateurId: benevole.id,
    qui: [benevole.prenom, benevole.nom].filter(Boolean).join(' ') || benevole.email,
    email: benevole.email,
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
