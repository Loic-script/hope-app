import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import akanySoavina from '../../assets/vitrine/akany-soavina.jpg';
import initiationFormations from '../../assets/vitrine/initiation-formations.jpg';
import mereEtEnfant from '../../assets/vitrine/mere-et-enfant.jpg';
import logoAqoci from '../../assets/vitrine/partenaires/aqoci.png';
import logoCoeurEtConscience from '../../assets/vitrine/partenaires/coeur-et-conscience.png';
import logoDesjardins from '../../assets/vitrine/partenaires/desjardins.png';
import logoDeveloppementEtPaix from '../../assets/vitrine/partenaires/developpement-et-paix.png';
import logoHumaniteInclusion from '../../assets/vitrine/partenaires/humanite-inclusion.png';
import logoSaveTheChildren from '../../assets/vitrine/partenaires/save-the-children.png';
import logoUnicef from '../../assets/vitrine/partenaires/unicef.png';
import { LIEN_DON } from '../../components/vitrine/liens.js';
import { useApparition } from '../../hooks/useApparition.js';
import { urlMedia } from '../../services/api.js';

/**
 * La suite de l'accueil du site vitrine : nos realisations, les
 * actualites (lues dans la plateforme), nos partenaires, et l'appel a
 * contribuer.
 */

/** Une image absente : le cadre reste habite par une icone. */
function SansImage() {
  return (
    <span className="v-sans-image" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
        <path d="m6.5 17 4-5 3 3.5 2-2.5 2.5 4z" />
        <circle cx="15.5" cy="8.5" r="1.5" />
      </svg>
    </span>
  );
}

/** L'en-tete d'une section : son titre a gauche, son lien "Tout voir" a droite. */
function EnteteSection({ id, titre, lien, libelleLien }) {
  return (
    <div className="v-entete-section">
      <h2 className="accueil-section__titre v-entete-section__titre" id={id}>
        {titre}
      </h2>
      <Link to={lien} className="v-bouton-contour">
        {libelleLien}
      </Link>
    </div>
  );
}

/* ============================ Nos realisations ============================ */

const REALISATIONS = [
  {
    titre: 'Soutien à la Formation Professionnelle d’Olivier',
    texte: 'Olivier, 24 ans, rêvait de devenir mécanicien automobile…',
    // La photo d'Olivier est a fournir : en attendant, le cadre l'annonce.
    image: null,
  },
  {
    titre: 'Initiation aux Formations Professionnelles',
    texte: 'Afin de promouvoir l’autonomisation des mères célibataires…',
    image: initiationFormations,
  },
  {
    titre: 'Soutien Scolaire pour l’Akany Soavina',
    texte: 'À l’occasion de la rentrée scolaire, nous avons soutenu les enfants de l’Akany Soavina…',
    image: akanySoavina,
  },
];

