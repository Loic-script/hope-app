export function normaliser(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function correspond(terme, ...textes) {
  const cherche = normaliser(terme);
  if (cherche === '') return true;
  return textes.some((texte) => normaliser(texte).includes(cherche));
}

function aplatir(texte) {
  return texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function surligner(texte, terme) {
  const source = String(texte ?? '');
  const cherche = normaliser(terme);
  if (cherche === '' || source === '') return [{ texte: source, trouve: false }];

  const caracteres = [...source];
  let aplati = '';
  const origine = [];
  caracteres.forEach((caractere, index) => {
    const forme = aplatir(caractere);
    aplati += forme;
    for (let k = 0; k < forme.length; k += 1) origine.push(index);
  });

  const morceaux = [];
  let libre = 0;
  for (let i = aplati.indexOf(cherche); i !== -1; i = aplati.indexOf(cherche, i + cherche.length)) {
    const debut = origine[i];
    const fin = origine[i + cherche.length - 1] + 1;
    if (debut < libre) continue;
    if (debut > libre) morceaux.push({ texte: caracteres.slice(libre, debut).join(''), trouve: false });
    morceaux.push({ texte: caracteres.slice(debut, fin).join(''), trouve: true });
    libre = fin;
  }
  if (morceaux.length === 0) return [{ texte: source, trouve: false }];
  if (libre < caracteres.length) morceaux.push({ texte: caracteres.slice(libre).join(''), trouve: false });
  return morceaux;
}

const HEURE = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const JOUR_SEMAINE = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });
const JOUR_MOIS = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const JOUR_MOIS_ANNEE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const DATE_COMPLETE = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

const capitaliser = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

function minuit(date) {
  const copie = new Date(date);
  copie.setHours(0, 0, 0, 0);
  return copie;
}

function joursEntre(a, b) {
  return Math.round((minuit(a) - minuit(b)) / 86400000);
}

export function heure(valeur) {
  return HEURE.format(new Date(valeur));
}

export function heureRelative(valeur, maintenant = new Date()) {
  if (!valeur) return '';
  const date = new Date(valeur);
  const ecart = joursEntre(maintenant, date);

  if (ecart <= 0) return HEURE.format(date);
  if (ecart === 1) return 'Hier';
  if (ecart < 7) return capitaliser(JOUR_SEMAINE.format(date));
  if (date.getFullYear() === maintenant.getFullYear()) return JOUR_MOIS.format(date);
  return JOUR_MOIS_ANNEE.format(date);
}

export function libelleJour(valeur, maintenant = new Date()) {
  const ecart = joursEntre(maintenant, new Date(valeur));
  if (ecart === 0) return 'Aujourd’hui';
  if (ecart === 1) return 'Hier';
  return capitaliser(DATE_COMPLETE.format(new Date(valeur)));
}

export function memeJour(a, b) {
  return joursEntre(a, b) === 0;
}

function libellePiece(piece) {
  if (piece.type === 'image') return '📎 Photo';
  if (piece.type === 'video') return '📎 Vidéo';
  return `📎 ${piece.nom}`;
}

export function apercu(fil) {
  const dernier = fil.dernier;
  if (!dernier) return fil.type === 'groupe' ? 'Groupe créé' : 'Aucun message';
  if (dernier.supprime) return 'Message supprimé';

  let contenu = String(dernier.corps ?? '').replace(/\s+/g, ' ').trim();
  const pieces = dernier.pieces ?? [];
  if (contenu === '' && pieces.length > 0) {
    contenu = libellePiece(pieces[0]) + (pieces.length > 1 ? ` +${pieces.length - 1}` : '');
  }

  if (dernier.estDeMoi) return `Vous : ${contenu}`;
  if (fil.type === 'groupe') {
    const prenom = String(dernier.auteurNom ?? '').split(' ')[0];
    return prenom ? `${prenom} : ${contenu}` : contenu;
  }
  return contenu;
}

export function initiales(nom) {
  const mots = String(nom ?? '').trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return '?';
  const premieres = mots.length === 1 ? mots[0].slice(0, 2) : mots[0][0] + mots[mots.length - 1][0];
  return premieres.toUpperCase();
}

export function poids(octets) {
  const n = Number(octets) || 0;
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

const MOTIF_LIEN =
  /(\bhttps?:\/\/[^\s<>"]+|\bwww\.[^\s<>"]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/gi;

const PONCTUATION_FINALE = /[.,;:!?'"»…]$/;

export function nettoyerFinDeLien(brut) {
  let lien = brut;
  let reste = '';
  for (;;) {
    if (PONCTUATION_FINALE.test(lien)) {
      reste = lien.slice(-1) + reste;
      lien = lien.slice(0, -1);
      continue;
    }
    const ouvrantes = (lien.match(/\(/g) ?? []).length;
    const fermantes = (lien.match(/\)/g) ?? []).length;
    if (lien.endsWith(')') && fermantes > ouvrantes) {
      reste = ')' + reste;
      lien = lien.slice(0, -1);
      continue;
    }
    break;
  }
  return { lien, reste };
}

export function raccourcir(texte, maximum = 60) {
  return texte.length > maximum ? `${texte.slice(0, maximum - 1)}…` : texte;
}

export function decouperLiens(texte) {
  const source = String(texte ?? '');
  const morceaux = [];
  let position = 0;

  for (const trouve of source.matchAll(MOTIF_LIEN)) {
    const { lien, reste } = nettoyerFinDeLien(trouve[0]);
    const debut = trouve.index;

    let href = null;
    if (lien.includes('@') && !/^(https?:\/\/|www\.)/i.test(lien)) {
      href = `mailto:${lien}`;
    } else {
      const candidat = /^www\./i.test(lien) ? `https://${lien}` : lien;
      try {
        const url = new URL(candidat);
        if (url.protocol === 'http:' || url.protocol === 'https:') href = url.href;
      } catch {
        href = null;
      }
    }

    if (!href || lien === '') continue;

    if (debut > position) morceaux.push({ type: 'texte', texte: source.slice(position, debut) });
    morceaux.push({ type: 'lien', href, libelle: raccourcir(lien) });
    if (reste) morceaux.push({ type: 'texte', texte: reste });
    position = debut + trouve[0].length;
  }

  if (position < source.length) morceaux.push({ type: 'texte', texte: source.slice(position) });
  return morceaux;
}
