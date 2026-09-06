/**
 * Petites fonctions de validation partagees par les services.
 *
 * Le frontend valide aussi de son cote, mais le backend reste la source de
 * verite : aucune ecriture ne se fait sans etre passee par ces controles.
 */
import { ErreurValidation } from './errors.js';

/**
 * Chaine obligatoire, nettoyee des espaces de bord.
 * @throws {ErreurValidation}
 */
export function texteRequis(valeur, champ, { max = 255 } = {}) {
  const texte = typeof valeur === 'string' ? valeur.trim() : '';
  if (texte === '') {
    throw new ErreurValidation(`Le champ "${champ}" est obligatoire.`, { [champ]: 'Champ obligatoire' });
  }
  if (texte.length > max) {
    throw new ErreurValidation(`Le champ "${champ}" ne doit pas depasser ${max} caracteres.`, {
      [champ]: `Maximum ${max} caracteres`,
    });
  }
  return texte;
}

/** Chaine facultative : retourne null si vide. */
export function texteFacultatif(valeur, champ, { max = 2000 } = {}) {
  if (valeur === null || valeur === undefined) return null;
  const texte = String(valeur).trim();
  if (texte === '') return null;
  if (texte.length > max) {
    throw new ErreurValidation(`Le champ "${champ}" ne doit pas depasser ${max} caracteres.`, {
      [champ]: `Maximum ${max} caracteres`,
    });
  }
  return texte;
}

/** Valeur appartenant obligatoirement a une liste fermee. */
export function valeurParmi(valeur, champ, valeursAutorisees, { defaut } = {}) {
  if ((valeur === null || valeur === undefined || valeur === '') && defaut !== undefined) {
    return defaut;
  }
  const texte = String(valeur ?? '').trim().toUpperCase();
  if (!valeursAutorisees.includes(texte)) {
    throw new ErreurValidation(
      `Le champ "${champ}" doit valoir : ${valeursAutorisees.join(', ')}.`,
      { [champ]: 'Valeur non autorisee' }
    );
  }
  return texte;
}

/** Identifiant entier strictement positif. */
export function identifiantRequis(valeur, champ) {
  const nombre = Number.parseInt(valeur, 10);
  if (!Number.isInteger(nombre) || nombre <= 0) {
    throw new ErreurValidation(`Le champ "${champ}" doit etre un identifiant valide.`, {
      [champ]: 'Identifiant invalide',
    });
  }
  return nombre;
}

/** Identifiant facultatif : null si absent. */
export function identifiantFacultatif(valeur, champ) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  return identifiantRequis(valeur, champ);
}

/**
 * Date au format ISO (AAAA-MM-JJ). Retourne null si absente.
 * @throws {ErreurValidation} si la date est mal formee
 */
export function dateFacultative(valeur, champ) {
  if (valeur === null || valeur === undefined || valeur === '') return null;

  const texte = String(valeur).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte)) {
    throw new ErreurValidation(`Le champ "${champ}" doit etre une date au format AAAA-MM-JJ.`, {
      [champ]: 'Date invalide',
    });
  }

  const date = new Date(`${texte}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new ErreurValidation(`Le champ "${champ}" n'est pas une date reelle.`, {
      [champ]: 'Date invalide',
    });
  }
  return texte;
}

/** Date obligatoire, avec valeur de repli sur aujourd'hui si demande. */
export function dateRequise(valeur, champ, { defautAujourdhui = false } = {}) {
  const date = dateFacultative(valeur, champ);
  if (date) return date;
  if (defautAujourdhui) return new Date().toISOString().slice(0, 10);
  throw new ErreurValidation(`Le champ "${champ}" est obligatoire.`, { [champ]: 'Champ obligatoire' });
}

/** Verifie que la date de fin ne precede pas la date de debut. */
export function verifierPeriode(debut, fin, champDebut = 'start_date', champFin = 'end_date') {
  if (debut && fin && fin < debut) {
    throw new ErreurValidation(
      'La date de fin ne peut pas etre anterieure a la date de debut.',
      { [champFin]: `Doit suivre ${champDebut}` }
    );
  }
}

/** Nombre decimal quelconque (valeur d'un indicateur d'impact, par exemple). */
export function nombreRequis(valeur, champ) {
  if (valeur === null || valeur === undefined || valeur === '') {
    throw new ErreurValidation(`Le champ "${champ}" est obligatoire.`, { [champ]: 'Champ obligatoire' });
  }
  const nombre = Number(String(valeur).replace(',', '.'));
  if (!Number.isFinite(nombre)) {
    throw new ErreurValidation(`Le champ "${champ}" doit etre un nombre.`, { [champ]: 'Nombre invalide' });
  }
  return nombre;
}

/** Numero de page et taille de page pour les listes. */
export function pagination(requete = {}) {
  const page = Math.max(1, Number.parseInt(requete.page ?? '1', 10) || 1);
  const taille = Math.min(200, Math.max(1, Number.parseInt(requete.pageSize ?? '50', 10) || 50));
  return { page, taille, decalage: (page - 1) * taille };
}
