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

/** Les langues dans lesquelles HOPE peut ecrire au donateur. */
export const LANGUES = [
  { cle: 'fr', libelle: 'Français' },
  { cle: 'mg', libelle: 'Malagasy' },
  { cle: 'en', libelle: 'English' },
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
    options: {
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

