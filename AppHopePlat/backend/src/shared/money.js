import { ErreurValidation } from './errors.js';

export const DEVISE_PAR_DEFAUT = 'MGA';

export const DEVISES_ACCEPTEES = ['MGA', 'EUR', 'USD'];

const CENTIMES_MAX = 99_999_999_999_99;

export function enCentimes(valeur, champ = 'montant', { minimum = 1 } = {}) {
  if (valeur === null || valeur === undefined || valeur === '') {
    throw new ErreurValidation(`Le champ "${champ}" est obligatoire.`, { [champ]: 'Champ obligatoire' });
  }

  const texte = String(valeur).trim().replace(/\s/g, '').replace(',', '.');

  if (!/^-?\d+(\.\d{1,2})?$/.test(texte)) {
    throw new ErreurValidation(
      `Le champ "${champ}" doit etre un montant valide avec au plus 2 decimales.`,
      { [champ]: 'Montant invalide' }
    );
  }

  const [partieEntiere, partieDecimale = ''] = texte.replace('-', '').split('.');
  const signe = texte.startsWith('-') ? -1 : 1;
  const centimes = signe * (Number(partieEntiere) * 100 + Number(partieDecimale.padEnd(2, '0')));

  if (centimes < minimum) {
    const seuil = centimesVersTexte(minimum);
    throw new ErreurValidation(`Le champ "${champ}" doit etre superieur ou egal a ${seuil}.`, {
      [champ]: `Minimum ${seuil}`,
    });
  }

  if (Math.abs(centimes) > CENTIMES_MAX) {
    throw new ErreurValidation(`Le champ "${champ}" depasse le montant maximal autorise.`, {
      [champ]: 'Montant trop eleve',
    });
  }

  return centimes;
}

export function depuisBase(valeur) {
  if (valeur === null || valeur === undefined) return 0;
  return enCentimes(valeur, 'montant', { minimum: Number.NEGATIVE_INFINITY });
}

export function centimesVersTexte(centimes) {
  const signe = centimes < 0 ? '-' : '';
  const absolu = Math.abs(Math.round(centimes));
  const entiers = Math.floor(absolu / 100);
  const decimales = String(absolu % 100).padStart(2, '0');
  return `${signe}${entiers}.${decimales}`;
}

export function sommeDepuisBase(valeurs) {
  return valeurs.reduce((total, valeur) => total + depuisBase(valeur), 0);
}

export function pourcentage(partieCentimes, totalCentimes) {
  if (!totalCentimes || totalCentimes <= 0) return 0;
  return Math.round((partieCentimes / totalCentimes) * 1000) / 10;
}

export function normaliserDevise(valeur, champ = 'currency') {
  if (valeur === null || valeur === undefined || valeur === '') return DEVISE_PAR_DEFAUT;

  const devise = String(valeur).trim().toUpperCase();
  if (!DEVISES_ACCEPTEES.includes(devise)) {
    throw new ErreurValidation(
      `Devise non prise en charge : ${devise}. Valeurs acceptees : ${DEVISES_ACCEPTEES.join(', ')}.`,
      { [champ]: 'Devise invalide' }
    );
  }
  return devise;
}
