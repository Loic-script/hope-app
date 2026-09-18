/**
 * Authentification unifiee des utilisateurs non administrateurs.
 *
 * Un seul formulaire d'inscription et une seule connexion pour les trois
 * types : donateur, benevole, bailleur. Le type choisi a l'inscription
 * decide de trois choses :
 *
 *   * le role pose dans utilisateur_role ;
 *   * si le compte s'ouvre aussitot ou attend la validation de HOPE ;
 *   * l'audience du jeton, donc l'espace ou il vaut.
 *
 * L'inscription ne demande que quatre choses : l'adresse, le type, le
 * mot de passe et sa confirmation. Le nom, le prenom et le telephone
 * viennent ensuite, la ou ils servent -- chaque champ de plus a la porte
 * est une raison de plus de ne pas la franchir.
 *
 * Ce qui manque ensuite depend du role. Le benevole passe par un
 * formulaire de completion, qui demande son nom : l'equipe ne confie
 * pas une tache a une adresse. Le bailleur, lui, entre directement --
 * son organisation est creee avec le compte, sous un nom provisoire, et
 * il precise l'une et l'autre dans ses parametres.
 *
 * La connexion demande aussi le type : c'est lui qui designe l'espace.
 * Un compte peut porter plusieurs roles, et le type choisi doit en etre
 * un -- sinon la connexion est refusee, avec un message qui le dit.
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { transaction } from '../config/database.js';
import { config } from '../config/env.js';
import * as volunteerRepository from '../repositories/volunteer.repository.js';
import { garantirOrganisation } from './funderAuth.service.js';
import {
  AUDIENCE_PAR_TYPE,
  EMETTEUR,
  ESPACE_PAR_TYPE,
  LIBELLES_TYPE,
  TYPES_A_VALIDER,
  TYPES_UTILISATEUR,
} from '../shared/audiences.js';
import {
  ErreurAuthentification,
  ErreurIntrouvable,
  ErreurRegleMetier,
  ErreurValidation,
} from '../shared/errors.js';

/**
 * Hash factice compare lorsque le courriel est inconnu : le refus coute
 * alors le meme temps qu'un mot de passe errone et ne revele pas quels
 * comptes existent.
 */
const HASH_FACTICE = bcrypt.hashSync('hash-factice-anti-timing-attack', 10);

const LONGUEUR_MOT_DE_PASSE = 8;
const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Le type d'un compte, deduit de ses roles. */
function typeDuCompte(compte) {
  return TYPES_UTILISATEUR.find((type) => (compte.roles ?? []).includes(type)) ?? null;
}

/** Vue publique d'un compte. Le hash ne sort jamais d'ici. */
function versUtilisateurPublic(compte, type) {
  return {
    id: compte.id,
    nom: compte.nom,
    prenom: compte.prenom,
    email: compte.email,
    telephone: compte.telephone,
    type,
    typeLibelle: LIBELLES_TYPE[type] ?? type,
    statut: compte.statut,
    profilComplete: Boolean(compte.profilComplete),
    roles: compte.roles ?? [],
    creeLe: compte.creeLe,
  };
}

/**
 * Signe un jeton pour l'espace correspondant au type.
 *
 * @param {object} options.duree duree de validite ; celle de la
 *        configuration par defaut, plus courte pour une consultation
 *        depuis l'espace administrateur.
 * @param {object} options.pour l'administrateur au nom de qui le jeton
 *        est emis, le cas echeant. Il voyage dans le jeton afin qu'une
 *        session de consultation reste identifiable a la lecture.
 */
function signerJeton(compte, type, { duree = config.jwt.expiresIn, pour = null } = {}) {
  return jwt.sign(
    {
      utilisateurId: compte.id,
      email: compte.email,
      type,
      ...(pour ? { consultePar: pour } : {}),
    },
    config.jwt.secret,
    {
      subject: String(compte.id),
      expiresIn: duree,
      issuer: EMETTEUR,
      audience: AUDIENCE_PAR_TYPE[type],
    }
  );
}

/**
 * Duree d'une session de consultation.
 *
 * Trente minutes : de quoi faire le tour d'un espace, pas de quoi
 * laisser trainer un acces. Un jeton ordinaire vit bien plus longtemps.
 */
const DUREE_CONSULTATION = '30m';

/** Le type d'utilisateur saisi, controle ; l'erreur va dans details. */
function typeSaisi(valeur, details) {
  const type = typeof valeur === 'string' ? valeur.trim().toLowerCase() : '';
  if (type === '') details.typeUtilisateur = 'Champ obligatoire';
  else if (!TYPES_UTILISATEUR.includes(type)) {
    details.typeUtilisateur = 'Type d’utilisateur inconnu';
  }
  return type;
}

