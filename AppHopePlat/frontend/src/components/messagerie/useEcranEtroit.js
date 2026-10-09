import { useEffect, useState } from 'react';

export const REQUETE_TELEPHONE = '(max-width: 760px)';

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
