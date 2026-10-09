import bcrypt from 'bcrypt';

import * as adminRepository from '../repositories/admin.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import { config } from '../config/env.js';

import { ErreurIntrouvable, ErreurRegleMetier, ErreurValidation } from '../shared/errors.js';
import { identifiantRequis, texteFacultatif, texteRequis, valeurParmi } from '../shared/validation.js';
import { fermerSessionsAdmin } from './session.service.js';

export const ROLES = ['ADMIN', 'COORDINATOR', 'VIEWER'];
export const STATUTS = ['ACTIVE', 'SUSPENDED'];

export const LIBELLES_ROLES = {
  ADMIN: 'Administrateur',
  COORDINATOR: 'Coordinateur',
  VIEWER: 'Lecture seule',
  GESTIONNAIRE: 'Admin (back office)',
  MANAGER: 'Manager',
};

const LONGUEUR_MINIMALE = 8;

function verifierMotDePasse(valeur, champ) {
  const motDePasse = typeof valeur === 'string' ? valeur : '';
  if (motDePasse.length < LONGUEUR_MINIMALE) {
    throw new ErreurValidation(
      `Le mot de passe doit contenir au moins ${LONGUEUR_MINIMALE} caractères.`,
      { [champ]: `${LONGUEUR_MINIMALE} caractères minimum` }
    );
  }
  return motDePasse;
}

function hasher(motDePasse) {
  return bcrypt.hash(motDePasse, config.admin.saltRounds);
}

export async function lister() {
  return {
    items: await adminRepository.lister(),
    roles: ROLES,
    roleLabels: LIBELLES_ROLES,
    statuses: STATUTS,
  };
}

export async function creer(corps = {}, auteur = null) {
  const adminLog = texteRequis(corps.adminLog, 'adminLog', { max: 100 });
  const fullName = texteRequis(corps.fullName, 'fullName', { max: 160 });
  const role = valeurParmi(corps.role, 'role', ROLES, { defaut: 'COORDINATOR' });
  const motDePasse = verifierMotDePasse(corps.password, 'password');

  if (await adminRepository.existe(adminLog)) {
    throw new ErreurRegleMetier(
      `L’identifiant « ${adminLog} » est déjà pris.`,
      'IDENTIFIANT_EXISTANT'
    );
  }

  const cree = await adminRepository.creer({
    adminLog,
    fullName,
    role,
    passwordHash: await hasher(motDePasse),
  });

  await activityLogRepository.deposer(auteur, {
    action: 'CREATE',
    entityType: 'ADMIN',
    entityId: cree.id,
    label: `a créé le compte « ${fullName} » (${LIBELLES_ROLES[role]})`,
  });

  return cree;
}

export async function mettreAJour(id, corps = {}, auteur = null) {
  const adminId = identifiantRequis(id, 'id');

  const admin = await adminRepository.trouverParId(adminId);
  if (!admin) throw new ErreurIntrouvable('Le compte', adminId);

  const fullName = texteFacultatif(corps.fullName, 'fullName', { max: 160 });
  const role = corps.role ? valeurParmi(corps.role, 'role', ROLES) : null;
  const status = corps.status ? valeurParmi(corps.status, 'status', STATUTS) : null;

  const cestSoi = auteur !== null && auteur.id === adminId;
  if (cestSoi && ((role !== null && role !== admin.role) || status === 'SUSPENDED')) {
    throw new ErreurRegleMetier(
      'Vous ne pouvez pas modifier votre propre rôle ni suspendre votre compte. Demandez à un autre administrateur.',
      'ACTION_SUR_SOI'
    );
  }

  const perdSonRoleAdmin = admin.role === 'ADMIN' && ((role && role !== 'ADMIN') || status === 'SUSPENDED');
  if (perdSonRoleAdmin && (await adminRepository.compterAdministrateursActifs(adminId)) === 0) {
    throw new ErreurRegleMetier(
      'C’est le dernier administrateur actif : nommez-en un autre avant de modifier celui-ci.',
      'DERNIER_ADMINISTRATEUR'
    );
  }

  const misAJour = await adminRepository.mettreAJour(adminId, { fullName, role, status });

  const changements = [
    fullName && fullName !== admin.fullName ? `nom → « ${fullName} »` : null,
    role && role !== admin.role ? `rôle → ${LIBELLES_ROLES[role]}` : null,
    status && status !== admin.status
      ? status === 'SUSPENDED'
        ? 'compte suspendu'
        : 'compte réactivé'
      : null,
  ].filter(Boolean);

  if (changements.length > 0) {
    await activityLogRepository.deposer(auteur, {
      action: 'UPDATE',
      entityType: 'ADMIN',
      entityId: adminId,
      label: `a modifié le compte « ${admin.fullName} » : ${changements.join(', ')}`,
    });
  }

  return misAJour;
}

export async function reinitialiserMotDePasse(id, corps = {}, auteur = null) {
  const adminId = identifiantRequis(id, 'id');

  const admin = await adminRepository.trouverParId(adminId);
  if (!admin) throw new ErreurIntrouvable('Le compte', adminId);

  const motDePasse = verifierMotDePasse(corps.password, 'password');
  await adminRepository.mettreAJourMotDePasse(adminId, await hasher(motDePasse));

  await activityLogRepository.deposer(auteur, {
    action: 'RESET_PASSWORD',
    entityType: 'ADMIN',
    entityId: adminId,
    label: `a réinitialisé le mot de passe de « ${admin.fullName} »`,
  });

  return { id: adminId, updated: true };
}

export async function changerSaPhoto(adminId, corps = {}) {
  const valeur = corps.photoUrl;
  let photo = null;

  if (valeur !== null && String(valeur ?? '').trim() !== '') {
    photo = String(valeur).trim();
    if (!photo.startsWith('/media/')) {
      throw new ErreurValidation('La photo doit être téléversée depuis votre espace.', {
        photoUrl: 'Adresse non acceptée',
      });
    }
  }

  await adminRepository.mettreAJourPhoto(adminId, photo);
  return { success: true, photoUrl: photo };
}

export async function changerSonMotDePasse(admin, corps = {}) {
  const actuel = typeof corps.currentPassword === 'string' ? corps.currentPassword : '';
  const nouveau = verifierMotDePasse(corps.newPassword, 'newPassword');

  const complet = await adminRepository.trouverParLogin(admin.adminLog);
  if (!complet) throw new ErreurIntrouvable('Le compte', admin.id);

  if (!(await bcrypt.compare(actuel, complet.passwordHash))) {
    throw new ErreurValidation('Le mot de passe actuel est incorrect.', {
      currentPassword: 'Mot de passe incorrect',
    });
  }

  if (actuel === nouveau) {
    throw new ErreurValidation('Le nouveau mot de passe doit être différent de l’actuel.', {
      newPassword: 'Identique à l’actuel',
    });
  }

  await adminRepository.mettreAJourMotDePasse(complet.id, await hasher(nouveau));
  await fermerSessionsAdmin(complet.id);

  await activityLogRepository.deposer(admin, {
    action: 'CHANGE_PASSWORD',
    entityType: 'ADMIN',
    entityId: complet.id,
    label: 'a changé son mot de passe',
  });

  return { id: complet.id, updated: true };
}

export async function journal(requete = {}) {
  const items = await activityLogRepository.lister({
    limite: Math.min(Number.parseInt(requete.limit ?? '30', 10) || 30, 200),
  });
  return { items };
}
