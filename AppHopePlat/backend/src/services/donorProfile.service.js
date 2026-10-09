import { transaction } from '../config/database.js';
import * as donorProfileRepository from '../repositories/donorProfile.repository.js';
import { ErreurValidation } from '../shared/errors.js';
import { DEVISES_ACCEPTEES } from '../shared/money.js';
import { lister as listerProjets } from './project.service.js';

export const SOURCES_CONNAISSANCE = [
  { cle: 'reseaux_sociaux', libelle: 'Réseaux sociaux (Facebook, Instagram…)' },
  { cle: 'bouche_a_oreille', libelle: 'Un proche, le bouche-à-oreille' },
  { cle: 'recherche_internet', libelle: 'Une recherche sur internet' },
  { cle: 'evenement', libelle: 'Un événement HOPE' },
  { cle: 'medias', libelle: 'La presse, la radio ou la télévision' },
  { cle: 'membre_hope', libelle: 'Un bénévole ou un membre de HOPE' },
  { cle: 'partenaire', libelle: 'Une entreprise ou un partenaire' },
  { cle: 'autre', libelle: 'Autre' },
];

export const TYPES_DONATEUR = [
  {
    cle: 'particulier',
    libelle: 'Particulier',
    structure: false,
    description: 'Vous donnez à titre personnel.',
  },
  {
    cle: 'entreprise',
    libelle: 'Entreprise',
    structure: true,
    description: 'Vous donnez au nom d’une entreprise : vos reçus porteront sa raison sociale.',
  },
  {
    cle: 'fondation',
    libelle: 'Fondation',
    structure: true,
    description: 'Vous donnez au nom d’une fondation.',
  },
  {
    cle: 'organisation',
    libelle: 'Organisation',
    structure: true,
    description: 'Vous donnez au nom d’une association, d’une ONG ou d’une institution.',
  },
  {
    cle: 'partenaire',
    libelle: 'Partenaire',
    structure: true,
    description: 'Votre structure soutient HOPE dans la durée, au titre d’un partenariat.',
  },
  {
    cle: 'international',
    libelle: 'International',
    structure: false,
    description: 'Vous donnez depuis l’étranger, à titre personnel.',
  },
];

const LIBELLES_DEVISE = { MGA: 'Ariary', EUR: 'Euro', USD: 'Dollar américain' };
export const DEVISES = DEVISES_ACCEPTEES.map((code) => ({
  code,
  libelle: LIBELLES_DEVISE[code] ?? code,
}));

const CODES_LANGUES = [
  'aa', 'ab', 'af', 'ak', 'am', 'an', 'ar', 'as', 'av', 'ay', 'az', 'ba', 'be', 'bg', 'bi',
  'bm', 'bn', 'bo', 'br', 'bs', 'ca', 'ce', 'ch', 'co', 'cr', 'cs', 'cv', 'cy', 'da', 'de',
  'dv', 'dz', 'ee', 'el', 'en', 'eo', 'es', 'et', 'eu', 'fa', 'ff', 'fi', 'fj', 'fo', 'fr',
  'fy', 'ga', 'gd', 'gl', 'gn', 'gu', 'gv', 'ha', 'he', 'hi', 'ho', 'hr', 'ht', 'hu', 'hy',
  'hz', 'id', 'ig', 'ii', 'ik', 'is', 'it', 'iu', 'ja', 'jv', 'ka', 'kg', 'ki', 'kj', 'kk',
  'kl', 'km', 'kn', 'ko', 'kr', 'ks', 'ku', 'kv', 'kw', 'ky', 'lb', 'lg', 'li', 'ln', 'lo',
  'lt', 'lu', 'lv', 'mg', 'mh', 'mi', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my', 'na', 'nd',
  'ne', 'ng', 'nl', 'no', 'nr', 'nv', 'ny', 'oc', 'oj', 'om', 'or', 'os', 'pa', 'pl', 'ps',
  'pt', 'qu', 'rm', 'rn', 'ro', 'ru', 'rw', 'sc', 'sd', 'se', 'sg', 'si', 'sk', 'sl', 'sm',
  'sn', 'so', 'sq', 'sr', 'ss', 'st', 'su', 'sv', 'sw', 'ta', 'te', 'tg', 'th', 'ti', 'tk',
  'tl', 'tn', 'to', 'tr', 'ts', 'tt', 'tw', 'ty', 'ug', 'uk', 'ur', 'uz', 've', 'vi', 'wa',
  'wo', 'xh', 'yi', 'yo', 'za', 'zh', 'zu',
];

const LANGUES_COURANTES = ['fr', 'mg', 'en'];

