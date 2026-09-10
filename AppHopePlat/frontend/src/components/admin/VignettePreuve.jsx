/**
 * Vignette d'une preuve terrain.
 *
 * Le fichier est servi derriere le jeton : une balise <img src="..."> ne
 * peut donc pas l'afficher directement, elle ne porte pas d'en-tete
 * Authorization. On recupere le blob puis on libere l'URL au demontage,
 * sinon le navigateur garderait chaque image en memoire.
 *
 * Partagee entre l'ecran Preuves terrain et l'onglet Impact de la fiche
 * projet, qui montrent les memes lignes.
 */
import { useEffect, useState } from 'react';

import * as fieldProofService from '../../services/fieldProof.service.js';

export default function VignettePreuve({ preuve }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let annule = false;
    let courante = null;

    if (preuve.mimeType?.startsWith('image/')) {
      fieldProofService.urlDuFichier(preuve).then((resultat) => {
        if (annule || !resultat) return;
        courante = resultat;
        setUrl(resultat);
      });
    }

    return () => {
      annule = true;
      if (courante) URL.revokeObjectURL(courante);
    };
  }, [preuve]);

  if (url) {
    return <img className="preuve__vignette" src={url} alt="" />;
  }
  return (
    <span className="preuve__vignette preuve__vignette--vide" aria-hidden="true">
      {preuve.proofType === 'TESTIMONY' ? '“”' : 'PDF'}
    </span>
  );
}
