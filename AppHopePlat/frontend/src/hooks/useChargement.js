import { useCallback, useEffect, useRef, useState } from 'react';

import { messageErreur } from '../services/api.js';

/**
 * Chargement de donnees depuis l'API, avec etats de chargement et d'erreur.
 *
 * Toutes les pages de l'espace admin suivent le meme schema :
 *   const { donnees, chargement, erreur, recharger } = useChargement(
 *     () => projectService.lister(filtres), [filtres]
 *   );
 *
 * Le hook ignore la reponse d'un appel devenu obsolete (changement de filtre
 * pendant le chargement) pour eviter d'afficher un resultat perime.
 *
 * @param {() => Promise<T>} chargeur fonction qui appelle le service
 * @param {unknown[]} dependances relance le chargement quand elles changent
 * @template T
 */
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

/**
 * Gere la soumission d'un formulaire : etat d'envoi et message d'erreur.
 *
 * @returns {{ envoi: boolean, erreur: string, setErreur: Function, soumettre: Function }}
 */
export function useSoumission() {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');

  /**
   * @param {() => Promise<T>} action appel au service
   * @param {{ onSucces?: (resultat: T) => void }} options
   */
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
