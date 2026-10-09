import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { config } from '../config/env.js';
import * as volunteerRepository from '../repositories/volunteer.repository.js';
import { ErreurAuthentification, ErreurValidation } from '../shared/errors.js';
import { VERSION_CONDITIONS, verifierConsentement } from '../shared/conditions.js';
import * as verificationCourriel from './verificationCourriel.service.js';

const AUDIENCE = 'hope-benevole';

const HASH_FACTICE = bcrypt.hashSync('hash-factice-anti-timing-attack', 10);

const LONGUEUR_MOT_DE_PASSE = 8;

const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
    profilComplete: Boolean(compte.profilComplete),
    roles: compte.roles ?? [],
    creeLe: compte.creeLe,
    derniereConnexion: compte.derniereConnexion,
  };
}

export function calculerAge(dateDeNaissance) {
  if (!dateDeNaissance) return null;

  const naissance = new Date(dateDeNaissance);
  if (Number.isNaN(naissance.getTime())) return null;

  const aujourdhui = new Date();
  let age = aujourdhui.getFullYear() - naissance.getFullYear();

  const mois = aujourdhui.getMonth() - naissance.getMonth();
  if (mois < 0 || (mois === 0 && aujourdhui.getDate() < naissance.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

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

export const PORTEE_COMPLETION = 'completion';

export function signerJetonCompletion(compte) {
  return jwt.sign(
    { utilisateurId: compte.id, email: compte.email, portee: PORTEE_COMPLETION },
    config.jwt.secret,
    {
      subject: String(compte.id),
      expiresIn: '2h',
      issuer: 'hope-api',
      audience: AUDIENCE,
    }
  );
}

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
  verifierConsentement(corps, details);

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
    { nom, prenom, email, motDePasse: hash, conditionsVersion: VERSION_CONDITIONS },
    ['benevole']
  );
  await verificationCourriel.envoyerLien({ id: compte.id, email, prenom });

  return versBenevolePublic(compte);
}

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

export async function recupererBenevoleACompleter(utilisateurId) {
  const compte = await volunteerRepository.trouverParId(utilisateurId);

  if (!compte) {
    throw new ErreurAuthentification('Compte introuvable.', 'COMPTE_INTROUVABLE');
  }
  if (!['actif', 'en_attente'].includes(compte.statut)) {
    throw new ErreurAuthentification('Ce compte n’est plus actif.', 'COMPTE_INACTIF');
  }
  if (compte.profilComplete) {
    throw new ErreurAuthentification(
      'Votre fiche est déjà enregistrée. Connectez-vous pour la modifier.',
      'PROFIL_DEJA_COMPLET'
    );
  }
  return versBenevolePublic(compte);
}

export { versBenevolePublic };
