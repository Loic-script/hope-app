import { useEffect, useState } from 'react';

import FeuilleRapport from './FeuilleRapport.jsx';
import { messageErreur } from '../services/api.js';
import * as service from '../services/bailleur.service.js';

/**
 * Le rapport, lu dans l'espace du partenaire.
 *
 * Pourquoi ne pas montrer le PDF : le fichier devait alors circuler,
 * et un gestionnaire de telechargement installe sur le poste du
 * partenaire (Internet Download Manager et ses semblables) se saisit de
 * toute adresse finissant par .pdf avant que le navigateur ne l'affiche.
 * La fenetre restait vide et un enregistrement demarrait -- exactement
 * le contraire d'un apercu.
 *
 * Le texte arrive donc en JSON, et FeuilleRapport le met en page comme
 * le document imprime.
 */
export default function ApercuRapport({ documentId }) {
  const [rapport, setRapport] = useState(null);
  const [refus, setRefus] = useState('');

  useEffect(() => {
    if (!documentId) return undefined;

    let annule = false;
    setRapport(null);
    setRefus('');

    service
      .apercuDocument(documentId)
      .then((recu) => {
        if (!annule) setRapport(recu);
      })
      .catch((echec) => {
        if (!annule) setRefus(messageErreur(echec, 'Le rapport n’a pas pu être ouvert.'));
      });

    return () => {
      annule = true;
    };
  }, [documentId]);

  if (refus) return <p className="feuille__note feuille__note--echec">{refus}</p>;
  if (!rapport) return <p className="feuille__note">Ouverture du rapport…</p>;

  return (
    <FeuilleRapport
      titre={rapport.titre}
      sousTitre={rapport.sousTitre}
      blocs={rapport.blocs}
      pied={[rapport.projetNom, rapport.engagementIntitule].filter(Boolean).join(' · ')}
    />
  );
}
