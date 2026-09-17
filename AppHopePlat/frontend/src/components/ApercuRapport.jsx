import { useEffect, useState } from 'react';

import * as service from '../services/bailleur.service.js';
import { messageErreur } from '../services/api.js';

/**
 * Le rapport, lu dans l'espace.
 *
 * Pourquoi ne pas montrer le PDF : le fichier devait alors circuler,
 * et un gestionnaire de telechargement installe sur le poste du
 * partenaire (Internet Download Manager et ses semblables) se saisit de
 * toute adresse finissant par .pdf avant que le navigateur ne l'affiche.
 * La fenetre restait vide et un enregistrement demarrait -- exactement
 * le contraire d'un apercu.
 *
 * Le texte arrive donc en JSON et se met en page ici. C'est le meme
 * contenu que le document imprime, dans la meme forme : bandeau HOPE,
 * titre, periode, puis les sections telles qu'elles sont redigees.
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
    <article className="feuille">
      {/* Le bandeau de la charte, comme en tete du document imprime. */}
      <header className="feuille__bandeau">
        <span className="feuille__marque">HOPE</span>
        <span className="feuille__signature">Hope for a Better Life — Madagascar</span>
      </header>

      <div className="feuille__corps">
        <h3 className="feuille__titre">{rapport.titre}</h3>
        {rapport.sousTitre && <p className="feuille__soustitre">{rapport.sousTitre}</p>}

        {rapport.blocs ? (
          rapport.blocs.map((bloc, index) => <Bloc key={index} bloc={bloc} />)
        ) : (
          <p className="feuille__note">
            Ce document n’a pas de version lisible en ligne. Téléchargez-le pour le consulter.
          </p>
        )}

        {(rapport.projetNom || rapport.engagementIntitule) && (
          <p className="feuille__pied">
            {[rapport.projetNom, rapport.engagementIntitule].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </article>
  );
}

/**
 * Un bloc du document.
 *
 * Le vocabulaire est celui dont le PDF est compose : titre de section,
 * paragraphe, puce, et tableau de deux colonnes pour les chiffres.
 */
function Bloc({ bloc }) {
  if (bloc.t === 'h2') return <h4 className="feuille__section">{bloc.texte}</h4>;
  if (bloc.t === 'p') return <p className="feuille__paragraphe">{bloc.texte}</p>;
  if (bloc.t === 'puce') {
    return (
      <p className="feuille__puce">
        <span aria-hidden="true">•</span>
        {bloc.texte}
      </p>
    );
  }
  if (bloc.t === 'kv') {
    return (
      <dl className="feuille__chiffres">
        {(bloc.lignes ?? []).map(([libelle, valeur], index) => (
          <div className="feuille__chiffre" key={index}>
            <dt>{libelle}</dt>
            <dd>{valeur}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return null;
}
