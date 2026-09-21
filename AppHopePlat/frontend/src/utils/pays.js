/**
 * Les pays, leur nom en francais et leur indicatif telephonique.
 *
 * La liste et les indicatifs viennent de libphonenumber-js : tenir a la
 * main deux cents indicatifs, c'est en laisser un faux quelque part. Les
 * noms viennent du navigateur (Intl.DisplayNames), en francais.
 *
 * Madagascar ouvre la liste : la plupart des donateurs y vivent, et on
 * ne fait pas defiler deux cents lignes pour le trouver.
 */
import { getCountries, getCountryCallingCode } from 'libphonenumber-js';

export const PAYS_PAR_DEFAUT = 'MG';

const noms =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['fr'], { type: 'region' })
    : null;

/** "MG" -> "Madagascar". Le code lui-meme si le navigateur ne sait pas. */
export function nomDuPays(code) {
  if (!code) return '';
  try {
    return noms?.of(code) ?? code;
  } catch {
    return code;
  }
}

const nomsAnglais =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

/**
 * "DE" -> "Germany". Sert a la recherche : un donateur etranger cherche
 * souvent son pays sous son nom anglais. Vide si le navigateur ne sait pas.
 */
export function nomAnglais(code) {
  if (!code) return '';
  try {
    return nomsAnglais?.of(code) ?? '';
  } catch {
    return '';
  }
}

/** "MG" -> "+261". Madagascar si le pays n'est pas encore choisi. */
export function indicatifDe(code) {
  try {
    return `+${getCountryCallingCode(code || PAYS_PAR_DEFAUT)}`;
  } catch {
    return `+${getCountryCallingCode(PAYS_PAR_DEFAUT)}`;
  }
}

/** Tous les pays, Madagascar en tete puis par ordre alphabetique. */
export const PAYS = (() => {
  const liste = getCountries()
    .map((code) => ({ code, nom: nomDuPays(code) }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const madagascar = liste.findIndex((pays) => pays.code === PAYS_PAR_DEFAUT);
  return [liste[madagascar], ...liste.filter((_, index) => index !== madagascar)];
})();
