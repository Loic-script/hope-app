import { Link } from 'react-router-dom';

import couverture from '../../assets/hope-couverture.jpg';
import filigraneDiplome from '../../assets/vitrine/impact-diplome.png';
import filigraneEmploi from '../../assets/vitrine/impact-emploi.png';
import filigraneFournitures from '../../assets/vitrine/impact-fournitures.png';
import filigraneSante from '../../assets/vitrine/impact-sante.png';
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

/*
 * Les icones du medaillon, pleines comme sur la maquette. Elles sont
 * dessinees dans le repere du medaillon : l'origine (0, 0) est son centre,
 * l'unite est celle de la maquette (une carte fait 167 unites de large).
 * Les details blancs (.v-activite__creux) sont des creux dans la forme.
 */
const ICONES = {
  // Le mortier du diplome : le plateau, la calotte, le gland.
  scolarite: (
    <>
      <path d="M-14.5 -3.8 0 -10.4 14.5 -3.8 0 2.7Z" />
      <path d="M-9.6 -0.2 0 4.2 9.6 -0.2C9.6 6.2 5.6 10.3 0 10.3S-9.6 6.2-9.6 -0.2Z" />
      <path d="M-14.3 -3.3H-12.6V3L-12.1 5.4H-14.8L-14.3 3Z" />
    </>
  ),
  // La mallette, posee sur une main ouverte.
  employabilite: (
    <>
      <path d="M-0.3 -8.2V-10.6C-0.3 -12.2 0.7 -13.4 2.4 -13.4H4.6C6.3 -13.4 7.3 -12.2 7.3 -10.6V-8.2H5.6V-10.4C5.6 -11.3 5.2 -11.7 4.4 -11.7H2.6C1.8 -11.7 1.4 -11.3 1.4 -10.4V-8.2Z" />
      <rect x="-6" y="-8.2" width="18.5" height="11.6" rx="2.2" />
      <rect className="v-activite__creux" x="-6" y="-3.9" width="18.5" height="1.1" />
      <rect className="v-activite__creux" x="2.1" y="-4.9" width="2.8" height="3.1" rx="0.7" />
      <path d="M-13.5 7.4 -11 6.9V12.5L-13.5 12Z" />
      <path d="M-10.2 7.3C-8 7-6.4 7.6-4.8 8.3H1.4C2.6 8.3 2.6 9.9 1.4 9.9H-2.8V10.4H4.6C5 10.4 5.4 10.2 5.8 10L10.2 7C11.2 6.4 12.3 7.6 11.4 8.5L7.5 11.9C7 12.3 6.4 12.5 5.8 12.5H-10.2Z" />
    </>
  ),
  // Le coeur, traverse par le trace d'un pouls.
  soins: (
    <>
      <path d="M0 11.5C-5 7.8-12 3.4-12 -3.6-12 -8.4-8.6 -11.5-5 -11.5-2.6 -11.5-0.9 -10.2 0 -8.4 0.9 -10.2 2.6 -11.5 5 -11.5 8.6 -11.5 12 -8.4 12 -3.6 12 3.4 5 7.8 0 11.5Z" />
      <path className="v-activite__pouls" d="M-9.5 0.2H-4.4L-2.6 -3.8 0.4 4.4 2.4 -1 3.6 0.2H8" />
    </>
  ),
  // La fourchette, l'assiette et la cuillere.
  alimentation: (
    <>
      <rect x="-16.4" y="-8" width="1.15" height="5.8" rx="0.55" />
      <rect x="-15.07" y="-8" width="1.15" height="5.8" rx="0.55" />
      <rect x="-13.75" y="-8" width="1.15" height="5.8" rx="0.55" />
      <path d="M-16.4 -3.2H-12.6V-1.8C-12.6 -0.7-13.4 0-14.5 0S-16.4 -0.7-16.4 -1.8Z" />
      <rect x="-15.25" y="-1" width="1.5" height="12" rx="0.75" />
      <circle cx="0" cy="1.4" r="8.8" />
      <circle className="v-activite__creux" cx="0" cy="1.4" r="6.6" />
      <circle cx="0" cy="1.4" r="5.6" />
      <ellipse cx="14.3" cy="-4.4" rx="2.3" ry="3.6" />
      <rect x="13.55" y="-1.6" width="1.5" height="12.6" rx="0.75" />
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
