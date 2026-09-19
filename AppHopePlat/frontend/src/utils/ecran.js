/**
 * Le curseur place d'office dans le premier champ : utile sur ordinateur,
 * genant sur telephone.
 *
 * Sur un petit ecran, le focus automatique fait sauter la page jusqu'au
 * champ -- le haut de la page, son titre, disparait -- et sur Android il
 * ouvre le clavier avant meme qu'on ait touche quoi que ce soit. On ne
 * le donne donc qu'aux grands ecrans.
 *
 * Lu au premier rendu : un ecran ne change pas de categorie en cours de
 * saisie.
 */
export function focusAutomatique() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return !window.matchMedia('(max-width: 640px)').matches;
}
