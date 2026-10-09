import { getCountries, getCountryCallingCode } from 'libphonenumber-js';

export const PAYS_PAR_DEFAUT = 'MG';

const noms =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['fr'], { type: 'region' })
    : null;

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

export function nomAnglais(code) {
  if (!code) return '';
  try {
    return nomsAnglais?.of(code) ?? '';
  } catch {
    return '';
  }
}

export function indicatifDe(code) {
  try {
    return `+${getCountryCallingCode(code || PAYS_PAR_DEFAUT)}`;
  } catch {
    return `+${getCountryCallingCode(PAYS_PAR_DEFAUT)}`;
  }
}

export const PAYS = (() => {
  const liste = getCountries()
    .map((code) => ({ code, nom: nomDuPays(code) }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const madagascar = liste.findIndex((pays) => pays.code === PAYS_PAR_DEFAUT);
  return [liste[madagascar], ...liste.filter((_, index) => index !== madagascar)];
})();