/**
 * Inscription.
 *
 * Quatre champs : l'adresse, le type, le mot de passe et sa
 * confirmation. Le nom et le prenom partent vides -- les colonnes sont
 * NOT NULL, et une chaine vide dit "pas encore renseigne" sans faire
 * afficher "null" la ou l'on accole prenom et nom. Le telephone part a
 * NULL : la colonne est UNIQUE, et plusieurs comptes sans numero ne
 * doivent pas entrer en conflit.
 *
 * @param {{ email, typeUtilisateur, motDePasse, confirmation }} corps
 */
export async function inscrire(corps = {}) {
  const texte = (valeur) => (typeof valeur === 'string' ? valeur.trim() : '');

  const email = texte(corps.email).toLowerCase();
  const motDePasse = typeof corps.motDePasse === 'string' ? corps.motDePasse : '';
  const confirmation = typeof corps.confirmation === 'string' ? corps.confirmation : '';

  const details = {};
  if (email === '') details.email = 'Champ obligatoire';
  else if (!COURRIEL.test(email)) details.email = 'Adresse électronique invalide';
  const type = typeSaisi(corps.typeUtilisateur, details);
  if (motDePasse === '') details.motDePasse = 'Champ obligatoire';
  else if (motDePasse.length < LONGUEUR_MOT_DE_PASSE) {
    details.motDePasse = `Au moins ${LONGUEUR_MOT_DE_PASSE} caractères`;
  }
  if (confirmation !== motDePasse) {
    details.confirmation = 'Les deux mots de passe ne correspondent pas';
  }

  if (Object.keys(details).length > 0) {
    throw new ErreurValidation('Le formulaire comporte des erreurs.', details);
  }

  if (await volunteerRepository.emailExiste(email)) {
    throw new ErreurValidation('Cette adresse est déjà utilisée.', {
      email: 'Adresse déjà inscrite',
    });
  }

  const hash = await bcrypt.hash(motDePasse, config.admin.saltRounds);
  const aValider = TYPES_A_VALIDER.includes(type);

  const compte = await transaction(async (client) => {
    const cree = await volunteerRepository.creer(
      { nom: '', prenom: '', email, telephone: null, motDePasse: hash },
      [type],
      client
    );

    // Un donateur entre aussitot ; benevole et bailleur attendent HOPE.
    if (!aValider) {
      await volunteerRepository.changerStatut(cree.id, 'actif', null, client);
    }

    /*
     * Un bailleur n'a pas de formulaire a remplir apres son inscription.
     *
     * Son organisation est creee ici, sous un nom provisoire, et il la
     * precise quand il veut depuis "Mon organisation". Exiger une raison
     * sociale et un type avant meme de voir l'espace arretait des gens a
     * la porte, pour des informations que l'equipe HOPE reprend de toute
     * facon a la signature d'une convention.
     */
    if (type === 'bailleur') {
      await garantirOrganisation(cree.id, {}, client);
      await volunteerRepository.marquerProfilComplete(cree.id, client);
    }

    return volunteerRepository.trouverParId(cree.id, client);
  });

  return {
    utilisateur: versUtilisateurPublic(compte, type),
    aValider,
    espace: ESPACE_PAR_TYPE[type],
  };
}

/**
 * Connexion.
 *
 * Renvoie le jeton, le compte, l'espace ou aller, et s'il reste un
 * formulaire a remplir. C'est le frontend qui route : il a besoin des
 * trois informations d'un coup.
 */
