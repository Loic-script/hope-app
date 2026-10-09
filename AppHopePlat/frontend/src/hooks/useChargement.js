import { useCallback, useEffect, useRef, useState } from 'react';

import { messageErreur } from '../services/api.js';

export function useChargement(chargeur, dependances = []) {
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const [compteur, setCompteur] = useState(0);
  const chargeurRef = useRef(chargeur);
  chargeurRef.current = chargeur;

  const recharger = useCallback(() => setCompteur((valeur) => valeur + 1), []);

  useEffect(() => {
    let obsolete = false;

    setChargement(true);
    setErreur('');

    chargeurRef
      .current()
      .then((resultat) => {
        if (obsolete) return;
        setDonnees(resultat);
      })
      .catch((echec) => {
        if (obsolete) return;
        setErreur(messageErreur(echec, 'Impossible de charger les données.'));
      })
      .finally(() => {
        if (!obsolete) setChargement(false);
      });

    return () => {
      obsolete = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependances, compteur]);

  return { donnees, chargement, erreur, recharger, setDonnees };
}

export function useSoumission() {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  const soumettre = useCallback(async (action, { onSucces } = {}) => {
    setEnvoi(true);
    setErreur('');
    try {
      const resultat = await action();
      onSucces?.(resultat);
      return resultat;
    } catch (echec) {
      setErreur(messageErreur(echec, "L'enregistrement a échoué."));
      return null;
    } finally {
      setEnvoi(false);
    }
  }, []);

  return { envoi, erreur, setErreur, soumettre };
}
