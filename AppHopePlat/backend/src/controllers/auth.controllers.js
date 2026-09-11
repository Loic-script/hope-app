/**
 * Controleurs de l'authentification unifiee.
 *
 * Lecture de la requete, appel du service, formatage : aucune regle
 * metier ici.
 */
import * as authService from '../services/auth.service.js';
import { LIBELLES_TYPE, TYPES_UTILISATEUR } from '../shared/audiences.js';

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
 * Repond 201 sans jeton. Un donateur peut se connecter aussitot, un
 * benevole ou un bailleur attend la validation de HOPE : dans les deux
 * cas c'est l'ecran de connexion qui prend la suite.
 */
export async function inscription(req, res, next) {
  try {
    const resultat = await authService.inscrire(req.body ?? {});

    res.status(201).json({
      success: true,
      message: resultat.aValider
        ? 'Votre inscription est enregistrée. L’équipe HOPE validera votre compte avant votre première connexion.'
        : 'Votre compte est créé. Vous pouvez vous connecter dès maintenant.',
      aValider: resultat.aValider,
      utilisateur: resultat.utilisateur,
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
    const { email, motDePasse } = req.body ?? {};
    const resultat = await authService.connecter({ email, motDePasse });

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
