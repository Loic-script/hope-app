import { Link } from 'react-router-dom';

import couverture from '../../assets/hope-couverture.jpg';
import filigraneDiplome from '../../assets/vitrine/impact-diplome.png';
import filigraneEmploi from '../../assets/vitrine/impact-emploi.png';
import filigraneFournitures from '../../assets/vitrine/impact-fournitures.png';
import filigraneSante from '../../assets/vitrine/impact-sante.png';
import { IconeCoeurPouls, IconeCouvert, IconeDiplome, IconeMallette } from '../../components/vitrine/icones.jsx';
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
        {/* Le trait de la charte, comme sur la page d'authentification :
            la barre bleue et le soleil officiel, coupole en haut. */}
        <div className="trait-hope accueil-hero__trait" aria-hidden="true" />
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

/* Les icones des medaillons vivent dans components/vitrine/icones.jsx :
   la page "Nous decouvrir" reprend le diplome et la mallette. */
const ICONES = {
  scolarite: <IconeDiplome />,
  employabilite: <IconeMallette />,
  soins: <IconeCoeurPouls />,
  alimentation: <IconeCouvert />,
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

/**
 * Le soleil qui coiffe une carte, releve sur la maquette : trois rayons,
 * un anneau autour de l'icone, et un disque blanc qui creuse une encoche
 * dans le haut de la carte. Les deux barres d'horizon sont a part
 * (.v-activite__barre) : elles s'etirent jusqu'aux bords de la carte.
 */
function Soleil({ cle }) {
  return (
    <svg className="v-activite__soleil" viewBox="-50 -60 100 98" aria-hidden="true">
      <g className="v-activite__rayons">
        <g className="v-activite__rayons-vif">
          <rect x="-4.3" y="-56.05" width="8.6" height="22.3" rx="4.3" />
          <rect x="-39.2" y="-41.85" width="8.6" height="22.3" rx="4.3" transform="rotate(-37 -34.9 -30.7)" />
          <rect x="30.6" y="-41.85" width="8.6" height="22.3" rx="4.3" transform="rotate(37 34.9 -30.7)" />
        </g>
      </g>
      <circle className="v-activite__halo" r="36.8" />
      <circle className="v-activite__anneau" r="25.4" />
      <g className="v-activite__icone">
        <g className="v-activite__icone-vif">{ICONES[cle]}</g>
      </g>
    </svg>
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
            <div className="v-activite__cadre">
              <span className="v-activite__barre v-activite__barre--gauche" aria-hidden="true" />
              <span className="v-activite__barre v-activite__barre--droite" aria-hidden="true" />
              <Soleil cle={a.cle} />
              <article className="v-activite__carte">
                <h3 className="v-activite__titre">{a.titre}</h3>
                <p className="v-activite__texte">{a.texte}</p>
              </article>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ============================ Les impacts ============================ */

/*
 * Les icones en filigrane, fournies par HOPE : blanches, deja
 * transparentes (10 % environ). `largeur` est leur taille naturelle, celle
 * de la maquette sur grand ecran ; elles retrecissent avec l'ecran.
 */
const IMPACTS = [
  {
    nombre: 300,
    libelle: 'Enfants orphelins',
    texte: 'Bénéficient de nos fournitures scolaires.',
    filigrane: { src: filigraneFournitures, largeur: 206 },
  },
  {
    nombre: 100,
    libelle: 'Mères célibataires',
    texte: 'Bénéficient de produits de première nécessité (PPN) et de formations professionnelles.',
    filigrane: { src: filigraneEmploi, largeur: 260 },
  },
  {
    nombre: 5,
    libelle: 'Orphelins',
    texte: 'Profitent d’un appui éducatif durable et d’une formation professionnelle.',
    filigrane: { src: filigraneDiplome, largeur: 260 },
  },
  {
    nombre: null,
    enLettres: 'Un',
    libelle: 'Jeune orphelin',
    texte: 'Bénéficie d’une opération chirurgicale après 3 ans de maladie.',
    filigrane: { src: filigraneSante, largeur: 260 },
  },
];

function Impact({ impact, rang, demarre }) {
  const valeur = useCompteur(impact.nombre ?? 0, demarre);
  return (
    <li className="impact" style={{ '--rang': rang }}>
      <img
        className="impact__filigrane"
        src={impact.filigrane.src}
        alt=""
        aria-hidden="true"
        style={{ '--largeur': impact.filigrane.largeur }}
      />
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
