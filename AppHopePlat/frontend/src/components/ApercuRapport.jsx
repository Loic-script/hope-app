import { useEffect, useState } from 'react';

import FeuilleRapport from './FeuilleRapport.jsx';
import { messageErreur } from '../services/api.js';
import * as service from '../services/bailleur.service.js';

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
