import { useCallback } from 'react';

const MARGE_BAS = 18;

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