export function Realisations() {
  const [ref, vu] = useApparition({ seuil: 0.15 });
  return (
    <section
      ref={ref}
      className={`v-realisations${vu ? ' v-apparu' : ''}`}
      aria-labelledby="v-realisations-titre"
    >
      <div className="v-conteneur">
        <EnteteSection
          id="v-realisations-titre"
          titre="Nos réalisations"
          lien="/nos-realisations"
          libelleLien="Toutes nos réalisations"
        />
        <ul className="v-realisations__grille">
          {REALISATIONS.map((r, rang) => (
            <li key={r.titre} className="v-realisation v-entree" style={{ '--rang': rang }}>
              <div className="v-realisation__image">
                {r.image ? <img src={r.image} alt="" loading="lazy" /> : <SansImage />}
              </div>
              <div className="v-realisation__corps">
                <h3 className="v-realisation__titre">{r.titre}</h3>
                <p className="v-realisation__texte">{r.texte}</p>
                <Link to="/nos-realisations" className="v-realisation__lien">
                  Lire la suite<span className="sr-only"> : {r.titre}</span>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ============================ Les actualites ============================ */

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

function IconeChevron({ sens }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={sens === 'gauche' ? 'M14.5 6 8.5 12l6 6' : 'M9.5 6l6 6-6 6'} />
    </svg>
  );
}

export function Actualites() {
  const [ref, vu] = useApparition({ seuil: 0.15 });
  const piste = useRef(null);
  const [actualites, setActualites] = useState(null);
  const [bords, setBords] = useState({ debut: true, fin: true });

  useEffect(() => {
    let actif = true;
    fetch('/api/public/actualites?limite=9')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => actif && setActualites(d.items ?? []))
      .catch(() => actif && setActualites([]));
    return () => {
      actif = false;
    };
  }, []);

  // Les fleches s'eteignent aux bouts de la piste.
  const mesurer = useCallback(() => {
    const el = piste.current;
    if (!el) return;
    setBords({ debut: el.scrollLeft <= 4, fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    mesurer();
    window.addEventListener('resize', mesurer);
    return () => window.removeEventListener('resize', mesurer);
  }, [mesurer, actualites]);

  function defiler(sens) {
    const el = piste.current;
    if (!el) return;
    const carte = el.querySelector('.v-actualite');
    const pas = carte ? carte.getBoundingClientRect().width + 24 : el.clientWidth;
    el.scrollBy({ left: sens * pas, behavior: 'smooth' });
  }

  return (
    <section ref={ref} className={`v-actualites${vu ? ' v-apparu' : ''}`} aria-labelledby="v-actualites-titre">
      <div className="v-conteneur">
        <EnteteSection id="v-actualites-titre" titre="Actualités" lien="/actualites" libelleLien="Toutes nos actualités" />

        {actualites === null ? (
          <p className="v-actualites__attente">Chargement des actualités…</p>
        ) : actualites.length === 0 ? (
          <p className="v-actualites__attente">Les premières actualités de HOPE arrivent bientôt.</p>
        ) : (
          <div className="v-carrousel">
            <button
              type="button"
              className="v-carrousel__fleche v-carrousel__fleche--gauche"
              onClick={() => defiler(-1)}
              disabled={bords.debut}
              aria-label="Actualités précédentes"
            >
              <IconeChevron sens="gauche" />
            </button>
            <ul className="v-carrousel__piste" ref={piste} onScroll={mesurer}>
              {actualites.map((a, rang) => (
                <li key={a.id} className="v-actualite v-entree" style={{ '--rang': Math.min(rang, 3) }}>
                  <div className="v-actualite__image">
                    {a.photoUrl ? <img src={urlMedia(a.photoUrl)} alt="" loading="lazy" /> : <SansImage />}
                  </div>
                  <div className="v-actualite__corps">
                    <h3 className="v-actualite__titre">{a.titre}</h3>
                    {a.corps && <p className="v-actualite__texte">{a.corps}</p>}
                    <p className="v-actualite__date">
                      le <time dateTime={a.publieLe}>{FORMAT_DATE.format(new Date(a.publieLe))}</time>
                    </p>
                    <Link to="/actualites" className="v-actualite__lien">
                      Lire maintenant<span className="sr-only"> : {a.titre}</span>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="v-carrousel__fleche v-carrousel__fleche--droite"
              onClick={() => defiler(1)}
              disabled={bords.fin}
              aria-label="Actualités suivantes"
            >
              <IconeChevron sens="droite" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ============================ Nos partenaires ============================ */

/*
 * Les logos des partenaires, fournis par HOPE et recadres sur leur contenu.
 * `hauteur` egalise leur surface a l'ecran : un logo presque carre (HI)
 * est affiche plus haut qu'un logo tres large (UNICEF), et tous paraissent
 * de meme importance. L'ordre est celui de la maquette : quatre, puis trois.
 */
const PARTENAIRES = [
  { nom: 'UNICEF', logo: logoUnicef, hauteur: 43 },
  { nom: 'Humanité & Inclusion', logo: logoHumaniteInclusion, hauteur: 74 },
  { nom: 'AQOCI', logo: logoAqoci, hauteur: 47 },
  { nom: 'Save the Children', logo: logoSaveTheChildren, hauteur: 43 },
  { nom: 'Desjardins', logo: logoDesjardins, hauteur: 44 },
  { nom: 'Développement et Paix — Caritas Canada', logo: logoDeveloppementEtPaix, hauteur: 50 },
  { nom: 'Cœur et Conscience', logo: logoCoeurEtConscience, hauteur: 63 },
];

export function Partenaires() {
  const [ref, vu] = useApparition({ seuil: 0.2 });
  return (
    <section ref={ref} className={`v-partenaires${vu ? ' v-apparu' : ''}`} aria-labelledby="v-partenaires-titre">
      <h2 className="accueil-section__titre v-partenaires__titre" id="v-partenaires-titre">
        Nos partenaires
      </h2>
      <ul className="v-partenaires__liste">
        {PARTENAIRES.map((p, rang) => (
          <li key={p.nom} className="v-partenaire v-entree" style={{ '--rang': rang }}>
            <img src={p.logo} alt={p.nom} loading="lazy" style={{ '--hauteur': `${p.hauteur}px` }} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ============================ Contribuer ============================ */

export function Contribuer() {
  const [ref, vu] = useApparition({ seuil: 0.25 });
  return (
    <section ref={ref} className={`v-contribuer${vu ? ' v-apparu' : ''}`} aria-labelledby="v-contribuer-titre">
      <img className="v-contribuer__photo" src={mereEtEnfant} alt="" loading="lazy" />
      <div className="v-contribuer__voile" aria-hidden="true" />
      <div className="v-contribuer__contenu">
        <h2 className="v-contribuer__titre" id="v-contribuer-titre">
          <span className="v-entree" style={{ '--rang': 0 }}>Vous souhaitez contribuer pour</span>
          <span className="v-entree" style={{ '--rang': 1 }}>
            <strong>Aider une vie</strong> dès aujourd’hui ?
          </span>
        </h2>
        <div className="v-contribuer__trait" aria-hidden="true">
          <svg className="v-contribuer__soleil" viewBox="0 0 48 36">
            <g className="accueil-hero__rayons">
              <rect x="22" y="0" width="4" height="10" rx="2" />
              <rect x="22" y="0" width="4" height="10" rx="2" transform="rotate(-40 24 26)" />
              <rect x="22" y="0" width="4" height="10" rx="2" transform="rotate(40 24 26)" />
              <rect x="22" y="0" width="4" height="10" rx="2" transform="rotate(-78 24 26)" />
              <rect x="22" y="0" width="4" height="10" rx="2" transform="rotate(78 24 26)" />
            </g>
            <path className="accueil-hero__dome" d="M13 30a11 11 0 0 1 22 0z" />
          </svg>
          <span />
        </div>
        <p className="v-contribuer__texte v-entree" style={{ '--rang': 2 }}>
          L’espoir commence par une intention, mais il se réalise par l’action. Rejoignez{' '}
          <em>Hope for a Better Life</em> et devenez l’acteur d’un changement durable.
        </p>
        <div className="v-contribuer__actions v-entree" style={{ '--rang': 3 }}>
          <Link to={LIEN_DON} className="accueil-bouton accueil-bouton--orange">
            Faire un don
          </Link>
          <Link to="/authentification?type=bailleur" className="accueil-bouton accueil-bouton--violet">
            Devenir partenaire
          </Link>
        </div>
      </div>
    </section>
  );
}
