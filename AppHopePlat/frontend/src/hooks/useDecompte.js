import { useEffect, useRef, useState } from 'react';

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
