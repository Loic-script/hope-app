import { useEffect, useState } from 'react';

/** Un ecran de telephone : la meme limite que les feuilles de style. */
export const ECRAN_TELEPHONE = '(max-width: 640px)';

/**
 * Vrai sur un ecran de telephone, et mis a jour si la fenetre change de
 * taille (un telephone qu'on tourne, une fenetre qu'on retrecit).
 */
export function useEcranTelephone() {
  const lire = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(ECRAN_TELEPHONE).matches
      : false;
  const [telephone, setTelephone] = useState(lire);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const requete = window.matchMedia(ECRAN_TELEPHONE);
    const suivre = () => setTelephone(requete.matches);
    requete.addEventListener('change', suivre);
    return () => requete.removeEventListener('change', suivre);
  }, []);

  return telephone;
}

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
