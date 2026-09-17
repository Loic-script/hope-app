import { useEffect, useState } from 'react';

/** Sous cette largeur, un seul volet a la fois : liste, ou conversation. */
export const REQUETE_TELEPHONE = '(max-width: 760px)';

/**
 * L'ecran est-il celui d'un telephone ?
 *
 * Lu par matchMedia et non deduit de la largeur a l'instant : la
 * rotation d'un telephone, ou une fenetre qu'on retrecit, doivent faire
 * basculer la mise en page sans recharger.
 */
export function useEcranEtroit() {
  const requete = () => typeof window !== 'undefined' && window.matchMedia(REQUETE_TELEPHONE).matches;
  const [etroit, setEtroit] = useState(requete);

  useEffect(() => {
    const media = window.matchMedia(REQUETE_TELEPHONE);
    const suivre = () => setEtroit(media.matches);
    suivre();
    media.addEventListener('change', suivre);
    return () => media.removeEventListener('change', suivre);
  }, []);

  return etroit;
}
