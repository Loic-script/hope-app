/**
 * Controleurs HTTP de l'espace benevole.
 *
 * Role strictement limite : lire la requete, appeler le service, formater
 * la reponse. Aucune regle metier, aucun acces base de donnees ici.
 */
import * as volunteerAuthService from '../services/volunteerAuth.service.js';
import { effacerSessionsUtilisateur, poserSession } from '../shared/session.js';

/**
 * POST /api/benevole/inscription
 * Corps attendu : { nom, prenom, email, motDePasse, confirmation }
 *
 * Repond 201 sans jeton : le compte existe, mais il attend l'activation
 * d'un administrateur avant de donner acces a quoi que ce soit.
 */
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

/**
 * POST /api/benevole/login
 * Corps attendu : { email, motDePasse }
 */
export async function login(req, res, next) {
  try {
    const { email, motDePasse } = req.body ?? {};
    const resultat = await volunteerAuthService.connecter({ email, motDePasse });
    effacerSessionsUtilisateur(res);
    poserSession(res, 'benevole', resultat.token, { persistant: req.body?.seSouvenir !== false });

    // La reponse ne contient jamais le hash du mot de passe.
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

/** GET /api/benevole/me  (protege par authenticateVolunteer) */
export async function me(req, res, next) {
  try {
    res.status(200).json({ authenticated: true, benevole: req.benevole });
  } catch (erreur) {
    next(erreur);
  }
}

/**
 * POST /api/benevole/logout  (protege)
 *
 * Le JWT est sans etat : c'est le frontend qui oublie le jeton. La route
 * existe pour donner un point d'appel explicite au bouton, et pourra plus
 * tard alimenter un journal.
 */
export async function logout(_req, res) {
  effacerSessionsUtilisateur(res);
  res.status(200).json({ success: true, message: 'Déconnexion effectuée.' });
}
