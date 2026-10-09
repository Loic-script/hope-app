export class ErreurApplicative extends Error {
  constructor(message, statut = 500, code = 'ERREUR_SERVEUR') {
    super(message);
    this.name = new.target.name;
    this.statut = statut;
    this.code = code;
  }
}

export class ErreurValidation extends ErreurApplicative {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION');
    this.details = details;
  }
}

export class ErreurAuthentification extends ErreurApplicative {
  constructor(message = 'Identifiants incorrects', code = 'NON_AUTHENTIFIE') {
    super(message, 401, code);
  }
}

export class ErreurIntrouvable extends ErreurApplicative {
  constructor(ressource = 'La ressource', identifiant = null) {
    const precision = identifiant === null ? '' : ` (identifiant ${identifiant})`;
    super(`${ressource} est introuvable${precision}.`, 404, 'INTROUVABLE');
  }
}

export class ErreurRegleMetier extends ErreurApplicative {
  constructor(message, code = 'REGLE_METIER', details = null) {
    super(message, 422, code);
    this.details = details;
  }
}

export function estViolationUnicite(erreur, contrainte = null) {
  if (!erreur || erreur.code !== '23505') return false;
  return contrainte === null || erreur.constraint === contrainte;
}
