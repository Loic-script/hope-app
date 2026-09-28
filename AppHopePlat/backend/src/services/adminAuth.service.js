/**
 * Service d'authentification de l'administrateur HOPE.
 *
 * Contient toute la regle metier de la connexion :
 *   verification des champs -> recherche en base -> comparaison bcrypt -> JWT.
 * Il ne connait ni Express (pas de req/res) ni SQL (il passe par le repository).
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { config } from '../config/env.js';
import * as adminRepository from '../repositories/admin.repository.js';
import { ErreurAuthentification, ErreurValidation } from '../shared/errors.js';

/**
 * Hash bcrypt factice, compare lorsque l'identifiant n'existe pas.
 *
 * Sans cela, un login inconnu repondrait beaucoup plus vite qu'un login connu
 * avec un mauvais mot de passe : l'ecart de temps permettrait de deviner quels
 * comptes existent. On paie donc toujours le meme cout de calcul.
 */
const HASH_FACTICE = bcrypt.hashSync('hash-factice-anti-timing-attack', 10);

/**
 * Retire le hash d'un administrateur avant toute sortie vers le client HTTP.
 * password_hash ne doit jamais quitter le backend.
 */
function versAdminPublic(admin) {
  return {
    id: admin.id,
    adminLog: admin.adminLog,
    fullName: admin.fullName ?? admin.adminLog,
    role: admin.role,
    photoUrl: admin.photoUrl ?? null,
  };
}

/** Construit le JWT porte par le frontend a chaque appel protege. */
function signerJeton(admin) {
  return jwt.sign(
    {
      adminId: admin.id,
      adminLog: admin.adminLog,
    },
    config.jwt.secret,
    {
      subject: String(admin.id),
      expiresIn: config.jwt.expiresIn,
      issuer: 'hope-api',
      audience: 'hope-admin',
    }
  );
}

/**
 * Connecte un administrateur.
 *
 * @param {{ adminLog?: unknown, password?: unknown }} identifiants
 * @returns {Promise<{ token: string, admin: { id: number, adminLog: string }, expiresIn: string }>}
 * @throws {ErreurValidation} si un champ est absent ou mal forme
 * @throws {ErreurAuthentification} si le couple login / mot de passe est refuse
 */
export async function connecter({ adminLog, password } = {}) {
  // 1. Les deux champs doivent etre presents et non vides.
  const login = typeof adminLog === 'string' ? adminLog.trim() : '';
  const motDePasse = typeof password === 'string' ? password : '';

  if (login === '' || motDePasse === '') {
    throw new ErreurValidation('Le login et le mot de passe sont obligatoires.', {
      adminLog: login === '' ? 'Champ obligatoire' : undefined,
      password: motDePasse === '' ? 'Champ obligatoire' : undefined,
    });
  }

  // 2. Recherche de l'administrateur dans PostgreSQL.
  const admin = await adminRepository.trouverParLogin(login);

  // 3. Comparaison bcrypt. Le meme message generique est renvoye dans les deux
  //    cas d'echec (compte inconnu ou mot de passe faux).
  const hash = admin ? admin.passwordHash : HASH_FACTICE;
  const motDePasseValide = await bcrypt.compare(motDePasse, hash);

  if (!admin || !motDePasseValide) {
    throw new ErreurAuthentification('Identifiants incorrects');
  }

  // 4. Un compte suspendu ne se connecte plus. Le controle vient APRES la
  //    verification du mot de passe : refuser plus tot revelerait, par le
  //    seul message d'erreur, qu'un identifiant existe.
  if (admin.status === 'SUSPENDED') {
    throw new ErreurAuthentification(
      'Ce compte est suspendu. Contactez un administrateur.',
      'COMPTE_SUSPENDU'
    );
  }

  await adminRepository.marquerConnexion(admin.id);

  // 5. Emission du jeton.
  return {
    token: signerJeton(admin),
    admin: versAdminPublic(admin),
    expiresIn: config.jwt.expiresIn,
  };
}

/**
 * Verifie un JWT et retourne sa charge utile.
 * @throws {ErreurAuthentification} si le jeton est expire, altere ou invalide.
 */
export function verifierJeton(token) {
  try {
    return jwt.verify(token, config.jwt.secret, {
      issuer: 'hope-api',
      audience: 'hope-admin',
    });
  } catch (erreur) {
    if (erreur.name === 'TokenExpiredError') {
      throw new ErreurAuthentification('Session expiree, veuillez vous reconnecter.', 'JETON_EXPIRE');
    }
    throw new ErreurAuthentification('Jeton invalide.', 'JETON_INVALIDE');
  }
}

/**
 * Recharge l'administrateur depuis la base a partir du jeton.
 *
 * On ne fait pas confiance au seul contenu du JWT : le compte a pu etre
 * supprime depuis son emission.
 */
export async function recupererAdminAuthentifie(adminId) {
  const admin = await adminRepository.trouverParId(adminId);
  if (!admin) {
    throw new ErreurAuthentification('Compte administrateur introuvable.', 'COMPTE_INTROUVABLE');
  }
  return versAdminPublic(admin);
}

/** Un jeton neuf pour un administrateur, apres un changement de mot de passe. */
export async function jetonNeuf(adminId) {
  const admin = await adminRepository.trouverParId(adminId);
  if (!admin) throw new ErreurAuthentification('Compte administrateur introuvable.', 'COMPTE_INTROUVABLE');
  return signerJeton(admin);
}

/** Hash un mot de passe en clair (utilise par le seed). */
export function hasherMotDePasse(motDePasseEnClair) {
  return bcrypt.hash(motDePasseEnClair, config.admin.saltRounds);
}
