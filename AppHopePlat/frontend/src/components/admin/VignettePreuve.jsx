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

  // Une preuve porte plusieurs fichiers : la vignette montre le premier,
  // celui qui la represente dans les listes.
  const principal = fieldProofService.fichierPrincipal(preuve);

  useEffect(() => {
    let annule = false;
    let courante = null;

    if (principal?.mimeType?.startsWith('image/')) {
      fieldProofService.urlDuFichier(preuve, principal).then((resultat) => {
        if (annule || !resultat) return;
        courante = resultat;
        setUrl(resultat);
      });
    }

    return () => {
      annule = true;
      if (courante) URL.revokeObjectURL(courante);
    };
  }, [preuve, principal]);

  if (url) {
    return (
      <span className="preuve__vignette-cadre">
        <img className="preuve__vignette" src={url} alt="" />
        {/* Le compte des images en plus, comme sur une annonce. */}
        {preuve.files?.length > 1 && (
          <span className="preuve__compte" aria-hidden="true">+{preuve.files.length - 1}</span>
        )}
      </span>
    );
  }

  const etiquette = { TESTIMONY: '“”', VIDEO: '▶', DOCUMENT: 'PDF' }[preuve.proofType] ?? 'PDF';
  return (
    <span className="preuve__vignette preuve__vignette--vide" aria-hidden="true">
      {etiquette}
    </span>
  );
}
