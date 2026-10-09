import * as adminAuthService from '../services/adminAuth.service.js';
import { effacerSession, poserSession } from '../shared/session.js';
import * as audit from '../services/audit.service.js';

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

    poserSession(res, 'admin', resultat.token, { persistant: req.body?.seSouvenir !== false });

    res.status(200).json({
      success: true,
      message: 'Login success',
      token: resultat.token,
      expiresIn: resultat.expiresIn,
      admin: resultat.admin,
    });
  } catch (erreur) {
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

export async function logout(req, res) {
  effacerSession(res, 'admin');
  res.status(200).json({
    success: true,
    message: 'Deconnexion effectuee.',
  });
}
