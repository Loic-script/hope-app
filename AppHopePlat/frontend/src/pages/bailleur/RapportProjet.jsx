import { useEffect, useState } from 'react';

import FeuilleRapport from '../../components/FeuilleRapport.jsx';
import { Modale } from '../../components/admin/forms.jsx';
import { messageErreur } from '../../services/api.js';
import * as service from '../../services/bailleur.service.js';

/**
 * Le rapport a jour d'un projet, dans une fenetre.
 *
 * Il est compose par le serveur avec les donnees du jour -- le meme que
 * l'onglet Rapport de l'administration -- et mis en page comme le
 * document imprime. Rien n'est enregistre a la lecture ; le PDF se
 * demande a part.
 *
 * Partagee par la page Projets et la page Rapports.
 *
 * @param {{ projet: { id: number, name: string, reference?: string } | null,
 *           onFermer: () => void }} props
 */
export default function FenetreRapportProjet({ projet, onFermer }) {
  const [rapport, setRapport] = useState(null);
  const [echecLecture, setEchecLecture] = useState('');
  const [echecPdf, setEchecPdf] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const id = projet?.id ?? null;

  useEffect(() => {
    if (!id) return undefined;

    let annule = false;
    setRapport(null);
    setEchecLecture('');
    setEchecPdf('');

    service
      .rapportProjet(id)
      .then((recu) => {
        if (!annule) setRapport(recu);
      })
      .catch((echec) => {
        if (!annule) setEchecLecture(messageErreur(echec, 'Le rapport n’a pas pu être composé.'));
      });

    return () => {
      annule = true;
    };
  }, [id]);

  async function telecharger() {
    setEnvoi(true);
    setEchecPdf('');
    try {
      await service.telechargerRapportProjet(projet.id, projet.reference);
    } catch (echec) {
      setEchecPdf(messageErreur(echec, 'Le PDF du rapport n’a pas pu être préparé.'));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <Modale
      ouverte={Boolean(projet)}
      titre={projet?.name ?? ''}
      sousTitre="Rapport à jour, composé avec les données du jour"
      onFermer={onFermer}
      erreur={echecPdf}
      large
      pied={
        <>
          <button
            type="button"
            className="bouton-bailleur bouton-bailleur--discret"
            onClick={onFermer}
          >
            Fermer
          </button>
          <button
            type="button"
            className="bouton-bailleur"
            onClick={telecharger}
            disabled={envoi || !rapport}
          >
            {envoi ? 'Préparation…' : 'Télécharger le PDF'}
          </button>
        </>
      }
    >
      {echecLecture ? (
        <p className="feuille__note feuille__note--echec">{echecLecture}</p>
      ) : !rapport ? (
        <p className="feuille__note">Composition du rapport…</p>
      ) : (
        <FeuilleRapport
          titre={rapport.titre}
          sousTitre={rapport.sousTitre}
          blocs={rapport.blocs}
          pied={[rapport.projet?.nom, rapport.projet?.reference].filter(Boolean).join(' · ')}
        />
      )}
    </Modale>
  );
}
