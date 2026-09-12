/**
 * Service d'authentification de l'espace benevole.
 *
 * Meme chaine que pour l'administrateur -- verification des champs,
 * recherche en base, comparaison bcrypt, JWT -- avec une etape de plus :
 * un compte fraichement inscrit ne peut pas encore entrer. Il attend
 * qu'un administrateur l'active.
 *
 * L'audience du jeton est "hope-benevole" et non "hope-admin" : un jeton
 * de benevole est donc rejete par les routes de l'espace administrateur,
 * et reciproquement, meme si le secret de signature est le meme.
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { config } from '../config/env.js';
import * as volunteerRepository from '../repositories/volunteer.repository.js';
import { ErreurAuthentification, ErreurValidation } from '../shared/errors.js';

/** Audience des jetons de cet espace. */
const AUDIENCE = 'hope-benevole';

/**
 * Hash factice compare lorsque le courriel est inconnu.
 *
 * Sans lui, une adresse inexistante repondrait bien plus vite qu'une
 * adresse connue au mauvais mot de passe : l'ecart suffirait a deviner
 * quels comptes existent. On paie donc toujours le meme calcul.
 */
const HASH_FACTICE = bcrypt.hashSync('hash-factice-anti-timing-attack', 10);

/** Longueur minimale du mot de passe a l'inscription. */
const LONGUEUR_MOT_DE_PASSE = 8;

/** Forme acceptee pour un courriel. Volontairement large. */
const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Retire le hash et calcule l'age avant toute sortie vers le client.
 * mot_de_passe ne doit jamais quitter le backend.
 */
function versBenevolePublic(compte) {
  return {
    id: compte.id,
    nom: compte.nom,
    prenom: compte.prenom,
    email: compte.email,
    telephone: compte.telephone,
    photoUrl: compte.photoUrl,
    adresse: compte.adresse,
    dateDeNaissance: compte.dateDeNaissance,
    age: calculerAge(compte.dateDeNaissance),
    statut: compte.statut,
    // L'espace en a besoin pour router vers le formulaire de
    // completion tant qu'il n'est pas rempli.
    profilComplete: Boolean(compte.profilComplete),
    roles: compte.roles ?? [],
    creeLe: compte.creeLe,
    derniereConnexion: compte.derniereConnexion,
  };
}

/**
 * Age en annees revolues, ou null si la date de naissance est inconnue.
 *
 * Il est calcule a chaque lecture plutot que stocke : une colonne "age"
 * serait fausse des le lendemain de l'anniversaire.
 */
export function calculerAge(dateDeNaissance) {
  if (!dateDeNaissance) return null;

  const naissance = new Date(dateDeNaissance);
  if (Number.isNaN(naissance.getTime())) return null;

  const aujourdhui = new Date();
  let age = aujourdhui.getFullYear() - naissance.getFullYear();

  // L'anniversaire de cette annee est-il deja passe ?
  const mois = aujourdhui.getMonth() - naissance.getMonth();
  if (mois < 0 || (mois === 0 && aujourdhui.getDate() < naissance.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

/** Construit le JWT porte par l'espace benevole. */
function signerJeton(compte) {
  return jwt.sign(
    { utilisateurId: compte.id, email: compte.email },
    config.jwt.secret,
    {
      subject: String(compte.id),
      expiresIn: config.jwt.expiresIn,
      issuer: 'hope-api',
      audience: AUDIENCE,
    }
  );
}

/**
 * Inscription d'un benevole.
 *
 * Le compte est cree en statut "en_attente" : il existe, mais il ne
 * donne acces a rien tant qu'un administrateur ne l'a pas active.
 *
 * @param {{ nom, prenom, email, motDePasse, confirmation }} corps
 * @returns {Promise<object>} le compte cree, sans son hash
 */
export async function inscrire(corps = {}) {
  const nom = typeof corps.nom === 'string' ? corps.nom.trim() : '';
  const prenom = typeof corps.prenom === 'string' ? corps.prenom.trim() : '';
  const email = typeof corps.email === 'string' ? corps.email.trim().toLowerCase() : '';
  const motDePasse = typeof corps.motDePasse === 'string' ? corps.motDePasse : '';
  const confirmation = typeof corps.confirmation === 'string' ? corps.confirmation : '';

  const details = {};
  if (nom === '') details.nom = 'Champ obligatoire';
  if (prenom === '') details.prenom = 'Champ obligatoire';
  if (email === '') details.email = 'Champ obligatoire';
  else if (!COURRIEL.test(email)) details.email = 'Adresse électronique invalide';
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

  const compte = await volunteerRepository.creer(
    { nom, prenom, email, motDePasse: hash },
    ['benevole']
  );

  return versBenevolePublic(compte);
}

/**
 * Connexion d'un benevole.
 *
 * @throws {ErreurAuthentification} identifiants refuses, ou compte pas
 *         encore active / suspendu
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

  // Meme cout de calcul, et meme message, que le compte existe ou non.
  const hash = compte ? compte.motDePasse : HASH_FACTICE;
  const valide = await bcrypt.compare(secret, hash);

  if (!compte || !valide) {
    throw new ErreurAuthentification('Identifiants incorrects');
  }

  // Le controle du statut vient APRES la verification du mot de passe :
  // le faire avant revelerait, par le seul message, qu'un compte existe.
  if (compte.statut === 'en_attente') {
    throw new ErreurAuthentification(
      'Votre compte attend la validation d’un administrateur. Vous recevrez l’accès dès qu’il sera activé.',
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

  if (!(compte.roles ?? []).includes('benevole')) {
    throw new ErreurAuthentification(
      'Ce compte n’a pas accès à l’espace bénévole.',
      'ROLE_MANQUANT'
    );
  }

  await volunteerRepository.marquerConnexion(compte.id);

  return {
    token: signerJeton(compte),
    benevole: versBenevolePublic(compte),
    expiresIn: config.jwt.expiresIn,
  };
}

/** Verifie un JWT de l'espace benevole. */
export function verifierJeton(token) {
  try {
    return jwt.verify(token, config.jwt.secret, {
      issuer: 'hope-api',
      audience: AUDIENCE,
    });
  } catch (erreur) {
    if (erreur.name === 'TokenExpiredError') {
      throw new ErreurAuthentification(
        'Session expirée, veuillez vous reconnecter.',
        'JETON_EXPIRE'
      );
    }
    throw new ErreurAuthentification('Jeton invalide.', 'JETON_INVALIDE');
  }
}

/**
 * Recharge le compte depuis la base a partir du jeton.
 *
 * On ne se fie pas au seul contenu du JWT : le compte a pu etre suspendu
 * depuis son emission, et le jeton reste valable deux heures.
 */
export async function recupererBenevoleAuthentifie(utilisateurId) {
  const compte = await volunteerRepository.trouverParId(utilisateurId);

  if (!compte) {
    throw new ErreurAuthentification('Compte introuvable.', 'COMPTE_INTROUVABLE');
  }
  if (compte.statut !== 'actif') {
    throw new ErreurAuthentification('Ce compte n’est plus actif.', 'COMPTE_INACTIF');
  }
  return versBenevolePublic(compte);
}

export { versBenevolePublic };
