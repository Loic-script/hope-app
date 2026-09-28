import { useEffect, useRef, useState } from 'react';

/**
 * Un element qui "apparait" quand il entre dans l'ecran.
 *
 * Renvoie une ref a poser sur l'element et un booleen : faux tant que
 * l'element n'a pas ete vu, vrai ensuite -- pour toujours, on ne rejoue
 * pas l'animation a chaque passage. Sans IntersectionObserver (vieux
 * navigateur), l'element est tout de suite visible : rien ne reste cache.
 *
 * @param {{ seuil?: number }} [options] la part visible qui declenche
 */
export function useApparition({ seuil = 0.2 } = {}) {
  const ref = useRef(null);
  const [vu, setVu] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (vu || !ref.current) return undefined;
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) {
          setVu(true);
          observateur.disconnect();
        }
      },
      { threshold: seuil }
    );
    observateur.observe(ref.current);
    return () => observateur.disconnect();
  }, [vu, seuil]);

  return [ref, vu];
}

/**
 * Un nombre qui monte de 0 a sa valeur, une fois "demarre" : les chiffres
 * d'impact se comptent sous les yeux. Mouvement reduit : la valeur tout
 * de suite.
 *
 * @param {number} cible
 * @param {boolean} demarre
 * @param {number} [duree] en millisecondes
 */
export function useCompteur(cible, demarre, duree = 1600) {
  const [valeur, setValeur] = useState(0);

  useEffect(() => {
    if (!demarre) return undefined;
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduit) {
      setValeur(cible);
      return undefined;
    }
    let image = 0;
    const debut = performance.now();
    const pas = (maintenant) => {
      const t = Math.min(1, (maintenant - debut) / duree);
      // Rapide au depart, freine a l'arrivee.
      const adouci = 1 - (1 - t) ** 3;
      setValeur(Math.round(cible * adouci));
      if (t < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [cible, demarre, duree]);

  return valeur;
}
