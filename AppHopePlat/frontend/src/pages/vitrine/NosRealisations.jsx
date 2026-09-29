import { useCallback, useDeferredValue, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';

import couverture from '../../assets/vitrine/realisations-couverture.jpg';
import { useApparition } from '../../hooks/useApparition.js';
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

/** Sans accents ni majuscules, pour que "ecole" trouve "École". */
function simplifier(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Les projets dont le nom, le texte, le lieu ou la categorie contient la recherche. */
function filtrer(projets, recherche) {
  const mots = simplifier(recherche).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return projets;
  return projets.filter((p) => {
    const corps = simplifier([p.name, p.descriptionTitre, p.description, p.location, p.categorie].join(' '));
    return mots.every((mot) => corps.includes(mot));
  });
}

/* ------------------------------- Le bandeau ------------------------------- */

function Couverture() {
  return (
    <section className="realisations-hero" aria-labelledby="realisations-hero-titre">
      <img className="realisations-hero__photo" src={couverture} alt="" fetchPriority="high" />
      <div className="realisations-hero__voile" aria-hidden="true" />
      <div className="realisations-hero__contenu">
        <h1 className="realisations-hero__titre" id="realisations-hero-titre">
          <span className="realisations-hero__ligne">Découvrez tous</span>
          <span className="realisations-hero__ligne">nos projets réalisés.</span>
        </h1>
        {/* Le soleil de la charte (assets/soleil.svg), pose au pied du titre comme sur la maquette. */}
        <span className="realisations-hero__soleil" aria-hidden="true" />
      </div>
    </section>
  );
}

/* ------------------------------ La recherche ------------------------------ */

function Recherche({ valeur, onChange }) {
  const id = useId();
  return (
    <form className="realisations-recherche" role="search" onSubmit={(e) => e.preventDefault()}>
      <label htmlFor={id} className="sr-only">
        Rechercher un projet
      </label>
      <input
        id={id}
        className="realisations-recherche__champ"
        type="search"
        placeholder="Rechercher..."
        autoComplete="off"
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="submit" className="realisations-recherche__bouton" aria-label="Rechercher">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5" />
        </svg>
      </button>
    </form>
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
        {projet.photoUrl ? <img src={projet.photoUrl} alt="" loading="lazy" /> : <SansImage />}
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
        <li key={i} className="realisations-squelette" style={{ '--rang': i }}>
          <span className="realisations-squelette__image" />
          <span className="realisations-squelette__ligne realisations-squelette__ligne--titre" />
          <span className="realisations-squelette__ligne" />
          <span className="realisations-squelette__ligne realisations-squelette__ligne--courte" />
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

  const visibles = projets ? filtrer(projets, rechercheDifferee) : [];
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
          <div className="realisations__entete">
            <h2 className="sr-only" id="realisations-titre">
              Nos projets
            </h2>
            <Recherche valeur={recherche} onChange={setRecherche} />
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
            <div className="realisations__message" role="alert">
              <p>Les projets ne se chargent pas pour le moment.</p>
              <button type="button" className="v-bouton-contour" onClick={charger}>
                Réessayer
              </button>
            </div>
          ) : projets === null ? (
            <Squelettes />
          ) : visibles.length === 0 ? (
            <div className="realisations__message">
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
