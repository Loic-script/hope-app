import { useEffect, useState } from 'react';

export const ECRAN_TELEPHONE = '(max-width: 640px)';

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

export function focusAutomatique() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return !window.matchMedia('(max-width: 640px)').matches;
}
