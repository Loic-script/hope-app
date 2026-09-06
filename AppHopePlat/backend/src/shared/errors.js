/**
 * Erreurs applicatives HOPE.
 *
 * Une erreur qui herite de ErreurApplicative porte son propre code HTTP :
 * le middleware d'erreur sait alors quoi renvoyer au client. Toute autre
 * erreur est traitee comme une 500 et son detail reste dans les logs.
 */
export class ErreurApplicative extends Error {
  constructor(message, statut = 500, code = 'ERREUR_SERVEUR') {
    super(message);
    this.name = new.target.name;
    this.statut = statut;
    this.code = code;
  }
}

/** 400 : la requete est mal formee (champ manquant, format invalide). */
export class ErreurValidation extends ErreurApplicative {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION');
    this.details = details;
  }
}

/**
 * 401 : identifiants refuses ou jeton invalide.
 *
 * Le message reste volontairement generique pour ne pas reveler si c'est le
 * login ou le mot de passe qui est faux (evite l'enumeration de comptes).
 */
export class ErreurAuthentification extends ErreurApplicative {
  constructor(message = 'Identifiants incorrects', code = 'NON_AUTHENTIFIE') {
    super(message, 401, code);
  }
}

/** 404 : la ressource demandee n'existe pas (ou plus). */
export class ErreurIntrouvable extends ErreurApplicative {
  constructor(ressource = 'La ressource', identifiant = null) {
    const precision = identifiant === null ? '' : ` (identifiant ${identifiant})`;
    super(`${ressource} est introuvable${precision}.`, 404, 'INTROUVABLE');
  }
}

/**
 * 422 : la requete est bien formee mais viole une regle metier HOPE.
 *
 * Exemples : affecter plus que le montant disponible d'un don, enregistrer
 * une depense superieure au budget restant, modifier un projet archive.
 */
export class ErreurRegleMetier extends ErreurApplicative {
  constructor(message, code = 'REGLE_METIER', details = null) {
    super(message, 422, code);
    this.details = details;
  }
}
