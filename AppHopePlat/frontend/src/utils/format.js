/**
 * Formatage des valeurs affichees dans l'espace administrateur.
 *
 * L'API renvoie les montants sous forme de chaines decimales ("5000000.00")
 * pour ne pas perdre de precision. Le formatage en francais se fait ici,
 * au dernier moment, juste avant l'affichage.
 */

/** Symboles et reglages d'affichage par devise. */
const DEVISES = {
  MGA: { suffixe: ' Ar', decimales: 0 },
  EUR: { suffixe: ' €', decimales: 2 },
  USD: { suffixe: ' $', decimales: 2 },
};

/**
 * Formate un montant : 5000000.00 -> "5 000 000 Ar".
 * @param {string|number|null} valeur montant renvoye par l'API
 * @param {string} devise code ISO (MGA par defaut)
 */
export function montant(valeur, devise = 'MGA') {
  if (valeur === null || valeur === undefined || valeur === '') return '—';

  const nombre = Number(valeur);
  if (!Number.isFinite(nombre)) return '—';

  const reglage = DEVISES[(devise ?? 'MGA').trim()] ?? DEVISES.MGA;

  return (
    nombre.toLocaleString('fr-FR', {
      minimumFractionDigits: reglage.decimales,
      maximumFractionDigits: reglage.decimales,
    }).replace(/ /g, ' ') + reglage.suffixe
  );
}

/** Formate un nombre simple : 1234 -> "1 234". */
export function nombre(valeur, decimales = 0) {
  if (valeur === null || valeur === undefined || valeur === '') return '—';
  const converti = Number(valeur);
  if (!Number.isFinite(converti)) return '—';
  return converti
    .toLocaleString('fr-FR', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    })
    .replace(/ /g, ' ');
}

/** Formate un pourcentage : 42.5 -> "42,5 %". */
export function pourcent(valeur) {
  if (valeur === null || valeur === undefined) return '—';
  const converti = Number(valeur);
  if (!Number.isFinite(converti)) return '—';
  return `${converti.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
}

/** Un jour nu, sans heure ni fuseau : "2026-03-12". */
const JOUR_SEUL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convertit une valeur en Date affichable.
 *
 * Une date nue n'a pas de fuseau. `new Date("2026-03-12")` l'interprete en
 * UTC : a l'ouest de Greenwich, l'affichage reculerait d'un jour. On la
 * construit donc dans le fuseau local, composant par composant.
 */
function versDate(valeur) {
  if (typeof valeur === 'string' && JOUR_SEUL.test(valeur)) {
    const [annee, mois, jour] = valeur.split('-').map(Number);
    return new Date(annee, mois - 1, jour);
  }
  return new Date(valeur);
}

/** Formate une date : "2026-03-12" -> "12/03/2026". */
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

/** Formate une date longue : "12 mars 2026". */
export function dateLongue(valeur) {
  if (!valeur) return '—';
  const converti = versDate(valeur);
  if (Number.isNaN(converti.getTime())) return '—';
  return converti.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Duree ecoulee : "Il y a 2 heures", "Il y a 3 jours". */
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

/** Date du jour au format attendu par les champs <input type="date">. */
export function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

/** Tronque une chaine trop longue pour une cellule de tableau. */
export function tronquer(texte, longueur = 70) {
  if (!texte) return '';
  return texte.length <= longueur ? texte : `${texte.slice(0, longueur - 1)}…`;
}

/**
 * Initiales affichees dans une pastille.
 *
 * Seules les lettres comptent : un nom entre parentheses, prefixe ou
 * ponctue ne doit pas produire une initiale du type "[B".
 */
export function initiales(nom) {
  const morceaux = String(nom ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    // On ne garde que ce qui commence par une lettre, accents compris.
    .map((morceau) => morceau.replace(/^[^\p{L}]+/u, ''))
    .filter((morceau) => morceau.length > 0);

  if (morceaux.length === 0) return 'AH';
  if (morceaux.length === 1) return morceaux[0].slice(0, 2).toUpperCase();
  return (morceaux[0][0] + morceaux[morceaux.length - 1][0]).toUpperCase();
}

/** Formate la taille d'un fichier : 245678 -> "240 Ko". */
export function tailleFichier(octets) {
  if (!octets && octets !== 0) return '—';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
