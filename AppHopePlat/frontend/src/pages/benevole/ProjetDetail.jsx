import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { PleineCalendrier, PleineLieu, PleineTaches } from '../../components/IconesPleines.jsx';
import { PhotoAgrandissable } from '../../components/VisionneuseImage.jsx';
import { useChargement } from '../../hooks/useChargement.js';
import { messageErreur, urlMedia } from '../../services/api.js';
import * as service from '../../services/espaceBenevole.service.js';
import * as fmt from '../../utils/format.js';
import { STATUTS_TACHE } from './composants.jsx';

/**
 * Un projet, et tout ce qu'un benevole peut y faire.
 *
 * Le projet vient d'abord -- ce qu'il est, ou il se mene, ce qu'il vise
 * -- et ses taches en decoulent : on sait a quoi sert celle qu'on prend.
 */
export default function ProjetDetail() {
  const { id } = useParams();
  const { donnees, chargement, erreur, recharger } = useChargement(
    () => service.recupererProjet(id),
    [id]
  );

  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState('');

  async function agir(action) {
    setEnvoi(true);
    setRefus('');
    try {
      await action();
      recharger();
    } catch (echec) {
      setRefus(messageErreur(echec, 'Action impossible pour le moment.'));
    } finally {
      setEnvoi(false);
    }
  }

  if (chargement && !donnees) return <p className="bloc__vide">Chargement du projet…</p>;
  if (erreur) return <p className="alerte-benevole">{erreur}</p>;
  if (!donnees) return null;

  const { project: projet, tasks: taches } = donnees;
  const libres = taches.filter((t) => t.statut === 'a_faire' && !t.benevoleId);
  const prises = taches.filter((t) => t.statut !== 'a_faire' || t.benevoleId);

  return (
    <div className="accueil-benevole">
      <p className="fil-retour">
        <Link to="/benevole/projets">← Tous les projets</Link>
      </p>

      {/* ---------- La tete du projet ---------- */}
      <section className="tete-projet">
        {projet.mediaUrl && (
          <div className="tete-projet__image">
            <PhotoAgrandissable
              src={urlMedia(projet.mediaUrl)}
              alt={projet.name}
              legende={projet.name}
            />
          </div>
        )}
        <div className="tete-projet__corps">
          <p className="surtitre">
            <span className="trait-hope surtitre__trait" aria-hidden="true" />
            {projet.categoryName ?? 'Projet'}
          </p>
          <h1 className="accueil-benevole__titre">{projet.name}</h1>
          {projet.location && (
            <p className="tete-projet__lieu">
              <PleineLieu />
              {projet.location}
            </p>
          )}
          {/* Le titre de la description annonce le texte ; sans lui, le
              paragraphe tient seul, comme avant. */}
          {projet.descriptionTitre && (
            <p className="tete-projet__annonce">{projet.descriptionTitre}</p>
          )}
          {projet.description && (
            <p className="accueil-benevole__accroche">{projet.description}</p>
          )}

          {projet.objectives?.length > 0 && (
            <ul className="tete-projet__objectifs">
              {projet.objectives.map((objectif) => (
                <li key={objectif.id}>{objectif.label}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {refus && <p className="alerte-benevole">{refus}</p>}

      {/* ---------- Les taches ---------- */}
      <section className="bloc">
        <div className="bloc__entete">
          <h2 className="bloc__titre">Tâches à faire</h2>
          <p className="bloc__sous-titre">
            {libres.length > 0
              ? `${libres.length} à prendre sur ${taches.length}`
              : `${taches.length} au total`}
          </p>
        </div>

        {taches.length === 0 ? (
          <p className="bloc__vide">
            Aucune tâche sur ce projet pour l’instant. L’équipe en publiera au fil des
            besoins.
          </p>
        ) : (
          <ul className="taches-projet">
            {[...libres, ...prises].map((tache) => (
              <li
                key={tache.id}
                className={`tache-projet${tache.benevoleId ? ' tache-projet--prise' : ''}`}
              >
                <span className="carre-icone carre-icone--bleu" aria-hidden="true">
                  <PleineTaches />
                </span>

                <div className="tache-projet__corps">
                  <p className="tache-projet__titre">{tache.titre}</p>
                  {tache.description && (
                    <p className="tache-projet__texte">{tache.description}</p>
                  )}
                  <p className="tache-projet__faits">
                    <span className={`pastille pastille--${
                      { a_faire: 'orange', en_cours: 'bleu', livree: 'valide' }[tache.statut]
                    }`}>
                      {STATUTS_TACHE[tache.statut]}
                    </span>
                    {tache.echeance && (
                      <span className="tache-projet__echeance">
                        <PleineCalendrier />À rendre le {fmt.date(tache.echeance)}
                      </span>
                    )}
                  </p>
                </div>

                {/*
                  Seules les taches libres proposent une action. Celles
                  qui sont prises le sont peut-etre par quelqu'un
                  d'autre : "Mes tâches" est l'ecran ou l'on agit sur les
                  siennes.
                */}
                {!tache.benevoleId && (
                  <button
                    type="button"
                    className="bouton-hope bouton-hope--creux"
                    disabled={envoi}
                    onClick={() => agir(() => service.prendreTache(tache.id))}
                  >
                    Prendre
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
