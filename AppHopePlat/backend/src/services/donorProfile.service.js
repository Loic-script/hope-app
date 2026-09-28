/**
 * Le parcours d'accueil du donateur.
 *
 * Cinq etapes s'ouvrent des l'inscription : informations personnelles,
 * profil du donateur, affectation du don, mode de paiement, frequence.
 * Ce fichier porte la premiere ; les suivantes s'y ajouteront.
 */
import { transaction } from '../config/database.js';
import * as donorProfileRepository from '../repositories/donorProfile.repository.js';
import { ErreurValidation } from '../shared/errors.js';
import { DEVISES_ACCEPTEES } from '../shared/money.js';
import { lister as listerProjets } from './project.service.js';

/**
 * Comment on a connu HOPE.
 *
 * La liste vit ici, et la contrainte de la table la recopie : le
 * formulaire la recoit du serveur, et ne peut donc pas proposer un choix
 * que la base refuserait.
 */
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

/**
 * Les types de donateur. "structure" dit ceux qui donnent au nom d'une
 * organisation : leur raison sociale est alors exigee, pour les recus.
 */
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

/** Les devises proposees : celles qu'un don peut effectivement porter. */
const LIBELLES_DEVISE = { MGA: 'Ariary', EUR: 'Euro', USD: 'Dollar américain' };
export const DEVISES = DEVISES_ACCEPTEES.map((code) => ({
  code,
  libelle: LIBELLES_DEVISE[code] ?? code,
}));

/**
 * Les langues du monde : codes ISO 639-1 des langues vivantes.
 *
 * Les langues anciennes, liturgiques ou construites pour l'etude (latin,
 * sanskrit, avestique, volapuk...) n'y sont pas : on choisit ici la
 * langue dans laquelle on veut etre ecrit. Le norvegien figure une fois,
 * sous "no", plutot qu'en trois variantes.
 */
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

/** Les langues dans lesquelles HOPE ecrit deja : proposees en tete. */
const LANGUES_COURANTES = ['fr', 'mg', 'en'];

const nomsFrancais = new Intl.DisplayNames(['fr'], { type: 'language', fallback: 'none' });

/** Le nom d'une langue dans cette langue-la ("español"), si le moteur le connait. */
function nomPropre(code) {
  try {
    if (Intl.DisplayNames.supportedLocalesOf([code]).length === 0) return null;
    return new Intl.DisplayNames([code], { type: 'language', fallback: 'none' }).of(code) ?? null;
  } catch {
    return null;
  }
}

/**
 * "Espagnol (español)", "Malgache (Malagasy)", "Français" : le nom
 * francais, pour la page qui est en francais, et le nom que la langue se
 * donne, pour qu'on reconnaisse la sienne au premier coup d'oeil.
 */
function libelleLangue(code) {
  const francais = nomsFrancais.of(code) ?? code;
  const libelle = francais.charAt(0).toLocaleUpperCase('fr') + francais.slice(1);
  const propre = nomPropre(code);
  return propre && propre.toLowerCase() !== francais.toLowerCase() ? `${libelle} (${propre})` : libelle;
}

/** Toutes les langues : les courantes d'abord, puis les autres par ordre alphabetique. */
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

/**
 * Les modes de paiement, dans l'ordre du modele : ceux qu'on utilise a
 * Madagascar, puis ceux qui viennent de l'etranger. "zone" permet au
 * formulaire de mettre en tete ceux du pays du donateur.
 *
 * Les phrases disent ce qu'est le moyen, pas ce qui se passera ensuite :
 * le paiement lui-meme n'est pas encore en ligne.
 */
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

/** Les deux frequences : le vocabulaire de donations.frequency. */
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

/** Le numero au format international : "+261341234567". */
const TELEPHONE_E164 = /^\+[1-9]\d{6,14}$/;

/** La fiche, et ce qu'il faut au formulaire pour l'afficher. */
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
    // Vide tant que l'etape 2 n'a pas ete enregistree : le formulaire
    // propose alors ses valeurs, deduites du pays.
    profil: {
      type: fiche.typeDonateur ?? '',
      nomStructure: fiche.nomStructure ?? '',
      siteWeb: fiche.siteWeb ?? '',
      devise: fiche.devise ?? '',
      langue: fiche.langue ?? '',
      fuseau: fiche.fuseauHoraire ?? '',
    },
    // Vide tant que l'etape 3 n'a pas ete enregistree.
    don: {
      affectation: fiche.affectation ?? '',
      projetId: fiche.projetId ?? null,
    },
    // Vide tant que l'etape 4 n'a pas ete enregistree.
    paiement: { mode: fiche.modePaiement ?? '' },
    // Vide tant que l'etape 5 n'a pas ete enregistree.
    frequence: { valeur: fiche.frequence ?? '' },
    // Le compte lui-meme : son adresse, sa photo, depuis quand il donne.
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

