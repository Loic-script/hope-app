import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { config } from '../config/env.js';
import * as adminRepository from '../repositories/admin.repository.js';
import { ErreurAuthentification, ErreurValidation } from '../shared/errors.js';

const HASH_FACTICE = bcrypt.hashSync('hash-factice-anti-timing-attack', 10);

function versAdminPublic(admin) {
  return {
    id: admin.id,
    adminLog: admin.adminLog,
    fullName: admin.fullName ?? admin.adminLog,
    role: admin.role,
    photoUrl: admin.photoUrl ?? null,
  };
}

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

export async function connecter({ adminLog, password } = {}) {
  const login = typeof adminLog === 'string' ? adminLog.trim() : '';
  const motDePasse = typeof password === 'string' ? password : '';

  if (login === '' || motDePasse === '') {
    throw new ErreurValidation('Le login et le mot de passe sont obligatoires.', {
      adminLog: login === '' ? 'Champ obligatoire' : undefined,
      password: motDePasse === '' ? 'Champ obligatoire' : undefined,
    });
  }

  const admin = await adminRepository.trouverParLogin(login);

  const hash = admin ? admin.passwordHash : HASH_FACTICE;
  const motDePasseValide = await bcrypt.compare(motDePasse, hash);

  if (!admin || !motDePasseValide) {
    throw new ErreurAuthentification('Identifiants incorrects');
  }

  if (admin.status === 'SUSPENDED') {
    throw new ErreurAuthentification(
      'Ce compte est suspendu. Contactez un administrateur.',
      'COMPTE_SUSPENDU'
    );
  }

  await adminRepository.marquerConnexion(admin.id);

  return {
    token: signerJeton(admin),
    admin: versAdminPublic(admin),
    expiresIn: config.jwt.expiresIn,
  };
}

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

export async function recupererAdminAuthentifie(adminId) {
  const admin = await adminRepository.trouverParId(adminId);
  if (!admin) {
    throw new ErreurAuthentification('Compte administrateur introuvable.', 'COMPTE_INTROUVABLE');
  }
  return versAdminPublic(admin);
}

export async function jetonNeuf(adminId) {
  const admin = await adminRepository.trouverParId(adminId);
  if (!admin) throw new ErreurAuthentification('Compte administrateur introuvable.', 'COMPTE_INTROUVABLE');
  return signerJeton(admin);
}

export function hasherMotDePasse(motDePasseEnClair) {
  return bcrypt.hash(motDePasseEnClair, config.admin.saltRounds);
}