export async function connecter({ email, motDePasse, typeUtilisateur } = {}) {
  const adresse = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const secret = typeof motDePasse === 'string' ? motDePasse : '';

  const details = {};
  if (adresse === '') details.email = 'Champ obligatoire';
  const typeChoisi = typeSaisi(typeUtilisateur, details);
  if (secret === '') details.motDePasse = 'Champ obligatoire';
  if (Object.keys(details).length > 0) {
    throw new ErreurValidation(
      'L’adresse, le type d’utilisateur et le mot de passe sont obligatoires.',
      details
    );
  }

  const compte = await volunteerRepository.trouverParEmailAvecHash(adresse);

  const hash = compte ? compte.motDePasse : HASH_FACTICE;
  const valide = await bcrypt.compare(secret, hash);

  if (!compte || !valide) {
    throw new ErreurAuthentification('Identifiants incorrects');
  }

  if (!typeDuCompte(compte)) {
    throw new ErreurAuthentification(
      'Ce compte n’est rattaché à aucun espace. Contactez l’équipe HOPE.',
      'ROLE_MANQUANT'
    );
  }

  // Le type choisi doit etre l'un des roles du compte. Le dire n'apprend
  // rien a un intrus : le mot de passe a deja ete verifie.
  if (!(compte.roles ?? []).includes(typeChoisi)) {
    const libelle = String(LIBELLES_TYPE[typeChoisi] ?? typeChoisi).toLowerCase();
    throw new ErreurAuthentification(
      `Ce compte n’est pas un compte ${libelle}. ` +
        'Choisissez le type d’utilisateur sous lequel vous vous êtes inscrit.',
      'TYPE_INCORRECT'
    );
  }
  const type = typeChoisi;

  // Les controles de statut viennent APRES la verification du mot de
  // passe : les faire avant revelerait qu'un compte existe.
  if (compte.statut === 'en_attente') {
    throw new ErreurAuthentification(
      'Votre compte attend la validation de l’équipe HOPE. Vous recevrez l’accès dès qu’il sera activé.',
      'COMPTE_EN_ATTENTE'
    );
  }
  if (compte.statut === 'suspendu') {
    throw new ErreurAuthentification(
      'Ce compte est suspendu. Contactez l’équipe HOPE.',
      'COMPTE_SUSPENDU'
    );
  }
  if (compte.statut !== 'actif') {
    throw new ErreurAuthentification('Ce compte n’est plus accessible.', 'COMPTE_INACTIF');
  }

  await volunteerRepository.marquerConnexion(compte.id);

  const profilComplete = Boolean(compte.profilComplete);

  return {
    token: signerJeton(compte, type),
    expiresIn: config.jwt.expiresIn,
    utilisateur: versUtilisateurPublic(compte, type),
    type,
    espace: ESPACE_PAR_TYPE[type],
    profilComplete,
    // Le benevole remplit sa fiche avant d'entrer ; le donateur suit son
    // parcours d'accueil en cinq etapes. Le bailleur, lui, precise son
    // organisation quand il veut, depuis ses parametres.
    completionRequise: !profilComplete && (type === 'benevole' || type === 'donateur'),
  };
}

/**
 * Ouvre une session de consultation sur l'espace d'un utilisateur.
 *
 * L'administrateur voit alors l'espace tel que son occupant le voit.
 * C'est un pouvoir reel : la route qui y mene est reservee au role
 * ADMIN, le jeton ne vaut que trente minutes, et il porte le nom de
 * l'administrateur qui l'a demande -- une session de consultation reste
 * ainsi reconnaissable a la lecture du jeton.
 *
 * Aucun mot de passe n'est demande et aucun n'est revele : le compte
 * consulte garde le sien, et l'administrateur n'apprend rien qu'il ne
 * puisse deja lire depuis son espace.
 *
 * @param {string} utilisateurId identifiant du compte a consulter
 * @param {{ adminLog?: string }} admin celui qui consulte
 */
export async function consulterEspace(utilisateurId, admin = null) {
  const compte = await volunteerRepository.trouverParId(utilisateurId);
  if (!compte) throw new ErreurIntrouvable('Le compte', utilisateurId);

  const type = typeDuCompte(compte);
  if (!type) {
    throw new ErreurRegleMetier(
      'Ce compte n’est rattaché à aucun espace : il n’y a rien à consulter.',
      'ROLE_MANQUANT'
    );
  }

  // Un compte suspendu ou en attente n'a pas d'espace ouvert : le
  // consulter montrerait un ecran que son occupant ne voit pas.
  if (compte.statut !== 'actif') {
    throw new ErreurRegleMetier(
      `Ce compte est « ${compte.statut} » : son espace n’est pas ouvert.`,
      'COMPTE_INACTIF'
    );
  }

  return {
    token: signerJeton(compte, type, {
      duree: DUREE_CONSULTATION,
      pour: admin?.adminLog ?? null,
    }),
    expiresIn: DUREE_CONSULTATION,
    type,
    espace: ESPACE_PAR_TYPE[type],
    utilisateur: versUtilisateurPublic(compte, type),
  };
}

/** Marque le profil comme complete. Appele par les formulaires dedies. */
export async function marquerProfilComplete(utilisateurId, client = null) {
  await volunteerRepository.marquerProfilComplete(utilisateurId, client);
}

export { versUtilisateurPublic, typeDuCompte };
