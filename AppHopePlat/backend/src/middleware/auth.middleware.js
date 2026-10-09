import * as adminAuthService from '../services/adminAuth.service.js';
import * as adminRepository from '../repositories/admin.repository.js';
import { ErreurAuthentification, ErreurRegleMetier } from '../shared/errors.js';
import { lireJeton } from '../shared/session.js';
import { exigerSessionFraicheAdmin } from '../services/session.service.js';

export async function authenticateAdmin(req, _res, next) {
  try {
    const jeton = lireJeton(req, 'admin');
    if (!jeton) {
      throw new ErreurAuthentification('Jeton d\'authentification manquant.', 'JETON_MANQUANT');
    }

    const charge = adminAuthService.verifierJeton(jeton);

    const admin = await adminRepository.trouverParId(charge.adminId);
    if (!admin) {
      throw new ErreurAuthentification('Ce compte n\'existe plus.', 'COMPTE_INTROUVABLE');
    }
    if (admin.status === 'SUSPENDED') {
      throw new ErreurAuthentification('Ce compte est suspendu.', 'COMPTE_SUSPENDU');
    }
    await exigerSessionFraicheAdmin(admin.id, charge);

    req.admin = {
      id: admin.id,
      adminLog: admin.adminLog,
      fullName: admin.fullName ?? admin.adminLog,
      role: admin.role,
    };

    next();
  } catch (erreur) {
    next(erreur);
  }
}

export function exigerRole(...roles) {
  return function verifier(req, _res, next) {
    if (!req.admin) {
      next(new ErreurAuthentification('Authentification requise.', 'NON_AUTHENTIFIE'));
      return;
    }

    if (!roles.includes(req.admin.role)) {
      const erreur = new ErreurRegleMetier(
        'Votre rôle ne permet pas cette action.',
        'DROIT_INSUFFISANT',
        { role: req.admin.role, rolesAutorises: roles }
      );
      erreur.statut = 403;
      next(erreur);
      return;
    }

    next();
  };
}

export const exigerEcriture = exigerRole('ADMIN', 'COORDINATOR', 'GESTIONNAIRE');

const ECRITURES_MANAGER = [
  ['POST', /^\/projects$/],
  ['POST', /^\/projects\/media$/],
  ['PATCH', /^\/projects\/\d+$/],
];
const LECTURES_INTERDITES_MANAGER = [/^\/utilisateurs/, /^\/team/, /^\/backoffice/, /^\/audit/, /^\/consulter/];

function refus(req) {
  const erreur = new ErreurRegleMetier('Votre rôle ne permet pas cette action.', 'DROIT_INSUFFISANT', {
    role: req.admin?.role,
  });
  erreur.statut = 403;
  return erreur;
}

export function verrouEcriture(req, res, suite) {
  const lecture = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (req.admin?.role === 'MANAGER') {
    if (lecture) {
      return LECTURES_INTERDITES_MANAGER.some((motif) => motif.test(req.path)) ? suite(refus(req)) : suite();
    }
    return ECRITURES_MANAGER.some(([methode, motif]) => methode === req.method && motif.test(req.path))
      ? suite()
      : suite(refus(req));
  }
  if (lecture) return suite();
  return exigerEcriture(req, res, suite);
}
