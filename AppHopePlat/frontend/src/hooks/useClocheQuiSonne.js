import { useCallback, useEffect, useRef, useState } from 'react';

const SONNERIE = 1400;
const ANNONCE = 9000;

export function useClocheQuiSonne(nombre) {
  const precedent = useRef(null);
  const minuteries = useRef([]);

  const [sonne, setSonne] = useState(false);
  const [arrivees, setArrivees] = useState(0);

  const fermer = useCallback(() => setArrivees(0), []);

  useEffect(() => {
    const avant = precedent.current;
    precedent.current = nombre;

    if (avant === null) return undefined;
    if (nombre <= avant) {
      if (nombre === 0) setArrivees(0);
      return undefined;
    }

    setSonne(true);
    setArrivees((deja) => deja + (nombre - avant));

    const fins = [
      setTimeout(() => setSonne(false), SONNERIE),
      setTimeout(() => setArrivees(0), ANNONCE),
    ];
    minuteries.current = fins;
    return () => fins.forEach(clearTimeout);
  }, [nombre]);

  useEffect(() => () => minuteries.current.forEach(clearTimeout), []);

  return { sonne, arrivees, fermer };
}
