const UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

function moinsDeCent(n) {
  if (n < 20) return UNITES[n];
  const dizaine = Math.floor(n / 10);
  let unite = n % 10;
  if (dizaine === 7 || dizaine === 9) unite += 10;
  const base = DIZAINES[dizaine];
  if (unite === 0) return dizaine === 8 ? 'quatre-vingts' : base;
  if ((unite === 1 || unite === 11) && dizaine !== 8 && dizaine !== 9) return `${base}-et-${UNITES[unite]}`;
  return `${base}-${UNITES[unite]}`;
}

function moinsDeMille(n, final) {
  const centaines = Math.floor(n / 100);
  const reste = n % 100;
  let texte = '';
  if (centaines > 0) {
    texte = centaines === 1 ? 'cent' : `${UNITES[centaines]}-cent`;
    if (centaines > 1 && reste === 0 && final) texte += 's';
  }
  if (reste > 0) {
    const fin = moinsDeCent(reste);
    texte = texte ? `${texte}-${fin}` : fin;
  }
  return texte;
}

export function enLettres(nombre) {
  const n = Math.floor(Math.abs(Number(nombre) || 0));
  if (n === 0) return 'zéro';

  const milliards = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const milliers = Math.floor((n % 1e6) / 1e3);
  const reste = n % 1e3;
  const morceaux = [];

  if (milliards) morceaux.push(`${moinsDeMille(milliards, true)}-milliard${milliards > 1 ? 's' : ''}`);
  if (millions) morceaux.push(`${moinsDeMille(millions, true)}-million${millions > 1 ? 's' : ''}`);
  if (milliers) {
    morceaux.push(milliers === 1 ? 'mille' : `${moinsDeMille(milliers, false).replace(/vingts$/, 'vingt')}-mille`);
  }
  if (reste) morceaux.push(moinsDeMille(reste, true));

  return morceaux.join('-');
}