const nomsFrancais = new Intl.DisplayNames(['fr'], { type: 'language', fallback: 'none' });

function nomPropre(code) {
  try {
    if (Intl.DisplayNames.supportedLocalesOf([code]).length === 0) return null;
    return new Intl.DisplayNames([code], { type: 'language', fallback: 'none' }).of(code) ?? null;
  } catch {
    return null;
  }
}

function libelleLangue(code) {
  const francais = nomsFrancais.of(code) ?? code;
  const libelle = francais.charAt(0).toLocaleUpperCase('fr') + francais.slice(1);
  const propre = nomPropre(code);
  return propre && propre.toLowerCase() !== francais.toLowerCase() ? `${libelle} (${propre})` : libelle;
}

export const LANGUES = (() => {
  const liste = CODES_LANGUES.map((cle) => ({
    cle,
    libelle: libelleLangue(cle),
    courante: LANGUES_COURANTES.includes(cle),
  }));
  const courantes = LANGUES_COURANTES.map((cle) => liste.find((langue) => langue.cle === cle));
  const autres = liste
    .filter((langue) => !langue.courante)
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));
  return [...courantes, ...autres];
})();

export const MODES_PAIEMENT = [
  {
    cle: 'mvola',
    libelle: 'MVola',
    zone: 'madagascar',
    description: 'Paiement mobile depuis un numéro Yas, ex-Telma (034 ou 038).',
  },
  {
    cle: 'orange_money',
    libelle: 'Orange Money',
    zone: 'madagascar',
    description: 'Paiement mobile depuis un numéro Orange (032 ou 037).',
  },
  {
    cle: 'virement_bancaire',
    libelle: 'Virement bancaire',
    zone: 'madagascar',
    description: 'Virement depuis un compte bancaire à Madagascar.',
  },
  {
    cle: 'depot_bancaire',
    libelle: 'Dépôt bancaire',
    zone: 'madagascar',
    description: 'Versement en agence ou au distributeur, sur le compte de HOPE.',
  },
  {
    cle: 'especes',
    libelle: 'Espèces',
    zone: 'madagascar',
    description: 'Remise en main propre à l’équipe HOPE.',
  },
  {
    cle: 'carte_bancaire',
    libelle: 'Carte bancaire',
    zone: 'international',
    description: 'Visa, Mastercard ou CB.',
  },
  {
    cle: 'virement_international',
    libelle: 'Virement international',
    zone: 'international',
    description: 'Virement depuis un compte bancaire hors de Madagascar.',
  },
  {
    cle: 'plateforme',
    libelle: 'Plateformes de paiement',
    zone: 'international',
    description: 'PayPal ou un autre portefeuille en ligne.',
  },
];

export const FREQUENCES = [
  {
    cle: 'ONE_TIME',
    libelle: 'Don ponctuel',
    texte: 'Un don payé en une seule fois.',
    detail: 'Aucun versement récurrent.',
  },
  {
    cle: 'MONTHLY',
    libelle: 'Don mensuel',
    texte: 'Un don renouvelé chaque mois.',
    detail: 'Un soutien régulier aux projets de HOPE.',
  },
];

const TELEPHONE_E164 = /^\+[1-9]\d{6,14}$/;

export async function recuperer(utilisateurId) {
  await donorProfileRepository.garantir(utilisateurId);
  const fiche = await donorProfileRepository.trouver(utilisateurId);

  return {
    etapeSuivante: fiche.etapeSuivante,
    informations: {
      nom: fiche.nom ?? '',
      prenom: fiche.prenom ?? '',
      adresse: fiche.adresse ?? '',
      ville: fiche.ville ?? '',
      pays: fiche.pays ?? '',
      telephone: fiche.telephone ?? '',
      profession: fiche.profession ?? '',
      source: fiche.sourceConnaissance ?? '',
    },
    profil: {
      type: fiche.typeDonateur ?? '',
      nomStructure: fiche.nomStructure ?? '',
      siteWeb: fiche.siteWeb ?? '',
      devise: fiche.devise ?? '',
      langue: fiche.langue ?? '',
      fuseau: fiche.fuseauHoraire ?? '',
    },
    don: {
      affectation: fiche.affectation ?? '',
      projetId: fiche.projetId ?? null,
    },
    paiement: { mode: fiche.modePaiement ?? '' },
    frequence: { valeur: fiche.frequence ?? '' },
    compte: {
      email: fiche.email ?? '',
      photoUrl: fiche.photoUrl ?? null,
      membreDepuis: fiche.creeLe ?? null,
    },
    options: {
      frequences: FREQUENCES,
      modesPaiement: MODES_PAIEMENT,
      sources: SOURCES_CONNAISSANCE,
      types: TYPES_DONATEUR,
      devises: DEVISES,
      langues: LANGUES,
    },
  };
}

