import { useEffect, useRef, useState } from 'react';

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
      const adouci = 1 - (1 - t) ** 3;
      setValeur(Math.round(cible * adouci));
      if (t < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [cible, demarre, duree]);

  return valeur;
}
