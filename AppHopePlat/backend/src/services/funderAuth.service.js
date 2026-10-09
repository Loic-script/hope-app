import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { transaction } from '../config/database.js';
import { config } from '../config/env.js';
import * as funderRepository from '../repositories/funder.repository.js';
import * as volunteerRepository from '../repositories/volunteer.repository.js';
import * as verificationCourriel from './verificationCourriel.service.js';
import { signalerNouveauCompte } from './notification.service.js';
import { VERSION_CONDITIONS, verifierConsentement } from '../shared/conditions.js';
import {
  ErreurAuthentification,
  ErreurValidation,
  estViolationUnicite,
} from '../shared/errors.js';

const AUDIENCE = 'hope-bailleur';

export const TYPES_ORGANISATION = [
  'fondation_privee',
  'entreprise',
  'agence_publique',
  'ong',
  'ambassade',
  'autre',
];

export const LIBELLES_TYPE = {
  autre: 'À préciser',
  fondation_privee: 'Fondation privée',
  entreprise: 'Entreprise',
  agence_publique: 'Agence publique',
  ong: 'ONG',
  ambassade: 'Ambassade',
};

const HASH_FACTICE = bcrypt.hashSync('hash-factice-anti-timing-attack', 10);

const LONGUEUR_MOT_DE_PASSE = 8;
const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function versBailleurPublic(fiche) {
  return {
    utilisateurId: fiche.utilisateurId ?? null,
    bailleurId: fiche.id,
    raisonSociale: fiche.raisonSociale,
    typeOrganisation: fiche.typeOrganisation,
    typeLibelle: LIBELLES_TYPE[fiche.typeOrganisation] ?? fiche.typeOrganisation,
    secteur: fiche.secteur,
    pays: fiche.pays,
    adresse: fiche.adresse,
    siteWeb: fiche.siteWeb,
    logoUrl: fiche.logoUrl,
    nif: fiche.nif,
    partenaireDepuis: fiche.partenaireDepuis,
    statut: fiche.statut,
    niveau: fiche.niveau,
    contactId: fiche.contactId,
    nom: fiche.nom,
    prenom: fiche.prenom,
    email: fiche.email,
    telephone: fiche.telephone,
    photoUrl: fiche.photoUrl,
    fonction: fiche.fonction,
    contactPrincipal: fiche.contactPrincipal,
    peutConsulter: fiche.peutConsulter,
    peutTelecharger: fiche.peutTelecharger,
  };
}

function signerJeton(utilisateurId, email) {
  return jwt.sign({ utilisateurId, email }, config.jwt.secret, {
    subject: String(utilisateurId),
    expiresIn: config.jwt.expiresIn,
    issuer: 'hope-api',
    audience: AUDIENCE,
  });
}

export async function inscrire(corps = {}) {
  const texte = (valeur) => (typeof valeur === 'string' ? valeur.trim() : '');

  const raisonSociale = texte(corps.raisonSociale);
  const typeOrganisation = texte(corps.typeOrganisation).toLowerCase();
  const nom = texte(corps.nom);
  const prenom = texte(corps.prenom);
  const fonction = texte(corps.fonction);
  const email = texte(corps.email).toLowerCase();
  const motDePasse = typeof corps.motDePasse === 'string' ? corps.motDePasse : '';
  const confirmation = typeof corps.confirmation === 'string' ? corps.confirmation : '';

  const details = {};
  if (raisonSociale === '') details.raisonSociale = 'Champ obligatoire';
  if (typeOrganisation === '') details.typeOrganisation = 'Champ obligatoire';
  else if (!TYPES_ORGANISATION.includes(typeOrganisation)) {
    details.typeOrganisation = 'Type d’organisation inconnu';
  }
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

  try {
    const resultat = await transaction(async (client) => {
      const compte = await volunteerRepository.creer(
        { nom, prenom, email, motDePasse: hash, conditionsVersion: VERSION_CONDITIONS },
        ['bailleur'],
        client
      );

      await funderRepository.creerAvecContact(
        {
          raisonSociale,
          typeOrganisation,
          secteur: texte(corps.secteur) || null,
          pays: texte(corps.pays) || 'Madagascar',
          siteWeb: texte(corps.siteWeb) || null,
        },
        compte.id,
        fonction || null,
        client
      );

      await signalerNouveauCompte(
        {
          utilisateurId: compte.id,
          type: 'bailleur',
          email,
          nom: `${prenom} ${nom}`.trim(),
          organisation: raisonSociale,
        },
        client
      );

      const fiche = await funderRepository.trouverParUtilisateur(compte.id, client);
      return {
        ...versBailleurPublic(fiche),
        utilisateurId: compte.id,
        compteStatut: compte.statut,
      };
    });
    await verificationCourriel.envoyerLien({ id: resultat.utilisateurId, email, prenom });
    return resultat;
  } catch (erreur) {
    if (estViolationUnicite(erreur, 'utilisateur_email_key')) {
      throw new ErreurValidation('Cette adresse est déjà utilisée.', {
        email: 'Adresse déjà inscrite',
      });
    }
    throw erreur;
  }
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

  if (!(compte.roles ?? []).includes('bailleur')) {
    throw new ErreurAuthentification(
      'Ce compte n’a pas accès à l’espace bailleur.',
      'ROLE_MANQUANT'
    );
  }

  const fiche = await funderRepository.trouverParUtilisateur(compte.id);
  if (!fiche) {
    throw new ErreurAuthentification(
      'Aucune organisation n’est rattachée à ce compte.',
      'ORGANISATION_MANQUANTE'
    );
  }
  if (!fiche.contactActif) {
    throw new ErreurAuthentification(
      'Votre accès à cette organisation a été désactivé.',
      'CONTACT_INACTIF'
    );
  }

  await volunteerRepository.marquerConnexion(compte.id);

  return {
    token: signerJeton(compte.id, compte.email),
    bailleur: { ...versBailleurPublic(fiche), utilisateurId: compte.id },
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

export async function garantirOrganisation(utilisateurId, compte = {}, client = null) {
  const existante = await funderRepository.trouverParUtilisateur(utilisateurId, client);
  if (existante) return existante;

  const personne = `${compte.prenom ?? ''} ${compte.nom ?? ''}`.trim();
  await funderRepository.creerAvecContact(
    {
      raisonSociale: (personne ? `Organisation de ${personne}` : 'Organisation à préciser').slice(0, 200),
      typeOrganisation: 'autre',
      pays: 'Madagascar',
    },
    utilisateurId,
    null,
    client
  );
  return funderRepository.trouverParUtilisateur(utilisateurId, client);
}

export async function recupererBailleurAuthentifie(utilisateurId) {
  const compte = await volunteerRepository.trouverParId(utilisateurId);
  if (!compte) {
    throw new ErreurAuthentification('Compte introuvable.', 'COMPTE_INTROUVABLE');
  }
  if (compte.statut !== 'actif') {
    throw new ErreurAuthentification('Ce compte n’est plus actif.', 'COMPTE_INACTIF');
  }

  const fiche = await garantirOrganisation(utilisateurId, compte);

  if (!fiche.contactActif) {
    throw new ErreurAuthentification(
      'Votre accès à cette organisation a été désactivé.',
      'CONTACT_INACTIF'
    );
  }

  return {
    ...versBailleurPublic(fiche),
    utilisateurId,
    organisationManquante: false,
    profilComplete: Boolean(compte.profilComplete),
  };
}

export { versBailleurPublic };
