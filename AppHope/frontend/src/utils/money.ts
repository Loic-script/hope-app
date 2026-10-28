/**
 * AFFICHAGE DES MONTANTS.
 *
 * Les montants arrivent du backend sous forme de CHAINES exactes ("100000.00").
 * Ce fichier ne fait que les METTRE EN FORME : il ne les additionne pas, ne
 * les soustrait pas, ne les compare pas pour prendre une decision financiere.
 * Tout calcul monetaire appartient au backend, qui travaille en Decimal.
 *
 * Seule exception assumee : `progressPercent`, deja calcule par le backend,
 * sert uniquement a dessiner une barre. Une barre n'est pas une somme d'argent.
 */

interface CurrencyDisplay {
  decimals: number;
  /** Symbole ou code affiche apres le montant. */
  suffix: string;
}

/** L'ariary malgache ne s'utilise pas avec des centimes. */
const CURRENCIES: Record<string, CurrencyDisplay> = {
  MGA: { decimals: 0, suffix: 'Ar' },
  EUR: { decimals: 2, suffix: '€' },
  USD: { decimals: 2, suffix: '$' },
  GBP: { decimals: 2, suffix: '£' },
  CHF: { decimals: 2, suffix: 'CHF' },
  CAD: { decimals: 2, suffix: 'CAD' },
};

function displayFor(currency: string): CurrencyDisplay {
  return CURRENCIES[currency.toUpperCase()] ?? { decimals: 2, suffix: currency.toUpperCase() };
}

/**
 * "100000" + "MGA" -> "100 000 Ar"
 *
 * La mise en forme se fait sur la CHAINE, sans jamais passer par un nombre :
 * on separe la partie entiere de la partie decimale, on groupe les milliers,
 * on recolle. Aucun arrondi flottant ne peut donc s'y glisser.
 */
export function formatMoney(amount: string | null | undefined, currency: string): string {
  if (amount === null || amount === undefined || amount === '') return '—';

  const { decimals, suffix } = displayFor(currency);
  const trimmed = amount.trim();
  const negative = trimmed.startsWith('-');
  const [rawInteger = '0', rawDecimal = ''] = trimmed.replace(/^-/, '').split('.');

  const grouped = rawInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const decimalPart = decimals > 0 ? `,${rawDecimal.padEnd(decimals, '0').slice(0, decimals)}` : '';

  return `${negative ? '-' : ''}${grouped}${decimalPart} ${suffix}`;
}

/** Version compacte pour les grands nombres : "1 250 000 Ar" -> "1,3 M Ar". */
export function formatMoneyCompact(amount: string | null | undefined, currency: string): string {
  if (!amount) return '—';

  const { suffix } = displayFor(currency);
  const integerPart = amount.split('.')[0]?.replace('-', '') ?? '0';

  if (integerPart.length <= 6) return formatMoney(amount, currency);

  const millions = Number(integerPart) / 1_000_000;
  const rounded = millions >= 100 ? Math.round(millions) : Math.round(millions * 10) / 10;
  return `${String(rounded).replace('.', ',')} M ${suffix}`;
}

/** Le montant est-il nul ? Lecture de chaine, pas de conversion numerique. */
export function isZeroAmount(amount: string | null | undefined): boolean {
  if (!amount) return true;
  return /^-?0*(\.0*)?$/.test(amount.trim());
}

/** Formate une valeur d'indicateur d'impact : "25.0000" -> "25". */
export function formatIndicatorValue(value: string | null | undefined): string {
  if (!value) return '—';
  const [integerPart = '0', decimalPart = ''] = value.split('.');
  const trimmed = decimalPart.replace(/0+$/, '');
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return trimmed ? `${grouped},${trimmed}` : grouped;
}
