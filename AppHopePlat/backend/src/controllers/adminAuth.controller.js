/**
 * Controleurs HTTP de l'authentification administrateur.
 *
 * Role strictement limite : lire la requete, appeler le service, formater la
 * reponse JSON. Aucune regle metier, aucun acces base de donnees ici.
 */
import * as adminAuthService from '../services/adminAuth.service.js';
import { effacerSession, poserSession } from '../shared/session.js';
import * as audit from '../services/audit.service.js';

/**
 * POST /api/admin/login
 * Corps attendu : { adminLog, password }
 */
export async function login(req, res, next) {
  const { adminLog, password } = req.body ?? {};
  try {
    const resultat = await adminAuthService.connecter({ adminLog, password });
    audit.consignerRequete(req, {
      acteurType: 'admin',
      acteurId: resultat.admin.id,
      acteurLibelle: resultat.admin.fullName ?? resultat.admin.adminLog,
      action: 'CONNEXION',
      libelle: 's’est connecté à l’administration',
      statut: 200,
    });

    // La session part dans un cookie httpOnly : JavaScript ne la voit pas.
    poserSession(res, 'admin', resultat.token, { persistant: req.body?.seSouvenir !== false });

    // La reponse ne contient jamais password_hash.
    res.status(200).json({
      success: true,
      message: 'Login success',
      token: resultat.token,
      expiresIn: resultat.expiresIn,
      admin: resultat.admin,
    });
  } catch (erreur) {
    // Une tentative refusee : l'identifiant saisi, jamais le mot de passe.
    if (erreur?.statut === 401) {
      audit.consignerRequete(req, {
        acteurType: 'admin',
        acteurLibelle: typeof adminLog === 'string' ? adminLog.slice(0, 80) : null,
        action: 'CONNEXION_REFUSEE',
        libelle: 'connexion à l’administration refusée',
        statut: 401,
      });
    }
    next(erreur);
  }
}

/**
 * GET /api/admin/me  (protege par authenticateAdmin)
 * Permet au frontend de verifier que le jeton stocke est toujours valable.
 */
export async function me(req, res, next) {
  try {
    const admin = await adminAuthService.recupererAdminAuthentifie(req.admin.id);

    res.status(200).json({
      authenticated: true,
      admin,
    });
  } catch (erreur) {
    next(erreur);
  }
}

/**
 * POST /api/admin/logout  (protege par authenticateAdmin)
 *
 * Le JWT est sans etat : c'est le frontend qui oublie le jeton. Cette route
 * existe pour donner un point d'appel explicite au bouton "Se deconnecter"
 * et pourra plus tard alimenter une liste de revocation ou un journal d'audit.
 */
export async function logout(req, res) {
  effacerSession(res, 'admin');
  res.status(200).json({
    success: true,
    message: 'Deconnexion effectuee.',
  });
}
