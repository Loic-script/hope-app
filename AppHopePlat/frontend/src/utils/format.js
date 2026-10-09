const DEVISES = {
  MGA: { suffixe: ' Ar', decimales: 0 },
  EUR: { suffixe: ' €', decimales: 2 },
  USD: { suffixe: ' $', decimales: 2 },
};

export function montant(valeur, devise = 'MGA') {
  if (valeur === null || valeur === undefined || valeur === '') return '—';

  const nombre = Number(valeur);
  if (!Number.isFinite(nombre)) return '—';

  const reglage = DEVISES[(devise ?? 'MGA').trim()] ?? DEVISES.MGA;

  return (
    nombre.toLocaleString('fr-FR', {
      minimumFractionDigits: reglage.decimales,
      maximumFractionDigits: reglage.decimales,
    }).replace(/\u202f/g, '\u00a0') + reglage.suffixe
  );
}

export function nombre(valeur, decimales = 0) {
  if (valeur === null || valeur === undefined || valeur === '') return '—';
  const converti = Number(valeur);
  if (!Number.isFinite(converti)) return '—';
  return converti
    .toLocaleString('fr-FR', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    })
    .replace(/\u202f/g, '\u00a0');
}

export function pourcent(valeur) {
  if (valeur === null || valeur === undefined) return '—';
  const converti = Number(valeur);
  if (!Number.isFinite(converti)) return '—';
  return `${converti.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

const JOUR_SEUL = /^\d{4}-\d{2}-\d{2}$/;

function versDate(valeur) {
  if (typeof valeur === 'string' && JOUR_SEUL.test(valeur)) {
    const [annee, mois, jour] = valeur.split('-').map(Number);
    return new Date(annee, mois - 1, jour);
  }
  return new Date(valeur);
}

export function date(valeur) {
  if (!valeur) return '—';
  const converti = versDate(valeur);
  if (Number.isNaN(converti.getTime())) return '—';
  return converti.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function dateLongue(valeur) {
  if (!valeur) return '—';
  const converti = versDate(valeur);
  if (Number.isNaN(converti.getTime())) return '—';
  return converti.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function jourDuMois(valeur) {
  if (!valeur) return '';
  const converti = versDate(valeur);
  if (Number.isNaN(converti.getTime())) return '';
  return String(converti.getDate());
}

export function moisCourt(valeur) {
  if (!valeur) return '';
  const converti = versDate(valeur);
  if (Number.isNaN(converti.getTime())) return '';
  return converti.toLocaleDateString('fr-FR', { month: 'short' });
}

export function depuis(valeur) {
  if (!valeur) return '';
  const converti = new Date(valeur);
  if (Number.isNaN(converti.getTime())) return '';

  const secondes = Math.max(0, Math.floor((Date.now() - converti.getTime()) / 1000));

  if (secondes < 60) return "À l'instant";
  const minutes = Math.floor(secondes / 60);
  if (minutes < 60) return `Il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `Il y a ${heures} heure${heures > 1 ? 's' : ''}`;
  const jours = Math.floor(heures / 24);
  if (jours < 31) return `Il y a ${jours} jour${jours > 1 ? 's' : ''}`;
  const mois = Math.floor(jours / 30);
  if (mois < 12) return `Il y a ${mois} mois`;
  return `Il y a ${Math.floor(mois / 12)} an${mois >= 24 ? 's' : ''}`;
}

export function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

export function auteurPreuve(preuve) {
  if (preuve?.authorVolunteer) return `${preuve.authorVolunteer} (bénévole)`;
  return preuve?.authorLog ?? 'compte supprimé';
}

export function tronquer(texte, longueur = 70) {
  if (!texte) return '';
  return texte.length <= longueur ? texte : `${texte.slice(0, longueur - 1)}…`;
}

export function initiales(nom) {
  const morceaux = String(nom ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .map((morceau) => morceau.replace(/^[^\p{L}]+/u, ''))
    .filter((morceau) => morceau.length > 0);

  if (morceaux.length === 0) return 'AH';
  if (morceaux.length === 1) return morceaux[0].slice(0, 2).toUpperCase();
  return (morceaux[0][0] + morceaux[morceaux.length - 1][0]).toUpperCase();
}

export function tailleFichier(octets) {
  if (!octets && octets !== 0) return '—';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

export function libelleIndicateur(code, indicateurs = []) {
  const connu = indicateurs.find((element) => element.code === code);
  if (connu) return connu.label;

  const mots = String(code ?? '')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (mots === '') return '—';
  return mots.charAt(0).toUpperCase() + mots.slice(1);
}
