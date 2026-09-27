/**
 * Middleware de protection des routes de l'espace administrateur.
 *
 * Lit l'en-tete "Authorization: Bearer <jwt>", verifie la signature et
 * l'expiration, RECHARGE le compte depuis PostgreSQL, puis depose
 * l'identite dans req.admin pour la suite de la chaine.
 *
 * Pourquoi recharger a chaque appel plutot que se fier au jeton ?
 * Un JWT est fige jusqu'a son expiration -- deux heures ici. Sans ce
 * rechargement, un compte suspendu continuerait de travailler pendant
 * deux heures, et un changement de role ne prendrait effet qu'a la
 * reconnexion. Le cout est une lecture par cle primaire par requete.
 */
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

    // Le jeton est valable, mais le compte existe-t-il encore ?
    const admin = await adminRepository.trouverParId(charge.adminId);
    if (!admin) {
      throw new ErreurAuthentification('Ce compte n\'existe plus.', 'COMPTE_INTROUVABLE');
    }
    if (admin.status === 'SUSPENDED') {
      throw new ErreurAuthentification('Ce compte est suspendu.', 'COMPTE_SUSPENDU');
    }
    // Un mot de passe change ferme les sessions ouvertes avant.
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

/**
 * Restreint une route a certains roles.
 *
 *   router.post('/investments', exigerRole('ADMIN'), fund.investir);
 *
 * A monter apres authenticateAdmin, qui remplit req.admin.
 *
 * Le refus est un 403 et non un 401 : l'utilisateur est bien authentifie,
 * c'est son role qui ne suffit pas. Un 401 ferait deconnecter le
 * frontend, ce qui serait deroutant pour un simple manque de droit.
 */
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

/** Tout le monde sauf la lecture seule. */
export const exigerEcriture = exigerRole('ADMIN', 'COORDINATOR');
