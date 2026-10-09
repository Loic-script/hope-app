import ct from 'countries-and-timezones';

import { nomDuPays } from './pays.js';

const decalages = new Map();

export function decalage(nom) {
  if (decalages.has(nom)) return decalages.get(nom);
  let texte = '';
  try {
    const partie = new Intl.DateTimeFormat('en-US', { timeZone: nom, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((morceau) => morceau.type === 'timeZoneName')?.value;
    texte = (partie ?? 'GMT').replace('GMT', 'UTC');
    if (texte === 'UTC') texte = 'UTC+0';
  } catch {
    texte = '';
  }
  decalages.set(nom, texte);
  return texte;
}

function minutes(nom) {
  const trouve = decalage(nom).match(/UTC([+-])(\d+)(?::(\d+))?/);
  if (!trouve) return 0;
  const valeur = Number(trouve[2]) * 60 + Number(trouve[3] ?? 0);
  return trouve[1] === '-' ? -valeur : valeur;
}

export function ville(nom) {
  return String(nom).split('/').pop().replace(/_/g, ' ');
}

export function libelleFuseau(nom) {
  const ecart = decalage(nom);
  return ecart ? `${ville(nom)} (${ecart})` : ville(nom);
}

export function fuseauxDuPays(code) {
  if (!code) return [];
  const zones = ct.getTimezonesForCountry(code, { deprecated: true }) ?? [];
  const canoniques = zones.filter((z) => !z.aliasOf && !z.deprecated && z.name.includes('/'));

  const retenus = canoniques.filter((z) => z.countries[0] === code).map((z) => z.name);
  for (const partage of canoniques.filter((z) => z.countries[0] !== code)) {
    const local = zones.find(
      (a) => a.aliasOf === partage.name && a.countries[0] === code && a.name.includes('/')
    );
    if (local) retenus.push(local.name);
  }

  const liste = retenus.length > 0 ? retenus : canoniques.map((z) => z.name);
  return [...new Set(liste)].sort(
    (a, b) => minutes(a) - minutes(b) || ville(a).localeCompare(ville(b), 'fr')
  );
}

const FUSEAU_PRINCIPAL = {
  AR: 'America/Argentina/Buenos_Aires',
  AU: 'Australia/Sydney',
  BR: 'America/Sao_Paulo',
  CA: 'America/Toronto',
  CD: 'Africa/Kinshasa',
  CL: 'America/Santiago',
  CN: 'Asia/Shanghai',
  DE: 'Europe/Berlin',
  ES: 'Europe/Madrid',
  GB: 'Europe/London',
  ID: 'Asia/Jakarta',
  KZ: 'Asia/Almaty',
  MX: 'America/Mexico_City',
  PT: 'Europe/Lisbon',
  RU: 'Europe/Moscow',
  US: 'America/New_York',
};

export function fuseauParDefaut(code) {
  const liste = fuseauxDuPays(code);
  let appareil = '';
  try {
    appareil = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    appareil = '';
  }
  if (liste.includes(appareil)) return appareil;
  const local = liste.find((nom) => ct.getTimezone(nom)?.aliasOf === appareil);
  if (appareil && local) return local;
  if (liste.includes(FUSEAU_PRINCIPAL[code])) return FUSEAU_PRINCIPAL[code];
  return liste[0] ?? (appareil || 'Indian/Antananarivo');
}

let tous = null;

export function tousLesFuseaux() {
  if (tous) return tous;
  const vus = new Map();
  for (const code of Object.keys(ct.getAllCountries())) {
    for (const nom of fuseauxDuPays(code)) {
      if (!vus.has(nom)) vus.set(nom, code);
    }
  }
  tous = [...vus.entries()]
    .map(([nom, pays]) => ({
      nom,
      pays,
      libelle: `${ville(nom)}, ${nomDuPays(pays)} (${decalage(nom)})`,
    }))
    .sort((a, b) => minutes(a.nom) - minutes(b.nom) || a.libelle.localeCompare(b.libelle, 'fr'));
  return tous;
}

const PAYS_EURO = new Set([
  'AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT',
  'NL', 'PT', 'SK', 'SI', 'ES', 'AD', 'MC', 'SM', 'VA', 'ME', 'XK', 'AX',
  'RE', 'YT', 'GP', 'MQ', 'GF', 'PM', 'BL', 'MF',
]);

export function devisePourPays(code) {
  if (code === 'MG') return 'MGA';
  if (PAYS_EURO.has(code)) return 'EUR';
  return 'USD';
}

const PAYS_ANGLOPHONES = new Set([
  'US', 'GB', 'IE', 'AU', 'NZ', 'ZA', 'NG', 'GH', 'KE', 'UG', 'TZ', 'ZM', 'ZW', 'BW', 'NA',
  'MW', 'SZ', 'LS', 'SL', 'LR', 'GM', 'IN', 'PK', 'SG', 'MY', 'PH', 'JM', 'TT', 'BS', 'BB',
  'MU', 'SC',
]);

const LANGUE_PAR_PAYS = {
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', EC: 'es', GT: 'es',
  CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es', SV: 'es', NI: 'es', CR: 'es', PA: 'es',
  UY: 'es', PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt', DE: 'de', AT: 'de', LI: 'de',
  IT: 'it', SM: 'it', VA: 'it', NL: 'nl', CN: 'zh', TW: 'zh', HK: 'zh', JP: 'ja', KR: 'ko',
  RU: 'ru', PL: 'pl', RO: 'ro', GR: 'el', TR: 'tr', SA: 'ar', AE: 'ar', EG: 'ar', QA: 'ar',
  KW: 'ar', JO: 'ar', IQ: 'ar', OM: 'ar', BH: 'ar', YE: 'ar',
};

export function languePourPays(code) {
  if (LANGUE_PAR_PAYS[code]) return LANGUE_PAR_PAYS[code];
  return PAYS_ANGLOPHONES.has(code) ? 'en' : 'fr';
}
