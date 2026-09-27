/**
 * Controleurs de l'authentification unifiee.
 *
 * Lecture de la requete, appel du service, formatage : aucune regle
 * metier ici.
 */
import * as authService from '../services/auth.service.js';
import * as motDePasseService from '../services/motDePasse.service.js';
import { LIBELLES_TYPE, TYPES_UTILISATEUR } from '../shared/audiences.js';
import { effacerSessionsUtilisateur, poserSession } from '../shared/session.js';

/**
 * GET /api/auth/types
 *
 * Les trois types proposes dans la liste du formulaire. Servis par
 * l'API plutot qu'ecrits en dur dans le frontend : un type ajoute ne
 * doit pas demander deux modifications.
 */
export async function types(_req, res) {
  res.status(200).json({
    items: TYPES_UTILISATEUR.map((cle) => ({
      cle,
      libelle: LIBELLES_TYPE[cle],
      // Le formulaire previent avant l'envoi que l'acces attendra.
      validationRequise: cle !== 'donateur',
    })),
  });
}

/**
 * POST /api/auth/inscription
 *
 * Repond 201. Un donateur peut se connecter aussitot ; un bailleur
 * attend la validation de HOPE, et c'est l'ecran de connexion qui prend
 * la suite.
 *
 * Un benevole, lui, enchaine sur sa fiche : la reponse porte alors un
 * jeton limite a ce seul formulaire, et l'adresse ou aller. Son compte
 * attend toujours la validation -- la fiche sert justement a decider.
 */
export async function inscription(req, res, next) {
  try {
    const resultat = await authService.inscrire(req.body ?? {});
    // Le benevole enchaine sur sa fiche : son jeton limite part en cookie.
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

/**
 * POST /api/auth/login
 *
 * La reponse porte de quoi router : l'espace du type, et s'il reste un
 * formulaire de completion a remplir.
 */
export async function login(req, res, next) {
  try {
    const { email, motDePasse, typeUtilisateur } = req.body ?? {};
    const resultat = await authService.connecter({ email, motDePasse, typeUtilisateur });
    // Une seule session d'utilisateur a la fois : les autres sont effacees.
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

/** POST /api/auth/mot-de-passe-oublie : toujours la meme reponse. */
export async function motDePasseOublie(req, res, next) {
  try {
    res.status(200).json(await motDePasseService.demander(req.body));
  } catch (erreur) {
    next(erreur);
  }
}

/** POST /api/auth/reinitialiser-mot-de-passe : le jeton du lien, et le nouveau mot de passe. */
export async function reinitialiserMotDePasse(req, res, next) {
  try {
    res.status(200).json(await motDePasseService.reinitialiser(req.body));
  } catch (erreur) {
    next(erreur);
  }
}

/**
 * POST /api/auth/logout : efface la session d'utilisateur, quelle
 * qu'elle soit. Public : un cookie expire doit pouvoir s'effacer aussi.
 */
export function logout(_req, res) {
  effacerSessionsUtilisateur(res);
  res.status(200).json({ success: true, message: 'Déconnexion effectuée.' });
}
