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
  const paiement = justificatif(corps, mode);
  const carte = facturation(corps, mode, identite);
  const precision = precisionDuMoyen(corps, mode);

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

    // Une reference de transaction ne justifie qu'un seul don.
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

    // L'equipe l'apprend dans sa cloche : c'est elle qui confirme la
    // reception, et la personne attend ce retour.
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

/** Les numeros de chaque paiement mobile, sans le 0 : "341234567". */
const OPERATEURS_MOBILES = {
  mvola: { numero: /^3[48]\d{7}$/, aide: 'Un numéro Yas (ex-Telma) : 034 ou 038' },
  orange_money: { numero: /^3[27]\d{7}$/, aide: 'Un numéro Orange : 032 ou 037' },
};

/**
 * Ce que le donateur declare de son paiement, quand il l'a deja fait :
 * la reference de la transaction (le SMS de l'operateur) et le numero qui a
 * paye. L'equipe les rapproche de son releve avant de confirmer -- ils
 * ne valent pas preuve a eux seuls.
 */
function justificatif(corps, mode) {
  const reference = texteFacultatif(corps.referencePaiement, 'referencePaiement', { max: 40 });
  if (reference && !/^[A-Za-z0-9][A-Za-z0-9.\-]{3,39}$/.test(reference)) {
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

/** Les plateformes de transfert qu'un donateur peut nommer. */
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

/**
 * Ce que certains moyens precisent, pour l'equipe :
 *
 *   * plateforme : laquelle (PayPal, Western Union...) ;
 *   * especes : ou et quand le don sera remis -- au bureau, ou chez le
 *     donateur, a la date et au moment de la journee qu'il propose.
 *
 * Rend la phrase de la notification, ou null.
 */
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

/**
 * Le donateur signale avoir paye une promesse : la reference de sa
 * banque (ou du bordereau, ou du transfert) s'ajoute au don, et
 * l'equipe l'apprend dans sa cloche. Une reference ne vaut qu'une fois.
 */
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

  const lu = await donorSpaceRepository.unDeMesDons(compte.id, don.id);
  return { don: presenter(lu), message: 'Merci ! L’équipe HOPE rapproche votre paiement de son relevé.' };
}

/** Les reseaux de carte que la page reconnait. */
const RESEAUX_CARTE = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  jcb: 'JCB',
  autre: 'bancaire',
};

/**
 * Le don par carte : ce qu'il faut a l'equipe pour envoyer un lien de
 * paiement securise -- l'adresse e-mail, le titulaire, l'adresse de
 * facturation.
 *
 * JAMAIS le numero de carte, la date d'expiration ni le cryptogramme :
 * la page les fait saisir, mais ils restent dans le navigateur, destines
 * au prestataire de paiement. Ici n'arrivent que le reseau et les quatre
 * derniers chiffres -- ce qu'imprime un recu --, et un numero complet est
 * refuse. Une carte ne transite pas par ce serveur, et n'est pas
 * conservee dans cette base.
 *
 * Rend la phrase que la notification de l'equipe portera, ou null.
 */
function facturation(corps, mode, identite) {
  if (mode.cle !== 'carte_bancaire' || !corps.facturation) return null;
  const f = corps.facturation;

  // Garde-fou : un numero de carte complet (13 a 19 chiffres) n'a rien a
  // faire ici. On refuse, sans rien enregistrer ni recopier.
  if (/\d{13,19}/.test(JSON.stringify(f).replace(/[\s.-]/g, ''))) {
    throw new ErreurValidation('Un numéro de carte ne s’envoie jamais à HOPE.', { carte: 'Numéro refusé' });
  }

  // Ce que la page transmet de la carte : son reseau et ses 4 derniers
  // chiffres, comme un recu. Rien d'autre.
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

/** Qui donne, depuis l'espace bailleur : l'organisation, par son contact. */
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

/** Qui donne, depuis l'espace benevole. */
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
