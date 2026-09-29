import { useCallback, useDeferredValue, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import couverture from '../../assets/vitrine/actualites-couverture.jpg';
import Recherche from '../../components/vitrine/Recherche.jsx';
import { filtrerParMots } from '../../components/vitrine/recherche.js';
import { useApparition } from '../../hooks/useApparition.js';
import { urlMedia } from '../../services/api.js';
import { SansImage } from './SectionsAccueil.jsx';

/**
 * "Actualites" : ce que l'administration de HOPE publie, lu dans la
 * plateforme (GET /api/public/actualites). La derniere actualite fait la
 * une du bandeau ; toutes sont en cartes sur le fond de soleils.
 *
 * Le site ne recoit que le titre, un extrait, la date et la photo --
 * jamais les appels a financement, ni l'auteur, ni les cibles.
 */

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

/* ------------------------------- Le bandeau ------------------------------- */

/** La photo fournie par HOPE, et a la une la derniere actualite publiee. */
function Couverture({ actualites }) {
  const derniere = actualites?.[0] ?? null;
  return (
    <section className="actualites-hero" aria-labelledby="actualites-hero-titre">
      <img className="actualites-hero__photo" src={couverture} alt="" fetchPriority="high" />
      <div className="actualites-hero__voile" aria-hidden="true" />
      <div className="v-conteneur actualites-hero__contenu">
        {actualites === null ? (
          <>
            <h1 className="sr-only" id="actualites-hero-titre">
              Actualités
            </h1>
            <div className="actualites-hero__attente" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </>
        ) : derniere ? (
          <>
            <p className="actualites-hero__sur-titre">À la une</p>
            <h1 className="actualites-hero__titre" id="actualites-hero-titre">
              {derniere.titre}
            </h1>
            {derniere.corps && (
              <div className="actualites-hero__ligne">
                {/* Le soleil de la charte (assets/soleil.svg), en tete du texte comme sur la maquette. */}
                <span className="actualites-hero__soleil" aria-hidden="true" />
                <p className="actualites-hero__texte">{derniere.corps}</p>
              </div>
            )}
            <Link to={`/actualites/${derniere.id}`} className="accueil-bouton accueil-bouton--orange actualites-hero__bouton">
              Découvrir l’actualité →
            </Link>
          </>
        ) : (
          <>
            <h1 className="actualites-hero__titre" id="actualites-hero-titre">
              Les actualités de HOPE
            </h1>
            <div className="actualites-hero__ligne">
              <span className="actualites-hero__soleil" aria-hidden="true" />
              <p className="actualites-hero__texte">Les premières actualités arrivent bientôt.</p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/* -------------------------------- Les cartes -------------------------------- */

function Carte({ actualite, rang }) {
  const lien = `/actualites/${actualite.id}`;
  return (
    <li className="v-actualite actualites-carte v-entree" style={{ '--rang': Math.min(rang, 5) }}>
      {/* La photo mene aussi a l'article, sans doubler le lien pour le clavier. */}
      <Link to={lien} className="v-actualite__image actualites-carte__image" tabIndex={-1} aria-hidden="true">
        {actualite.photoUrl ? <img src={urlMedia(actualite.photoUrl)} alt="" loading="lazy" /> : <SansImage />}
      </Link>
      <div className="v-actualite__corps">
        <h2 className="v-actualite__titre">{actualite.titre}</h2>
        {actualite.corps && <p className="v-actualite__texte">{actualite.corps}</p>}
        <p className="v-actualite__date">
          le <time dateTime={actualite.publieLe}>{FORMAT_DATE.format(new Date(actualite.publieLe))}</time>
        </p>
        <Link to={lien} className="v-actualite__lien">
          Lire maintenant<span className="sr-only"> : {actualite.titre}</span>
        </Link>
      </div>
    </li>
  );
}

/** Quatre cartes vides qui respirent, le temps que la plateforme reponde. */
function Squelettes() {
  return (
    <ul className="actualites__grille" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
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

export default function Actualites() {
  const [ref, vu] = useApparition({ seuil: 0.05 });
  const [actualites, setActualites] = useState(null);
  const [erreur, setErreur] = useState(false);
  const [recherche, setRecherche] = useState('');
  // La liste se filtre au fil de la frappe sans jamais retenir le champ.
  const rechercheDifferee = useDeferredValue(recherche);

  const charger = useCallback(() => {
    setErreur(false);
    setActualites(null);
    const controle = new AbortController();
    fetch('/api/public/actualites?limite=60', { signal: controle.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setActualites(d.items ?? []))
      .catch((e) => {
        if (e.name !== 'AbortError') setErreur(true);
      });
    return () => controle.abort();
  }, []);

  useEffect(charger, [charger]);

  const visibles = actualites ? filtrerParMots(actualites, rechercheDifferee, ['titre', 'corps', 'projetNom']) : [];
  const enRecherche = rechercheDifferee.trim() !== '';

  return (
    <>
      <Couverture actualites={erreur ? [] : actualites} />
      <section ref={ref} className={`v-realisations actualites${vu ? ' v-apparu' : ''}`} aria-labelledby="actualites-titre">
        <div className="v-conteneur">
          <div className="v-liste__entete">
            <h2 className="sr-only" id="actualites-titre">
              Toutes nos actualités
            </h2>
            <Recherche valeur={recherche} onChange={setRecherche} libelle="Rechercher une actualité" />
          </div>

          {/* Le nombre de resultats, dit aux lecteurs d'ecran a chaque recherche. */}
          <p className="sr-only" aria-live="polite">
            {actualites && enRecherche
              ? visibles.length === 0
                ? 'Aucune actualité ne correspond.'
                : `${visibles.length} actualité${visibles.length > 1 ? 's' : ''} correspond${visibles.length > 1 ? 'ent' : ''}.`
              : ''}
          </p>

          {erreur ? (
            <div className="v-liste__message" role="alert">
              <p>Les actualités ne se chargent pas pour le moment.</p>
              <button type="button" className="v-bouton-contour" onClick={charger}>
                Réessayer
              </button>
            </div>
          ) : actualites === null ? (
            <Squelettes />
          ) : visibles.length === 0 ? (
            <div className="v-liste__message">
              <p>
                {enRecherche ? (
                  <>
                    Aucune actualité ne correspond à « <strong>{rechercheDifferee.trim()}</strong> ».
                  </>
                ) : (
                  'Les premières actualités de HOPE arrivent bientôt.'
                )}
              </p>
              {enRecherche && (
                <button type="button" className="v-bouton-contour" onClick={() => setRecherche('')}>
                  Voir toutes les actualités
                </button>
              )}
            </div>
          ) : (
            <ul className="actualites__grille">
              {visibles.map((actualite, rang) => (
                <Carte key={actualite.id} actualite={actualite} rang={rang} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
