import * as authService from '../services/auth.service.js';
import * as motDePasseService from '../services/motDePasse.service.js';
import { LIBELLES_TYPE, TYPES_UTILISATEUR } from '../shared/audiences.js';
import { effacerSessionsUtilisateur, poserSession } from '../shared/session.js';
import * as verificationCourriel from '../services/verificationCourriel.service.js';

export async function types(_req, res) {
  res.status(200).json({
    items: TYPES_UTILISATEUR.map((cle) => ({
      cle,
      libelle: LIBELLES_TYPE[cle],
      validationRequise: cle !== 'donateur',
    })),
  });
}

export async function inscription(req, res, next) {
  try {
    const resultat = await authService.inscrire(req.body ?? {});
    if (resultat.jetonCompletion) poserSession(res, 'benevole', resultat.jetonCompletion, { persistant: false });

    res.status(201).json({
      success: true,
      message: resultat.jetonCompletion
        ? 'Votre compte est créé. Complétez votre fiche : l’équipe HOPE l’examinera pour activer votre accès.'
        : resultat.aValider
          ? 'Votre inscription est enregistrée. L’équipe HOPE validera votre compte avant votre première connexion.'
          : 'Votre compte est créé. Vous pouvez vous connecter dès maintenant.',
      aValider: resultat.aValider,
      utilisateur: resultat.utilisateur,
      ...(resultat.jetonCompletion
        ? { jetonCompletion: resultat.jetonCompletion, aCompleter: resultat.aCompleter }
        : {}),
    });
  } catch (erreur) {
    next(erreur);
  }
}

export async function login(req, res, next) {
  try {
    const { email, motDePasse, typeUtilisateur } = req.body ?? {};
    const resultat = await authService.connecter({ email, motDePasse, typeUtilisateur });
    effacerSessionsUtilisateur(res);
    poserSession(res, resultat.type, resultat.token, { persistant: req.body?.seSouvenir !== false });

    res.status(200).json({
      success: true,
      message: 'Connexion réussie',
      token: resultat.token,
      expiresIn: resultat.expiresIn,
      utilisateur: resultat.utilisateur,
      type: resultat.type,
      espace: resultat.espace,
      profilComplete: resultat.profilComplete,
      completionRequise: resultat.completionRequise,
    });
  } catch (erreur) {
    next(erreur);
  }
}

export async function motDePasseOublie(req, res, next) {
  try {
    res.status(200).json(await motDePasseService.demander(req.body));
  } catch (erreur) {
    next(erreur);
  }
}

export async function reinitialiserMotDePasse(req, res, next) {
  try {
    res.status(200).json(await motDePasseService.reinitialiser(req.body));
  } catch (erreur) {
    next(erreur);
  }
}

export function logout(_req, res) {
  effacerSessionsUtilisateur(res);
  res.status(200).json({ success: true, message: 'Déconnexion effectuée.' });
}

export async function verifierCourriel(req, res, next) {
  try {
    res.status(200).json(await verificationCourriel.verifier(req.body ?? {}));
  } catch (erreur) {
    next(erreur);
  }
}