function requis(valeur, champ, max, details) {
  const propre = String(valeur ?? '').trim();
  if (propre === '') details[champ] = 'Champ obligatoire';
  else if (propre.length > max) details[champ] = `Au plus ${max} caractères`;
  return propre;
}

export async function enregistrerEtape1(utilisateurId, corps = {}) {
  const details = {};

  const nom = requis(corps.nom, 'nom', 80, details);
  const prenom = requis(corps.prenom, 'prenom', 80, details);
  const adresse = requis(corps.adresse, 'adresse', 255, details);
  const ville = requis(corps.ville, 'ville', 120, details);

  const pays = String(corps.pays ?? '').trim().toUpperCase();
  if (pays === '') details.pays = 'Champ obligatoire';
  else if (!/^[A-Z]{2}$/.test(pays)) details.pays = 'Pays inconnu';

  const telephone = String(corps.telephone ?? '').replace(/[\s.-]/g, '');
  if (telephone === '') details.telephone = 'Champ obligatoire';
  else if (!TELEPHONE_E164.test(telephone)) details.telephone = 'Numéro invalide';

  const profession = String(corps.profession ?? '').trim();
  if (profession.length > 120) details.profession = 'Au plus 120 caractères';

  const source = String(corps.source ?? '').trim();
  if (source !== '' && !SOURCES_CONNAISSANCE.some((s) => s.cle === source)) {
    details.source = 'Choix inconnu';
  }

  if (Object.keys(details).length > 0) {
    throw new ErreurValidation('Le formulaire comporte des erreurs.', details);
  }

  try {
    await transaction(async (client) => {
      await donorProfileRepository.garantir(utilisateurId, client);
      await donorProfileRepository.enregistrerEtape1(
        utilisateurId,
        {
          nom,
          prenom,
          adresse,
          ville,
          pays,
          telephone,
          profession: profession || null,
          source: source || null,
        },
        client
      );
    });
  } catch (erreur) {
    if (erreur?.code === '23505' && String(erreur.constraint ?? '').includes('telephone')) {
      throw new ErreurValidation('Ce numéro est déjà utilisé par un autre compte.', {
        telephone: 'Numéro déjà utilisé',
      });
    }
    throw erreur;
  }

  return recuperer(utilisateurId);
}

function siteValide(valeur, details) {
  const texte = String(valeur ?? '').trim();
  if (texte === '') return null;
  const complet = /^https?:\/\//i.test(texte) ? texte : `https://${texte}`;
  try {
    const adresse = new URL(complet);
    const domaine = adresse.hostname;
    if (!['http:', 'https:'].includes(adresse.protocol) || !domaine.includes('.')
      || domaine.startsWith('.') || domaine.endsWith('.')) {
      throw new Error('adresse');
    }
  } catch {
    details.siteWeb = 'Adresse de site invalide';
    return null;
  }
  if (complet.length > 255) {
    details.siteWeb = 'Au plus 255 caractères';
    return null;
  }
  return complet;
}

function fuseauValide(valeur) {
  const texte = String(valeur ?? '').trim();
  if (texte === '' || texte.length > 64 || !/^[A-Za-z]+(\/[A-Za-z0-9_+-]+)+$/.test(texte)) {
    return null;
  }
  try {
    new Intl.DateTimeFormat('fr', { timeZone: texte });
    return texte;
  } catch {
    return null;
  }
}

export async function enregistrerEtape2(utilisateurId, corps = {}) {
  const details = {};

  const type = String(corps.type ?? '').trim();
  const typeConnu = TYPES_DONATEUR.find((t) => t.cle === type);
  if (type === '') details.type = 'Choisissez votre type de donateur';
  else if (!typeConnu) details.type = 'Type inconnu';

  let nomStructure = null;
  let siteWeb = null;
  if (typeConnu?.structure) {
    nomStructure = String(corps.nomStructure ?? '').trim();
    if (nomStructure === '') details.nomStructure = 'Champ obligatoire';
    else if (nomStructure.length > 200) details.nomStructure = 'Au plus 200 caractères';
    siteWeb = siteValide(corps.siteWeb, details);
  }

  const devise = String(corps.devise ?? '').trim().toUpperCase();
  if (!DEVISES.some((d) => d.code === devise)) details.devise = 'Choisissez une devise';

  const langue = String(corps.langue ?? '').trim();
  if (!LANGUES.some((l) => l.cle === langue)) details.langue = 'Choisissez une langue';

  const fuseau = fuseauValide(corps.fuseau);
  if (!fuseau) details.fuseau = 'Choisissez un fuseau horaire';

  if (Object.keys(details).length > 0) {
    throw new ErreurValidation('Le formulaire comporte des erreurs.', details);
  }

  await transaction(async (client) => {
    await donorProfileRepository.garantir(utilisateurId, client);
    await donorProfileRepository.enregistrerEtape2(
      utilisateurId,
      { type, nomStructure, siteWeb, devise, langue, fuseau },
      client
    );
  });

  return recuperer(utilisateurId);
}

