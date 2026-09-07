/**
 * Arithmetique monetaire de HOPE.
 *
 * Regle : on ne calcule jamais un montant en nombre flottant. Chaque montant
 * est converti en entier de centimes, les additions et comparaisons se font
 * sur ces entiers, et le resultat est reconverti en chaine decimale avant
 * d'etre ecrit en base (colonnes NUMERIC(14,2)).
 *
 *   0.1 + 0.2 === 0.30000000000000004  -> inacceptable pour de la comptabilite
 *   10 + 20 === 30 centimes            -> exact
 */
import { ErreurValidation } from './errors.js';

/** Devise par defaut de l'association (ariary malgache). */
export const DEVISE_PAR_DEFAUT = 'MGA';

/** Devises acceptees par la plateforme a ce stade. */
export const DEVISES_ACCEPTEES = ['MGA', 'EUR', 'USD'];

/** Montant maximal accepte : NUMERIC(14,2) tient 12 chiffres avant la virgule. */
const CENTIMES_MAX = 99_999_999_999_99;

/**
 * Convertit une valeur quelconque en entier de centimes.
 *
 * @param {unknown} valeur nombre ou chaine ("1500", "1500.50", "1 500,50")
 * @param {string} champ nom du champ, utilise dans le message d'erreur
 * @param {{ minimum?: number }} options minimum en centimes (defaut : 1)
 * @returns {number} montant en centimes
 * @throws {ErreurValidation}
 */
export function enCentimes(valeur, champ = 'montant', { minimum = 1 } = {}) {
  if (valeur === null || valeur === undefined || valeur === '') {
    throw new ErreurValidation(`Le champ "${champ}" est obligatoire.`, { [champ]: 'Champ obligatoire' });
  }

  // On tolere la saisie francaise : espaces de milliers et virgule decimale.
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

/**
 * Lit un montant venant de PostgreSQL (NUMERIC renvoye en chaine) sans
 * appliquer de regle de validation metier.
 */
export function depuisBase(valeur) {
  if (valeur === null || valeur === undefined) return 0;
  return enCentimes(valeur, 'montant', { minimum: Number.NEGATIVE_INFINITY });
}

/** Convertit des centimes en chaine decimale prete pour PostgreSQL. */
export function centimesVersTexte(centimes) {
  const signe = centimes < 0 ? '-' : '';
  const absolu = Math.abs(Math.round(centimes));
  const entiers = Math.floor(absolu / 100);
  const decimales = String(absolu % 100).padStart(2, '0');
  return `${signe}${entiers}.${decimales}`;
}

/** Somme une liste de montants issus de la base, en centimes. */
export function sommeDepuisBase(valeurs) {
  return valeurs.reduce((total, valeur) => total + depuisBase(valeur), 0);
}

/**
 * Calcule un pourcentage arrondi a une decimale, en se protegeant de la
 * division par zero.
 */
export function pourcentage(partieCentimes, totalCentimes) {
  if (!totalCentimes || totalCentimes <= 0) return 0;
  return Math.round((partieCentimes / totalCentimes) * 1000) / 10;
}

/** Valide un code devise et retourne sa forme normalisee. */
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
