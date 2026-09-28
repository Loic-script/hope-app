import { Link } from 'react-router-dom';

import couverture from '../../assets/hope-couverture.jpg';
import { LIEN_DON } from '../../components/vitrine/liens.js';
import { useApparition, useCompteur } from '../../hooks/useApparition.js';
import { Actualites as ActualitesAccueil, Contribuer, Partenaires, Realisations } from './SectionsAccueil.jsx';

/**
 * L'accueil du site vitrine : le bandeau d'appel, les quatre activites
 * de HOPE, et ses impacts chiffres.
 *
 * Chaque bloc entre en scene quand il arrive a l'ecran (useApparition) ;
 * les chiffres d'impact se comptent sous les yeux (useCompteur). Tout
 * s'arrete si le visiteur a demande moins de mouvement.
 */

/* ============================ Le bandeau ============================ */

/** Le petit soleil au bout du trait du titre : rayons et demi-disque. */
function PetitSoleil() {
  return (
    <svg className="accueil-hero__soleil" viewBox="0 0 48 36" aria-hidden="true">
      <g className="accueil-hero__rayons">
        <rect x="22" y="0" width="4" height="10" rx="2" />
        <rect x="22" y="0" width="4" height="10" rx="2" transform="rotate(-40 24 26)" />
        <rect x="22" y="0" width="4" height="10" rx="2" transform="rotate(40 24 26)" />
        <rect x="22" y="0" width="4" height="10" rx="2" transform="rotate(-78 24 26)" />
        <rect x="22" y="0" width="4" height="10" rx="2" transform="rotate(78 24 26)" />
      </g>
      <path className="accueil-hero__dome" d="M13 30a11 11 0 0 1 22 0z" />
      <rect className="accueil-hero__socle" x="17" y="32" width="14" height="3" rx="1.5" />
    </svg>
  );
}

function Hero() {
  return (
    <section className="accueil-hero" aria-labelledby="accueil-hero-titre">
      <img className="accueil-hero__photo" src={couverture} alt="" fetchPriority="high" />
      <div className="accueil-hero__voile" aria-hidden="true" />
      <div className="accueil-hero__contenu">
        <h1 className="accueil-hero__titre" id="accueil-hero-titre">
          <span className="accueil-hero__ligne accueil-hero__ligne--1">Unissons-nous</span>
          <span className="accueil-hero__ligne accueil-hero__ligne--2">pour un avenir meilleur</span>
        </h1>
        <div className="accueil-hero__trait" aria-hidden="true">
          <span />
          <PetitSoleil />
        </div>
        <p className="accueil-hero__texte">
          Nous ne faisons pas que faire naître l’espoir. Nous éclairons le chemin des orphelins et des mères
          célibataires à Madagascar jusqu’à leur pleine indépendance.
        </p>
        <div className="accueil-hero__actions">
          <Link to={LIEN_DON} className="accueil-bouton accueil-bouton--orange">
            Soutenir notre mission
          </Link>
          <a href="#nos-activites" className="accueil-bouton accueil-bouton--bleu">
            Découvrir nos actions
          </a>
        </div>
      </div>
    </section>
  );
}

/* ============================ Les activites ============================ */

