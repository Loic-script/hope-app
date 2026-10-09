import { ErreurValidation } from './errors.js';

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

export function identifiantRequis(valeur, champ) {
  const texte = String(valeur ?? '').trim();
  const nombre = /^\d{1,15}$/.test(texte) ? Number(texte) : Number.NaN;
  if (!Number.isSafeInteger(nombre) || nombre <= 0) {
    throw new ErreurValidation(`Le champ "${champ}" doit etre un identifiant valide.`, {
      [champ]: 'Identifiant invalide',
    });
  }
  return nombre;
}

export function identifiantFacultatif(valeur, champ) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  return identifiantRequis(valeur, champ);
}

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

export function dateRequise(valeur, champ, { defautAujourdhui = false } = {}) {
  const date = dateFacultative(valeur, champ);
  if (date) return date;
  if (defautAujourdhui) return new Date().toISOString().slice(0, 10);
  throw new ErreurValidation(`Le champ "${champ}" est obligatoire.`, { [champ]: 'Champ obligatoire' });
}

export function verifierPeriode(debut, fin, champDebut = 'start_date', champFin = 'end_date') {
  if (debut && fin && fin < debut) {
    throw new ErreurValidation(
      'La date de fin ne peut pas etre anterieure a la date de debut.',
      { [champFin]: `Doit suivre ${champDebut}` }
    );
  }
}

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

export function pagination(requete = {}) {
  const page = Math.max(1, Number.parseInt(requete.page ?? '1', 10) || 1);
  const taille = Math.min(200, Math.max(1, Number.parseInt(requete.pageSize ?? '50', 10) || 50));
  return { page, taille, decalage: (page - 1) * taille };
}
