import { useCallback, useDeferredValue, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import couverture from '../../assets/vitrine/realisations-couverture.jpg';
import Recherche from '../../components/vitrine/Recherche.jsx';
import { filtrerParMots } from '../../components/vitrine/recherche.js';
import { useApparition } from '../../hooks/useApparition.js';
import { urlMedia } from '../../services/api.js';
import { SansImage } from './SectionsAccueil.jsx';

/**
 * "Nos realisations" : les projets de HOPE, lus dans la plateforme
 * (GET /api/public/projets), en cartes sur le fond de soleils.
 *
 * Le site ne recoit que ce que la plateforme veut bien montrer : le nom,
 * un extrait, le lieu, la categorie, l'etat et la photo -- ni budget,
 * ni responsable, ni beneficiaires (vitrine.service, cote serveur).
 */

const ETATS = {
  COMPLETED: { classe: 'realise', libelle: 'Réalisé' },
  IN_PROGRESS: { classe: 'en-cours', libelle: 'En cours' },
};

/* ------------------------------- Le bandeau ------------------------------- */

function Couverture() {
  return (
    <section className="realisations-hero" aria-labelledby="realisations-hero-titre">
      <img className="realisations-hero__photo" src={couverture} alt="" fetchPriority="high" />
      <div className="realisations-hero__voile" aria-hidden="true" />
      <div className="realisations-hero__contenu">
        {/* Le bloc prend la largeur du titre : le filet s'y aligne. */}
        <div className="realisations-hero__bloc">
          <h1 className="realisations-hero__titre" id="realisations-hero-titre">
            <span className="realisations-hero__ligne">Découvrez tous</span>
            <span className="realisations-hero__ligne">nos projets</span>
          </h1>
          {/* Le soleil de la charte, renverse, puis le filet bleu sous le titre. */}
          <div className="realisations-hero__trait" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- Les cartes -------------------------------- */

function Carte({ projet, rang }) {
  const lien = `/nos-realisations/${projet.id}`;
  const etat = ETATS[projet.status];
  const texte =
    projet.description || projet.descriptionTitre || `Un projet de HOPE${projet.location ? ` à ${projet.location}` : ''}.`;
  return (
    <li className="v-realisation realisations-carte v-entree" style={{ '--rang': Math.min(rang, 5) }}>
      {/* La photo mene aussi a la fiche, sans doubler le lien pour le clavier. */}
      <Link to={lien} className="v-realisation__image realisations-carte__image" tabIndex={-1} aria-hidden="true">
        {projet.photoUrl ? <img src={urlMedia(projet.photoUrl)} alt="" loading="lazy" /> : <SansImage />}
        {etat && <span className={`realisations-carte__etat realisations-carte__etat--${etat.classe}`}>{etat.libelle}</span>}
      </Link>
      <div className="v-realisation__corps">
        <h2 className="v-realisation__titre">{projet.name}</h2>
        <p className="v-realisation__texte">{texte}</p>
        <Link to={lien} className="v-realisation__lien realisations-carte__lien">
          Lire la suite<span className="sr-only"> : {projet.name}</span>
        </Link>
      </div>
    </li>
  );
}

/** Six cartes vides qui respirent, le temps que la plateforme reponde. */
function Squelettes() {
  return (
    <ul className="v-realisations__grille realisations__grille" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="v-squelette" style={{ '--rang': i }}>
          <span className="v-squelette__image" />
          <span className="v-squelette__ligne v-squelette__ligne--titre" />
          <span className="v-squelette__ligne" />
          <span className="v-squelette__ligne v-squelette__ligne--courte" />
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------- La page --------------------------------- */

export default function NosRealisations() {
  const [ref, vu] = useApparition({ seuil: 0.05 });
  const [projets, setProjets] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [recherche, setRecherche] = useState('');
  // La liste se filtre au fil de la frappe sans jamais retenir le champ.
  const rechercheDifferee = useDeferredValue(recherche);

  const charger = useCallback(() => {
    setErreur(false);
    setProjets(null);
    const controle = new AbortController();
    fetch('/api/public/projets?limite=60', { signal: controle.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setProjets(d.items ?? []))
      .catch((e) => {
        if (e.name !== 'AbortError') setErreur(true);
      });
    return () => controle.abort();
  }, []);

  useEffect(charger, [charger]);

  const visibles = projets
    ? filtrerParMots(projets, rechercheDifferee, ['name', 'descriptionTitre', 'description', 'location', 'categorie'])
    : [];
  const enRecherche = rechercheDifferee.trim() !== '';

  return (
    <>
      <Couverture />
      <section
        ref={ref}
        className={`v-realisations realisations${vu ? ' v-apparu' : ''}`}
        aria-labelledby="realisations-titre"
      >
        <div className="v-conteneur">
          <div className="v-liste__entete">
            <h2 className="sr-only" id="realisations-titre">
              Nos projets
            </h2>
            <Recherche valeur={recherche} onChange={setRecherche} libelle="Rechercher un projet" />
          </div>

          {/* Le nombre de resultats, dit aux lecteurs d'ecran a chaque recherche. */}
          <p className="sr-only" aria-live="polite">
            {projets && enRecherche
              ? visibles.length === 0
                ? 'Aucun projet ne correspond.'
                : `${visibles.length} projet${visibles.length > 1 ? 's' : ''} correspond${visibles.length > 1 ? 'ent' : ''}.`
              : ''}
          </p>

          {erreur ? (
            <div className="v-liste__message" role="alert">
              <p>Les projets ne se chargent pas pour le moment.</p>
              <button type="button" className="v-bouton-contour" onClick={charger}>
                Réessayer
              </button>
            </div>
          ) : projets === null ? (
            <Squelettes />
          ) : visibles.length === 0 ? (
            <div className="v-liste__message">
              <p>
                {enRecherche ? (
                  <>
                    Aucun projet ne correspond à « <strong>{rechercheDifferee.trim()}</strong> ».
                  </>
                ) : (
                  'Nos premiers projets arrivent bientôt.'
                )}
              </p>
              {enRecherche && (
                <button type="button" className="v-bouton-contour" onClick={() => setRecherche('')}>
                  Voir tous les projets
                </button>
              )}
            </div>
          ) : (
            <ul className="v-realisations__grille realisations__grille">
              {visibles.map((projet, rang) => (
                <Carte key={projet.id} projet={projet} rang={rang} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
