import * as espaceService from '../services/espace.service.js';
import * as compteService from '../services/compte.service.js';
import { jetonNeuf } from '../services/auth.service.js';
import { AUDIENCE_PAR_TYPE } from '../shared/audiences.js';
import { effacerSessionsUtilisateur, poserSession } from '../shared/session.js';
import * as verificationCourriel from '../services/verificationCourriel.service.js';
import * as audit from '../services/audit.service.js';
import * as reactions from '../services/reactionsActualite.service.js';

function typeDeLAudience(audience) {
  return Object.keys(AUDIENCE_PAR_TYPE).find((type) => AUDIENCE_PAR_TYPE[type] === audience) ?? null;
}

export async function listerNotifications(req, res, next) {
  try {
    const items = await espaceService.listerNotifications(req.utilisateurId);
    res.status(200).json({ items });
  } catch (erreur) {
    next(erreur);
  }
}

export async function marquerLue(req, res, next) {
  try {
    const resultat = await espaceService.marquerLue(req.utilisateurId, req.params.id);
    res.status(200).json({ success: true, ...resultat });
  } catch (erreur) {
    next(erreur);
  }
}

export async function marquerToutLu(req, res, next) {
  try {
    const resultat = await espaceService.marquerToutLu(req.utilisateurId);
    res.status(200).json({ success: true, ...resultat });
  } catch (erreur) {
    next(erreur);
  }
}

export async function listerMessages(req, res, next) {
  try {
    const items = await espaceService.listerMessages(req.utilisateurId);
    await espaceService.marquerReponsesLues(req.utilisateurId);
    res.status(200).json({ items });
  } catch (erreur) {
    next(erreur);
  }
}

export async function envoyerMessage(req, res, next) {
  try {
    const message = await espaceService.envoyerMessage(req.utilisateurId, req.body ?? {});
    res.status(201).json({ success: true, message });
  } catch (erreur) {
    next(erreur);
  }
}

export async function repondre(req, res, next) {
  try {
    const entree = await espaceService.repondre(
      req.utilisateurId,
      req.params.id,
      req.body ?? {}
    );
    res.status(201).json({ success: true, entree });
  } catch (erreur) {
    next(erreur);
  }
}

export async function badges(req, res, next) {
  try {
    res.status(200).json(await espaceService.compteurs(req.utilisateurId, req.espace));
  } catch (erreur) {
    next(erreur);
  }
}

export async function changerMotDePasse(req, res, next) {
  try {
    const resultat = await compteService.changerMotDePasse(req.utilisateurId, req.body ?? {});
    audit.consignerRequete(req, {
      acteurType: 'utilisateur',
      acteurId: req.utilisateurId,
      action: 'MOT_DE_PASSE',
      libelle: 'a changé son mot de passe (autres sessions fermées)',
      statut: 200,
    });
    const type = typeDeLAudience(req.espace);
    if (type) poserSession(res, type, await jetonNeuf(req.utilisateurId, type));
    res.status(200).json(resultat);
  } catch (erreur) {
    next(erreur);
  }
}

export async function supprimerCompte(req, res, next) {
  try {
    const resultat = await compteService.supprimerSonCompte(req.utilisateurId, req.body ?? {});
    audit.consignerRequete(req, {
      acteurType: 'utilisateur',
      acteurId: req.utilisateurId,
      action: 'SUPPRESSION_COMPTE',
      libelle: 'a supprimé son compte',
      statut: 200,
    });
    effacerSessionsUtilisateur(res);
    res.status(200).json(resultat);
  } catch (erreur) {
    next(erreur);
  }
}

export async function etatCompte(req, res, next) {
  try {
    res.status(200).json(await verificationCourriel.etat(req.utilisateurId));
  } catch (erreur) {
    next(erreur);
  }
}

export async function renvoyerVerification(req, res, next) {
  try {
    res.status(200).json(await verificationCourriel.renvoyer(req.utilisateurId));
  } catch (erreur) {
    next(erreur);
  }
}

export async function reactionsActualites(req, res, next) {
  try {
    res.status(200).json(await reactions.etat(req.utilisateurId, req.query.ids));
  } catch (erreur) {
    next(erreur);
  }
}

export async function jaimerActualite(req, res, next) {
  try {
    res.status(200).json(await reactions.basculerJaime(req.utilisateurId, req.params.id));
  } catch (erreur) {
    next(erreur);
  }
}

export async function commenterActualite(req, res, next) {
  try {
    res.status(201).json(await reactions.commenter(req.utilisateurId, req.espace, req.params.id, req.body ?? {}));
  } catch (erreur) {
    next(erreur);
  }
}
