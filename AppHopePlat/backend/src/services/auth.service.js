import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { transaction } from '../config/database.js';
import { config } from '../config/env.js';
import * as volunteerRepository from '../repositories/volunteer.repository.js';
import { garantirOrganisation } from './funderAuth.service.js';
import * as verificationCourriel from './verificationCourriel.service.js';
import * as courrielsAuto from './courrielsAutomatiques.service.js';
import { signalerNouveauCompte } from './notification.service.js';
import { signerJetonCompletion } from './volunteerAuth.service.js';
import { VERSION_CONDITIONS, verifierConsentement } from '../shared/conditions.js';
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
  estViolationUnicite,
} from '../shared/errors.js';

const HASH_FACTICE = bcrypt.hashSync('hash-factice-anti-timing-attack', 10);

const LONGUEUR_MOT_DE_PASSE = 8;
const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function typeDuCompte(compte) {
  return TYPES_UTILISATEUR.find((type) => (compte.roles ?? []).includes(type)) ?? null;
}

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
    photoUrl: compte.photoUrl ?? null,
  };
}

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

const DUREE_CONSULTATION = '30m';

function typeSaisi(valeur, details) {
  const type = typeof valeur === 'string' ? valeur.trim().toLowerCase() : '';
  if (type === '') details.typeUtilisateur = 'Champ obligatoire';
  else if (!TYPES_UTILISATEUR.includes(type)) {
    details.typeUtilisateur = 'Type d’utilisateur inconnu';
  }
  return type;
}

function adresseDejaPrise() {
  return new ErreurValidation('Cette adresse est déjà utilisée.', {
    email: 'Adresse déjà inscrite',
  });
}

async function inscrireOuRefuser(travail) {
  try {
    return await transaction(travail);
  } catch (erreur) {
    if (estViolationUnicite(erreur, 'utilisateur_email_key')) throw adresseDejaPrise();
    throw erreur;
  }
}

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
  verifierConsentement(corps, details);

  if (Object.keys(details).length > 0) {
    throw new ErreurValidation('Le formulaire comporte des erreurs.', details);
  }

  if (await volunteerRepository.emailExiste(email)) throw adresseDejaPrise();

  const hash = await bcrypt.hash(motDePasse, config.admin.saltRounds);
  const aValider = TYPES_A_VALIDER.includes(type);

  const compte = await inscrireOuRefuser(async (client) => {
    const cree = await volunteerRepository.creer(
      { nom: '', prenom: '', email, telephone: null, motDePasse: hash, conditionsVersion: VERSION_CONDITIONS },
      [type],
      client
    );

    if (!aValider) {
      await volunteerRepository.changerStatut(cree.id, 'actif', null, client);
    }

    if (type === 'bailleur') {
      await garantirOrganisation(cree.id, {}, client);
      await volunteerRepository.marquerProfilComplete(cree.id, client);
    }

    await signalerNouveauCompte(
      { utilisateurId: cree.id, type, email, nom: '' },
      client
    );

    return volunteerRepository.trouverParId(cree.id, client);
  });

  await verificationCourriel.envoyerLien(compte);
  if (aValider) void courrielsAuto.compteAValider({ email, type });

  const jetonCompletion = type === 'benevole' ? signerJetonCompletion(compte) : null;

  return {
    utilisateur: versUtilisateurPublic(compte, type),
    aValider,
    espace: ESPACE_PAR_TYPE[type],
    ...(jetonCompletion ? { jetonCompletion, aCompleter: '/benevole/completer-profil' } : {}),
  };
}

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

  if (!(compte.roles ?? []).includes(typeChoisi)) {
    const libelle = String(LIBELLES_TYPE[typeChoisi] ?? typeChoisi).toLowerCase();
    throw new ErreurAuthentification(
      `Ce compte n’est pas un compte ${libelle}. ` +
        'Choisissez le type d’utilisateur sous lequel vous vous êtes inscrit.',
      'TYPE_INCORRECT'
    );
  }
  const type = typeChoisi;

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
    completionRequise: !profilComplete && (type === 'benevole' || type === 'donateur'),
  };
}

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

export async function marquerProfilComplete(utilisateurId, client = null) {
  await volunteerRepository.marquerProfilComplete(utilisateurId, client);
}

export async function jetonNeuf(utilisateurId, type) {
  const compte = await volunteerRepository.trouverParId(utilisateurId);
  if (!compte) throw new ErreurIntrouvable('Le compte', utilisateurId);
  return signerJeton(compte, type);
}

export { versUtilisateurPublic, typeDuCompte };
