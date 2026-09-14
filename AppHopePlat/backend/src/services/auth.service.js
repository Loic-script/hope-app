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
 * L'inscription ne cree que le compte. Les informations propres au role
 * -- competences d'un benevole, raison sociale d'un bailleur -- sont
 * demandees APRES la premiere connexion, par le formulaire de
 * completion : les exiger d'emblee ferait un formulaire de douze champs
 * la ou six suffisent a ouvrir un compte.
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { transaction } from '../config/database.js';
import { config } from '../config/env.js';
import * as volunteerRepository from '../repositories/volunteer.repository.js';
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

/**
 * Inscription.
 *
 * @param {{ nom, prenom, email, telephone, typeUtilisateur,
 *           motDePasse, confirmation }} corps
 */
export async function inscrire(corps = {}) {
  const texte = (valeur) => (typeof valeur === 'string' ? valeur.trim() : '');

  const nom = texte(corps.nom);
  const prenom = texte(corps.prenom);
  const email = texte(corps.email).toLowerCase();
  const telephone = texte(corps.telephone);
  const type = texte(corps.typeUtilisateur).toLowerCase();
  const motDePasse = typeof corps.motDePasse === 'string' ? corps.motDePasse : '';
  const confirmation = typeof corps.confirmation === 'string' ? corps.confirmation : '';

  const details = {};
  if (nom === '') details.nom = 'Champ obligatoire';
  if (prenom === '') details.prenom = 'Champ obligatoire';
  if (email === '') details.email = 'Champ obligatoire';
  else if (!COURRIEL.test(email)) details.email = 'Adresse électronique invalide';
  if (telephone === '') details.telephone = 'Champ obligatoire';
  else if (telephone.length > 20) details.telephone = 'Au plus 20 caractères';
  if (type === '') details.typeUtilisateur = 'Champ obligatoire';
  else if (!TYPES_UTILISATEUR.includes(type)) {
    details.typeUtilisateur = 'Type d’utilisateur inconnu';
  }
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
  if (await volunteerRepository.telephoneExiste(telephone)) {
    throw new ErreurValidation('Ce numéro est déjà utilisé.', {
      telephone: 'Numéro déjà inscrit',
    });
  }

  const hash = await bcrypt.hash(motDePasse, config.admin.saltRounds);
  const aValider = TYPES_A_VALIDER.includes(type);

  const compte = await transaction(async (client) => {
    const cree = await volunteerRepository.creer(
      { nom, prenom, email, telephone, motDePasse: hash },
      [type],
      client
    );

    // Un donateur entre aussitot ; benevole et bailleur attendent HOPE.
    if (!aValider) {
      await volunteerRepository.changerStatut(cree.id, 'actif', null, client);
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
export async function connecter({ email, motDePasse } = {}) {
  const adresse = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const secret = typeof motDePasse === 'string' ? motDePasse : '';

  if (adresse === '' || secret === '') {
    throw new ErreurValidation('L’adresse et le mot de passe sont obligatoires.', {
      email: adresse === '' ? 'Champ obligatoire' : undefined,
      motDePasse: secret === '' ? 'Champ obligatoire' : undefined,
    });
  }

  const compte = await volunteerRepository.trouverParEmailAvecHash(adresse);

  const hash = compte ? compte.motDePasse : HASH_FACTICE;
  const valide = await bcrypt.compare(secret, hash);

  if (!compte || !valide) {
    throw new ErreurAuthentification('Identifiants incorrects');
  }

  const type = typeDuCompte(compte);
  if (!type) {
    throw new ErreurAuthentification(
      'Ce compte n’est rattaché à aucun espace. Contactez l’équipe HOPE.',
      'ROLE_MANQUANT'
    );
  }

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
    // Le donateur n'a pas de formulaire de completion : il entre
    // directement dans son espace.
    completionRequise: !profilComplete && type !== 'donateur',
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
