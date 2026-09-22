import { useEffect, useRef, useState } from 'react';

/**
 * Le nombre affiche monte de 0 a sa valeur, une seule fois, a l'arrivee
 * des donnees -- en ralentissant, comme un compteur qui se pose.
 *
 * null tant que la valeur n'est pas connue : l'ecran montre un tiret.
 * Rien ne bouge si l'appareil demande de reduire les animations.
 *
 * Partage par la carte des chiffres du benevole et par l'espace donateur.
 *
 * @param {number|null} valeur
 * @param {number} delai  en millisecondes, avant de commencer a compter
 * @param {number} duree  en millisecondes
 */
export function useDecompte(valeur, delai = 0, duree = 900) {
  const [affiche, setAffiche] = useState(null);
  const depart = useRef(0);

  useEffect(() => {
    if (valeur === null || valeur === undefined || Number.isNaN(valeur)) return undefined;

    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduit || valeur === depart.current) {
      depart.current = valeur;
      setAffiche(valeur);
      return undefined;
    }

    const de = depart.current;
    const debut = performance.now() + delai;
    let image;
    const avancer = (maintenant) => {
      const t = Math.min(1, Math.max(0, (maintenant - debut) / duree));
      const pose = 1 - (1 - t) ** 3;
      setAffiche(Math.round(de + (valeur - de) * pose));
      if (t < 1) image = requestAnimationFrame(avancer);
      else depart.current = valeur;
    };
    image = requestAnimationFrame(avancer);
    return () => cancelAnimationFrame(image);
  }, [valeur, delai, duree]);

  return affiche;
}