const ICONES = {
  scolarite: (
    <>
      <path d="M2 9.5 12 4.5l10 5-10 5z" />
      <path d="M6 11.6v4.6c0 1.4 2.7 2.8 6 2.8s6-1.4 6-2.8v-4.6" />
      <path d="M21.5 9.8v5.2" />
    </>
  ),
  employabilite: (
    <>
      <path d="M8.5 7V5.8A1.3 1.3 0 0 1 9.8 4.5h4.4a1.3 1.3 0 0 1 1.3 1.3V7" />
      <rect x="4.5" y="7" width="15" height="8" rx="1.6" />
      <path d="M4.5 10.5h15" />
      <path d="M2.5 20.5h3.6l2.6-1.3h6.6a1.4 1.4 0 0 0 0-2.8h-3.8" />
    </>
  ),
  soins: (
    <>
      <path d="M12 20.3s-7.4-4.5-8.8-9.3C2.3 7.6 4.3 4.6 7.5 4.6c1.9 0 3.4 1 4.5 2.7 1.1-1.7 2.6-2.7 4.5-2.7 3.2 0 5.2 3 4.3 6.4-1.4 4.8-8.8 9.3-8.8 9.3z" />
      <path d="M5.5 12h3.2l1.6-3 3 5.6 1.6-2.6h3.6" />
    </>
  ),
  alimentation: (
    <>
      <circle cx="12.5" cy="12" r="6.2" />
      <circle cx="12.5" cy="12" r="3.4" />
      <path d="M3.5 4v5.2M2 4v3.4a1.5 1.5 0 0 0 3 0V4M3.5 10v10" />
      <path d="M21.5 4c-1.3.9-1.9 2.8-1.9 5h1.9v11" />
    </>
  ),
};

const ACTIVITES = [
  {
    cle: 'scolarite',
    titre: 'Scolarité',
    texte:
      'L’éducation est au cœur de notre mission. Nous offrons des bourses d’étude, des fournitures scolaires, et un soutien éducatif personnalisé pour garantir à chaque enfant un accès à une éducation de qualité, condition indispensable pour transformer leur avenir.',
  },
  {
    cle: 'employabilite',
    titre: 'Employabilité',
    texte:
      'Offrir l’employabilité aux mères célibataires, en leur fournissant les outils, les compétences, et les opportunités nécessaires pour intégrer le marché du travail de manière durable.',
  },
  {
    cle: 'soins',
    titre: 'Soins',
    texte:
      'Grâce à des partenariats avec des hôpitaux et des cliniques locales, nous assurons des soins de santé réguliers et d’urgence pour répondre aux besoins médicaux des personnes que nous soutenons.',
  },
  {
    cle: 'alimentation',
    titre: 'Alimentation',
    texte:
      'Pour lutter contre l’insécurité alimentaire, nous organisons la distribution de paniers alimentaires et offrons des repas réguliers aux familles vulnérables, contribuant ainsi à leur bien-être et leur santé.',
  },
];

/** Le soleil qui coiffe une carte : rayons, horizon, et l'icone en medaillon. */
function Medaillon({ cle }) {
  return (
    <div className="v-activite__medaillon" aria-hidden="true">
      <svg className="v-activite__soleil" viewBox="0 0 200 110">
        <g className="v-activite__rayons">
          <rect x="95" y="4" width="10" height="26" rx="5" />
          <rect x="95" y="4" width="10" height="26" rx="5" transform="rotate(-38 100 78)" />
          <rect x="95" y="4" width="10" height="26" rx="5" transform="rotate(38 100 78)" />
        </g>
        <rect className="v-activite__horizon" x="8" y="72" width="54" height="11" rx="5.5" />
        <rect className="v-activite__horizon" x="138" y="72" width="54" height="11" rx="5.5" />
      </svg>
      <span className="v-activite__pastille">
        <svg viewBox="0 0 24 24">{ICONES[cle]}</svg>
      </span>
    </div>
  );
}

