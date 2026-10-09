import * as volunteerAuthService from '../services/volunteerAuth.service.js';
import { effacerSessionsUtilisateur, poserSession } from '../shared/session.js';

export async function inscription(req, res, next) {
  try {
    const benevole = await volunteerAuthService.inscrire(req.body ?? {});

    res.status(201).json({
      success: true,
      message:
        'Votre inscription est enregistrée. Un administrateur doit activer votre compte avant que vous puissiez vous connecter.',
      benevole,
    });
  } catch (erreur) {
    next(erreur);
  }
}

export async function login(req, res, next) {
  try {
    const { email, motDePasse } = req.body ?? {};
    const resultat = await volunteerAuthService.connecter({ email, motDePasse });
    effacerSessionsUtilisateur(res);
    poserSession(res, 'benevole', resultat.token, { persistant: req.body?.seSouvenir !== false });

    res.status(200).json({
      success: true,
      message: 'Connexion réussie',
      token: resultat.token,
      expiresIn: resultat.expiresIn,
      benevole: resultat.benevole,
    });
  } catch (erreur) {
    next(erreur);
  }
}

export async function me(req, res, next) {
  try {
    res.status(200).json({ authenticated: true, benevole: req.benevole });
  } catch (erreur) {
    next(erreur);
  }
}

export async function logout(_req, res) {
  effacerSessionsUtilisateur(res);
  res.status(200).json({ success: true, message: 'Déconnexion effectuée.' });
}
