/**
 * La carte bancaire, cote navigateur : reconnaitre le reseau, mettre le
 * numero en forme, le verifier.
 *
 * REGLE : le numero complet, la date d'expiration et le cryptogramme
 * (CVC) ne quittent jamais le navigateur. Ils sont destines au
 * prestataire de paiement, pas au serveur de HOPE. Seuls le reseau et
 * les quatre derniers chiffres -- ce qu'un recu imprime -- peuvent
 * partir, pour que l'equipe reconnaisse le paiement (resumeCarte).
 */

/** Les reseaux reconnus : prefixe, groupes d'affichage, longueurs, CVC. */
export const RESEAUX = [
  { cle: 'amex', nom: 'American Express', motif: /^3[47]/, groupes: [4, 6, 5], longueurs: [15], cvc: 4 },
  { cle: 'visa', nom: 'Visa', motif: /^4/, groupes: [4, 4, 4, 4, 3], longueurs: [13, 16, 19], cvc: 3 },
  {
    cle: 'mastercard',
    nom: 'Mastercard',
    motif: /^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/,
    groupes: [4, 4, 4, 4],
    longueurs: [16],
    cvc: 3,
  },
  { cle: 'jcb', nom: 'JCB', motif: /^35/, groupes: [4, 4, 4, 4, 3], longueurs: [16, 17, 18, 19], cvc: 3 },
];

/** Le reseau d'un numero (ou de son debut), sinon null. */
export function reseauDe(numero) {
  const chiffres = String(numero ?? '').replace(/\D/g, '');
  return RESEAUX.find((r) => r.motif.test(chiffres)) ?? null;
}

/** "4242424242424242" -> "4242 4242 4242 4242" (groupes du reseau). */
export function formaterNumero(saisie) {
  const reseau = reseauDe(saisie);
  const max = reseau ? Math.max(...reseau.longueurs) : 19;
  const chiffres = String(saisie ?? '').replace(/\D/g, '').slice(0, max);
  const groupes = reseau?.groupes ?? [4, 4, 4, 4, 3];
  const morceaux = [];
  let debut = 0;
  for (const taille of groupes) {
    if (debut >= chiffres.length) break;
    morceaux.push(chiffres.slice(debut, debut + taille));
    debut += taille;
  }
  return morceaux.join(' ');
}

/** L'algorithme de Luhn : la cle de controle de tout numero de carte. */
export function luhn(chiffres) {
  let somme = 0;
  let double = false;
  for (let i = chiffres.length - 1; i >= 0; i -= 1) {
    let c = Number(chiffres[i]);
    if (double) {
      c *= 2;
      if (c > 9) c -= 9;
    }
    somme += c;
    double = !double;
  }
  return chiffres.length > 0 && somme % 10 === 0;
}

/** "1230" ou "12/3" -> "12 / 30" : la date d'expiration en forme. */
export function formaterExpiration(saisie, precedente = '') {
  let chiffres = String(saisie ?? '').replace(/\D/g, '').slice(0, 4);
  // "4" -> "04" : un mois a un chiffre superieur a 1 se complete.
  if (chiffres.length === 1 && Number(chiffres) > 1) chiffres = `0${chiffres}`;
  // On efface la barre : on efface aussi le mois.
  const efface = String(precedente).length > String(saisie).length;
  if (chiffres.length >= 3 || (chiffres.length === 2 && !efface)) {
    return `${chiffres.slice(0, 2)} / ${chiffres.slice(2)}`.trimEnd();
  }
  return chiffres;
}

/** Les erreurs de la carte, champ par champ ('' si tout va bien). */
export function verifierCarte({ numero, expiration, cvc }, maintenant = new Date()) {
  const chiffres = String(numero ?? '').replace(/\D/g, '');
  const reseau = reseauDe(chiffres);
  const erreurs = { numero: '', expiration: '', cvc: '' };

  if (!chiffres) erreurs.numero = 'Indiquez le numéro de la carte.';
  else if (!reseau) erreurs.numero = 'Cette carte n’est pas acceptée : Visa, Mastercard, American Express ou JCB.';
  else if (!reseau.longueurs.includes(chiffres.length) || !luhn(chiffres)) erreurs.numero = 'Ce numéro de carte n’est pas valide.';

  const [mois, annee] = String(expiration ?? '').split('/').map((x) => x.trim());
  const m = Number(mois);
  const a = 2000 + Number(annee);
  if (!mois || !annee || annee.length !== 2) erreurs.expiration = 'Indiquez la date d’expiration (MM / AA).';
  else if (!(m >= 1 && m <= 12)) erreurs.expiration = 'Le mois doit aller de 01 à 12.';
  else {
    // Valable jusqu'au dernier jour du mois indique.
    const fin = new Date(a, m, 1);
    if (fin <= maintenant) erreurs.expiration = 'Cette carte est expirée.';
    else if (a > maintenant.getFullYear() + 20) erreurs.expiration = 'Cette date est trop lointaine.';
  }

  const attendu = reseau?.cvc ?? 3;
  if (!/^\d+$/.test(String(cvc ?? ''))) erreurs.cvc = 'Indiquez le cryptogramme (CVC).';
  else if (String(cvc).length !== attendu) erreurs.cvc = `Le cryptogramme compte ${attendu} chiffres.`;

  return erreurs;
}

/**
 * Ce qui peut quitter le navigateur : le reseau et les quatre derniers
 * chiffres. Jamais plus.
 */
export function resumeCarte(numero) {
  const chiffres = String(numero ?? '').replace(/\D/g, '');
  return { marque: reseauDe(chiffres)?.cle ?? 'autre', fin: chiffres.slice(-4) };
}
