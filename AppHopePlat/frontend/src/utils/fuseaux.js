/**
 * Fuseaux horaires, et ce que l'on propose a un donateur selon son pays.
 *
 * Les fuseaux viennent de countries-and-timezones, qui suit la base IANA.
 * Cette base a fusionne les fuseaux identiques : Madagascar y est range
 * sous "Africa/Nairobi". Montrer "Nairobi" a un donateur malgache le
 * derouterait ; on garde donc, pour chaque pays, le nom local du fuseau
 * quand il existe ("Indian/Antananarivo"). Le moteur des navigateurs et
 * de Node l'accepte tel quel.
 */
import ct from 'countries-and-timezones';

import { nomDuPays } from './pays.js';

/* ---------------- Decalages ---------------- */

const decalages = new Map();

/** "UTC+3", "UTC-5", "UTC+5:30" -- le decalage d'aujourd'hui, ete compris. */
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

/** Le decalage en minutes, pour trier d'ouest en est. */
function minutes(nom) {
  const trouve = decalage(nom).match(/UTC([+-])(\d+)(?::(\d+))?/);
  if (!trouve) return 0;
  const valeur = Number(trouve[2]) * 60 + Number(trouve[3] ?? 0);
  return trouve[1] === '-' ? -valeur : valeur;
}

/** "America/Argentina/Buenos_Aires" -> "Buenos Aires". */
export function ville(nom) {
  return String(nom).split('/').pop().replace(/_/g, ' ');
}

/** "Antananarivo (UTC+3)" */
export function libelleFuseau(nom) {
  const ecart = decalage(nom);
  return ecart ? `${ville(nom)} (${ecart})` : ville(nom);
}

/* ---------------- Fuseaux d'un pays ---------------- */

/**
 * Les fuseaux d'un pays, sous leur nom local, d'ouest en est.
 *
 * On garde les fuseaux dont le pays est le premier titulaire ; pour un
 * fuseau partage dont un autre pays est titulaire, on prend l'alias
 * propre a ce pays s'il en a un. Les anciens alias ("Asia/Calcutta") et
 * les abreviations ("CET") sont ecartes.
 */
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

/**
 * Le fuseau d'une grande ville, pour les pays qui en ont plusieurs : le
 * premier par ordre alphabetique serait souvent absurde (les Etats-Unis
 * commenceraient par "Adak", en Alaska).
 */
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

/**
 * Le fuseau propose pour un pays.
 *
 * Celui de l'appareil s'il est de ce pays -- il dit ou l'on est
 * vraiment --, sinon celui de sa grande ville, sinon le premier.
 */
export function fuseauParDefaut(code) {
  const liste = fuseauxDuPays(code);
  let appareil = '';
  try {
    appareil = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    appareil = '';
  }
  if (liste.includes(appareil)) return appareil;
  // L'appareil peut donner le nom fusionne ("Africa/Nairobi") la ou le
  // pays a son nom local ("Indian/Antananarivo").
  const local = liste.find((nom) => ct.getTimezone(nom)?.aliasOf === appareil);
  if (appareil && local) return local;
  if (liste.includes(FUSEAU_PRINCIPAL[code])) return FUSEAU_PRINCIPAL[code];
  return liste[0] ?? (appareil || 'Indian/Antananarivo');
}

/* ---------------- Tous les fuseaux ---------------- */

let tous = null;

/**
 * Tous les fuseaux, chacun sous son nom local et avec son pays, d'ouest
 * en est : "Antananarivo, Madagascar (UTC+3)". Calcule a la premiere
 * demande seulement.
 *
 * Chaque fuseau porte aussi son pays (code) : la liste s'y cherche.
 */
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

/* ---------------- Devise et langue proposees ---------------- */

/**
 * Pays et territoires ou l'euro a cours : zone euro, micro-Etats qui
 * l'emploient, departements et collectivites francais d'outre-mer --
 * dont La Reunion et Mayotte, voisines de Madagascar.
 */
const PAYS_EURO = new Set([
  'AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT',
  'NL', 'PT', 'SK', 'SI', 'ES', 'AD', 'MC', 'SM', 'VA', 'ME', 'XK', 'AX',
  'RE', 'YT', 'GP', 'MQ', 'GF', 'PM', 'BL', 'MF',
]);

/** L'ariary a Madagascar, l'euro ou il a cours, le dollar ailleurs. */
export function devisePourPays(code) {
  if (code === 'MG') return 'MGA';
  if (PAYS_EURO.has(code)) return 'EUR';
  return 'USD';
}

/** Pays ou l'anglais est la langue d'usage des echanges. */
const PAYS_ANGLOPHONES = new Set([
  'US', 'GB', 'IE', 'AU', 'NZ', 'ZA', 'NG', 'GH', 'KE', 'UG', 'TZ', 'ZM', 'ZW', 'BW', 'NA',
  'MW', 'SZ', 'LS', 'SL', 'LR', 'GM', 'IN', 'PK', 'SG', 'MY', 'PH', 'JM', 'TT', 'BS', 'BB',
  'MU', 'SC',
]);

/**
 * La langue proposee pour quelques grandes aires linguistiques. Madagascar
 * reste au francais : c'est la langue dans laquelle HOPE ecrit d'abord a
 * ses donateurs malgaches. Tout se change dans la liste.
 */
const LANGUE_PAR_PAYS = {
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', EC: 'es', GT: 'es',
  CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es', SV: 'es', NI: 'es', CR: 'es', PA: 'es',
  UY: 'es', PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt', CV: 'pt', DE: 'de', AT: 'de', LI: 'de',
  IT: 'it', SM: 'it', VA: 'it', NL: 'nl', CN: 'zh', TW: 'zh', HK: 'zh', JP: 'ja', KR: 'ko',
  RU: 'ru', PL: 'pl', RO: 'ro', GR: 'el', TR: 'tr', SA: 'ar', AE: 'ar', EG: 'ar', QA: 'ar',
  KW: 'ar', JO: 'ar', IQ: 'ar', OM: 'ar', BH: 'ar', YE: 'ar',
};

/** La langue proposee : celle du pays s'il en a une, sinon anglais ou francais. */
export function languePourPays(code) {
  if (LANGUE_PAR_PAYS[code]) return LANGUE_PAR_PAYS[code];
  return PAYS_ANGLOPHONES.has(code) ? 'en' : 'fr';
}
