import { useCallback, useEffect, useRef, useState } from 'react';

/** Le temps de la sonnerie, et celui de l'annonce sous la cloche. */
const SONNERIE = 1400;
const ANNONCE = 9000;

/**
 * Une cloche qui se fait remarquer quand quelque chose arrive.
 *
 * Un compteur qui monte en silence ne se voit pas : l'equipe passe a
 * cote d'une inscription toute la matinee. Des que le nombre augmente,
 * la cloche sonne -- elle penche, une onde en part -- et une bulle dit
 * ce qui vient d'arriver, le temps d'etre lue.
 *
 * Ce qui compte, c'est l'ecart : on ne sonne jamais au premier chiffre
 * connu, sinon chaque ouverture de l'espace sonnerait pour des
 * notifications vieilles de trois jours.
 *
 * @param {number} nombre  le nombre de notifications non lues
 * @returns {{ sonne: boolean, arrivees: number, fermer: () => void }}
 */
export function useClocheQuiSonne(nombre) {
  const precedent = useRef(null);
  const minuteries = useRef([]);

  const [sonne, setSonne] = useState(false);
  const [arrivees, setArrivees] = useState(0);

  const fermer = useCallback(() => setArrivees(0), []);

  useEffect(() => {
    const avant = precedent.current;
    precedent.current = nombre;

    // Premier chiffre connu : on l'enregistre, on ne sonne pas.
    if (avant === null) return undefined;
    // Le nombre baisse (des notifications lues) : rien a annoncer.
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

  // Le composant disparait (deconnexion, changement d'espace) : on ne
  // laisse pas de minuterie derriere soi.
  useEffect(() => () => minuteries.current.forEach(clearTimeout), []);

  return { sonne, arrivees, fermer };
}