/** Un texte obligatoire, borne. L'erreur va dans details. */
function requis(valeur, champ, max, details) {
  const propre = String(valeur ?? '').trim();
  if (propre === '') details[champ] = 'Champ obligatoire';
  else if (propre.length > max) details[champ] = `Au plus ${max} caractères`;
  return propre;
}

/**
 * Enregistre l'etape 1.
 *
 * Obligatoires : nom, prenom, adresse, ville, pays, telephone.
 * Facultatifs : profession, et la facon dont on a connu HOPE.
 */
export async function enregistrerEtape1(utilisateurId, corps = {}) {
  const details = {};

  const nom = requis(corps.nom, 'nom', 80, details);
  const prenom = requis(corps.prenom, 'prenom', 80, details);
  const adresse = requis(corps.adresse, 'adresse', 255, details);
  const ville = requis(corps.ville, 'ville', 120, details);

  const pays = String(corps.pays ?? '').trim().toUpperCase();
  if (pays === '') details.pays = 'Champ obligatoire';
  else if (!/^[A-Z]{2}$/.test(pays)) details.pays = 'Pays inconnu';

  // Le formulaire envoie le numero deja mis au format international.
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
    // Le telephone est UNIQUE sur le compte : un numero deja porte par
    // un autre revient comme une erreur de champ, pas une erreur interne.
    if (erreur?.code === '23505' && String(erreur.constraint ?? '').includes('telephone')) {
      throw new ErreurValidation('Ce numéro est déjà utilisé par un autre compte.', {
        telephone: 'Numéro déjà utilisé',
      });
    }
    throw erreur;
  }

  return recuperer(utilisateurId);
}

/**
 * Une adresse de site, completee et controlee.
 *
 * "hope.mg" devient "https://hope.mg" : personne ne tape le protocole, et
 * un lien sans lui ne mene nulle part. Seuls http et https sont admis,
 * avec un nom de domaine qui en est un.
 */
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

/** Un fuseau IANA que le moteur sait appliquer. */
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

/**
 * Enregistre l'etape 2.
 *
 * Obligatoires : le type, la devise, la langue, le fuseau -- et la
 * raison sociale pour une structure. Le site web reste facultatif ; il
 * n'est garde que pour une structure, comme la raison sociale.
 */
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

/* ================================================================
   Etape 3 : l'affectation du don
   ================================================================ */

/** Une accroche de projet : son titre de description, ou son debut. */
function accroche(projet) {
  const titre = String(projet.descriptionTitre ?? '').trim();
  if (titre) return titre;
  const texte = String(projet.description ?? '').replace(/\s+/g, ' ').trim();
  if (texte.length <= 150) return texte;
  const coupe = texte.slice(0, 150);
  return `${coupe.slice(0, coupe.lastIndexOf(' ') > 90 ? coupe.lastIndexOf(' ') : 150)}…`;
}

/**
 * Les projets que l'on peut soutenir.
 *
 * Les projets HOPE en cours -- ni termines, ni archives, ni internes : un
 * projet interne fait evoluer HOPE elle-meme, et ne se presente pas aux
 * donateurs. Les chiffres sont ceux de la fiche projet de l'equipe.
 *
 * Seule leur face publique sort d'ici : nom, lieu, categorie, image,
 * accroche, et les totaux. Rien sur les beneficiaires ni les donateurs.
 *
 * Ceux qui ont le plus besoin de soutien viennent d'abord ; un projet
 * deja finance vient en dernier, marque comme tel.
 */
export async function projetsProposes() {
  const { items } = await listerProjets({ status: 'IN_PROGRESS', projectType: 'HOPE', pageSize: 200 });
  return items
    .map((projet) => ({
      id: projet.id,
      reference: projet.reference ?? null,
      nom: projet.name,
      accroche: accroche(projet),
      // Le texte entier, et la date de lancement : l'espace donateur
      // presente ces projets en fil de publications.
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

/**
 * Enregistre l'etape 3.
 *
 * PROJECT exige un projet, et un projet que l'on peut encore soutenir :
 * en cours, et dont l'objectif n'est pas atteint. HOPE n'en prend aucun.
 */
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

/* ================================================================
   Etape 4 : le mode de paiement
   ================================================================ */

/** Enregistre l'etape 4 : un mode de paiement de la liste. */
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

/* ================================================================
   Etape 5 : la frequence, et la fin du parcours
   ================================================================ */

/** Enregistre l'etape 5 et clot le parcours. */
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