function Activites() {
  const [ref, vu] = useApparition({ seuil: 0.15 });
  return (
    <section
      id="nos-activites"
      ref={ref}
      className={`accueil-activites${vu ? ' accueil-activites--vu' : ''}`}
      aria-labelledby="accueil-activites-titre"
    >
      <h2 className="accueil-section__titre" id="accueil-activites-titre">
        Nos activités
      </h2>
      <ul className="accueil-activites__grille">
        {ACTIVITES.map((a, rang) => (
          <li key={a.cle} className={`v-activite v-activite--${a.cle}`} style={{ '--rang': rang }}>
            <Medaillon cle={a.cle} />
            <article className="v-activite__carte">
              <h3 className="v-activite__titre">{a.titre}</h3>
              <p className="v-activite__texte">{a.texte}</p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ============================ Les impacts ============================ */

const FILIGRANES = {
  fournitures: (
    <>
      <path d="M5 3h9l4 4v14H5z" />
      <path d="M14 3v4h4M8 11h7M8 14.5h7M8 18h4" />
      <path d="M20.5 9.5 23 12l-5 5-2.8.4.4-2.8z" />
    </>
  ),
  panier: (
    <>
      <path d="M3 9h18l-1.8 11H4.8z" />
      <path d="M8 9V6.5a4 4 0 0 1 8 0V9M9 13v3.5M15 13v3.5" />
    </>
  ),
  diplome: (
    <>
      <path d="M1.5 9.5 12 4l10.5 5.5L12 15z" />
      <path d="M5.5 11.7v5c0 1.6 3 3.3 6.5 3.3s6.5-1.7 6.5-3.3v-5M22 9.8v6" />
    </>
  ),
  sante: (
    <>
      <path d="M12 21s-8-4.9-9.5-10.1C1.6 7.2 3.8 4 7.2 4c2 0 3.7 1.1 4.8 2.9C13.1 5.1 14.8 4 16.8 4c3.4 0 5.6 3.2 4.7 6.9C20 16.1 12 21 12 21z" />
      <path d="M4.5 12h4l1.8-3.2 3.2 6 1.8-2.8h4.2" />
    </>
  ),
};

const IMPACTS = [
  { nombre: 300, libelle: 'Enfants orphelins', texte: 'Bénéficient de nos fournitures scolaires.', filigrane: 'fournitures' },
  { nombre: 100, libelle: 'Mères célibataires', texte: 'Bénéficient de produits de première nécessité (PPN) et de formations professionnelles.', filigrane: 'panier' },
  { nombre: 5, libelle: 'Orphelins', texte: 'Profitent d’un appui éducatif durable et d’une formation professionnelle.', filigrane: 'diplome' },
  { nombre: null, enLettres: 'Un', libelle: 'Jeune orphelin', texte: 'Bénéficie d’une opération chirurgicale après 3 ans de maladie.', filigrane: 'sante' },
];

function Impact({ impact, rang, demarre }) {
  const valeur = useCompteur(impact.nombre ?? 0, demarre);
  return (
    <li className="impact" style={{ '--rang': rang }}>
      <svg className="impact__filigrane" viewBox="0 0 24 24" aria-hidden="true">
        {FILIGRANES[impact.filigrane]}
      </svg>
      <p className="impact__chiffre">
        {/* Le lecteur d'ecran lit la valeur finale, pas le decompte. */}
        <span aria-hidden="true">{impact.nombre === null ? impact.enLettres : valeur}</span>
        <span className="sr-only">{impact.nombre === null ? impact.enLettres : impact.nombre}</span>
      </p>
      <h3 className="impact__libelle">{impact.libelle}</h3>
      <p className="impact__texte">{impact.texte}</p>
    </li>
  );
}

function Impacts() {
  const [ref, vu] = useApparition({ seuil: 0.25 });
  return (
    <section
      ref={ref}
      className={`accueil-impacts${vu ? ' accueil-impacts--vu' : ''}`}
      aria-labelledby="accueil-impacts-titre"
    >
      <span className="accueil-impacts__halo" aria-hidden="true" />
      <h2 className="accueil-section__titre accueil-section__titre--clair" id="accueil-impacts-titre">
        Nos impacts
      </h2>
      <ul className="accueil-impacts__grille">
        {IMPACTS.map((impact, rang) => (
          <Impact key={impact.libelle} impact={impact} rang={rang} demarre={vu} />
        ))}
      </ul>
    </section>
  );
}

export default function Accueil() {
  return (
    <>
      <Hero />
      <Activites />
      <Impacts />
      <Realisations />
      <ActualitesAccueil />
      <Partenaires />
      <Contribuer />
    </>
  );
}