function accroche(projet) {
  const titre = String(projet.descriptionTitre ?? '').trim();
  if (titre) return titre;
  const texte = String(projet.description ?? '').replace(/\s+/g, ' ').trim();
  if (texte.length <= 150) return texte;
  const coupe = texte.slice(0, 150);
  return `${coupe.slice(0, coupe.lastIndexOf(' ') > 90 ? coupe.lastIndexOf(' ') : 150)}…`;
}

export async function projetsProposes() {
  const { items } = await listerProjets({ status: 'IN_PROGRESS', projectType: 'HOPE', pageSize: 200 });
  return items
    .map((projet) => ({
      id: projet.id,
      reference: projet.reference ?? null,
      nom: projet.name,
      accroche: accroche(projet),
      description: projet.description ?? '',
      debut: projet.startDate ?? projet.createdAt ?? null,
      lieu: projet.location ?? '',
      categorie: projet.categoryName ?? '',
      image: projet.mediaType === 'PHOTO' ? projet.mediaUrl ?? null : null,
      video: projet.mediaType === 'VIDEO',
      devise: projet.currency ?? 'MGA',
      objectif: projet.requiredBudget,
      collecte: projet.fundedTotal,
      restant: projet.remainingNeed,
      taux: projet.fundingRate,
      atteint: Boolean(projet.isFullyFunded),
    }))
    .sort((a, b) => Number(a.atteint) - Number(b.atteint) || Number(a.taux) - Number(b.taux));
}

export async function enregistrerEtape3(utilisateurId, corps = {}) {
  const affectation = String(corps.affectation ?? '').trim().toUpperCase();
  if (!['PROJECT', 'HOPE'].includes(affectation)) {
    throw new ErreurValidation('Choisissez l’affectation de votre don.', {
      affectation: 'Choisissez un don affecté ou non affecté',
    });
  }

  let projetId = null;
  if (affectation === 'PROJECT') {
    const identifiant = Number.parseInt(corps.projetId, 10);
    const projet = (await projetsProposes()).find((p) => p.id === identifiant);
    if (!projet) {
      throw new ErreurValidation('Choisissez un projet parmi ceux qui sont proposés.', {
        projetId: 'Choisissez un projet',
      });
    }
    if (projet.atteint) {
      throw new ErreurValidation('Ce projet a déjà atteint son objectif.', {
        projetId: 'Objectif déjà atteint',
      });
    }
    projetId = projet.id;
  }

  await transaction(async (client) => {
    await donorProfileRepository.garantir(utilisateurId, client);
    await donorProfileRepository.enregistrerEtape3(utilisateurId, { affectation, projetId }, client);
  });

  return recuperer(utilisateurId);
}

export async function enregistrerEtape4(utilisateurId, corps = {}) {
  const mode = String(corps.mode ?? '').trim();
  if (!MODES_PAIEMENT.some((m) => m.cle === mode)) {
    throw new ErreurValidation('Choisissez votre moyen de paiement.', {
      mode: 'Choisissez un moyen de paiement',
    });
  }

  await transaction(async (client) => {
    await donorProfileRepository.garantir(utilisateurId, client);
    await donorProfileRepository.enregistrerEtape4(utilisateurId, mode, client);
  });

  return recuperer(utilisateurId);
}

export async function enregistrerEtape5(utilisateurId, corps = {}) {
  const frequence = String(corps.frequence ?? '').trim().toUpperCase();
  if (!FREQUENCES.some((f) => f.cle === frequence)) {
    throw new ErreurValidation('Choisissez la fréquence de votre don.', {
      frequence: 'Choisissez un don ponctuel ou mensuel',
    });
  }

  await transaction(async (client) => {
    await donorProfileRepository.garantir(utilisateurId, client);
    await donorProfileRepository.enregistrerEtape5(utilisateurId, frequence, client);
  });

  return recuperer(utilisateurId);
}
