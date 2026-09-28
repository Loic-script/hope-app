import { useCallback } from 'react';

/** L'air laisse sous une colonne arretee en bas de l'ecran. */
const MARGE_BAS = 18;

/**
 * Une colonne qui suit l'ecran, comme celle de l'accueil de
 * l'administrateur.
 *
 * Le CSS la rend "sticky" sous l'en-tete. Plus courte que l'ecran, elle y
 * reste accrochee. Plus haute, accrochee en haut, son bas ne se verrait
 * jamais : on lui donne alors un "top" negatif -- la hauteur qui depasse.
 * Elle defile d'abord avec la page, puis s'arrete quand son bas atteint
 * celui de l'ecran, comme la colonne d'un fil de reseau social.
 *
 * Recalcule quand la colonne change de taille (donnees arrivees, texte
 * deplie) et quand la fenetre change. Sans effet la ou le CSS ne la rend
 * pas "sticky" (une seule colonne, telephone).
 *
 * C'est une reference de rappel, et non un useRef : la colonne peut
 * n'apparaitre qu'une fois les donnees chargees, et c'est a ce moment-la
 * qu'il faut la mesurer. React 19 appelle le nettoyage renvoye quand elle
 * disparait.
 *
 * @returns {(colonne: HTMLElement|null) => (() => void)|undefined} a poser en ref
 */
export function useColonneCollante() {
  return useCallback((colonne) => {
    if (!colonne) return undefined;

    function ajuster() {
      colonne.style.removeProperty('top');
      const style = getComputedStyle(colonne);
      if (style.position !== 'sticky') return;

      const haut = Number.parseFloat(style.top) || 0;
      const cible = window.innerHeight - colonne.offsetHeight - MARGE_BAS;
      if (cible < haut) colonne.style.top = `${Math.round(cible)}px`;
    }

    ajuster();
    const observateur = new ResizeObserver(ajuster);
    observateur.observe(colonne);
    window.addEventListener('resize', ajuster);
    return () => {
      observateur.disconnect();
      window.removeEventListener('resize', ajuster);
      colonne.style.removeProperty('top');
    };
  }, []);
}
