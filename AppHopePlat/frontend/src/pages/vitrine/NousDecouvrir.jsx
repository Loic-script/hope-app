import { Link } from 'react-router-dom';

import enfantTentes from '../../assets/vitrine/enfant-tentes.jpg';
import quiSommesNous from '../../assets/vitrine/qui-sommes-nous.jpg';
import iconeAmpoule from '../../assets/vitrine/icones/ampoule.png';
import iconeCible from '../../assets/vitrine/icones/cible.png';
import { IconeDiplome, IconeFormation, IconeMallette } from '../../components/vitrine/icones.jsx';
import { LIEN_DON } from '../../components/vitrine/liens.js';
import { useApparition } from '../../hooks/useApparition.js';

/**
 * "Nous decouvrir" : qui est HOPE, sa raison d'etre, sa vision, sa
 * mission, son approche et ce qui la distingue.
 *
 * Chaque section entre en scene quand elle arrive a l'ecran
 * (useApparition) ; tout s'arrete si le visiteur a demande moins de
 * mouvement.
 */

/**
 * Le medaillon des sections : un anneau jaune, l'icone au centre, et le
 * soleil autour. Deux soleils, releves sur les maquettes :
 *   - `couronne` : huit traits repartis tous les 30 degres, le quart
 *     bas-droit reste vide -- c'est le cote de la carte (raison d'etre,
 *     vision) ;
 *   - `rayons` : trois rayons en haut, comme sur l'accueil (mission).
 *
 * L'icone est soit un dessin (children), soit un fichier fourni par HOPE
 * (`image` : { src, largeur, hauteur } en unites du medaillon, l'anneau
 * exterieur valant 28,5).
 */
function Medaillon({ children, image = null, variante = 'couronne', className = '' }) {
  return (
    <span className={`v-medaillon ${className}`.trim()} aria-hidden="true">
      <svg className="v-medaillon__soleil" viewBox="-50 -50 100 100">
        <g className="v-medaillon__rayons">
          {variante === 'couronne' ? (
            <>
              <rect x="-2.3" y="-47.6" width="4.6" height="11.7" rx="2.3" />
              <rect x="-2.3" y="-47.6" width="4.6" height="11.7" rx="2.3" transform="rotate(30)" />
              <rect x="-2.3" y="-47.6" width="4.6" height="11.7" rx="2.3" transform="rotate(60)" />
              <rect x="-2.3" y="-47.6" width="4.6" height="11.7" rx="2.3" transform="rotate(210)" />
              <rect x="-2.3" y="-47.6" width="4.6" height="11.7" rx="2.3" transform="rotate(240)" />
              <rect x="-2.3" y="-47.6" width="4.6" height="11.7" rx="2.3" transform="rotate(270)" />
              <rect x="-2.3" y="-47.6" width="4.6" height="11.7" rx="2.3" transform="rotate(300)" />
              <rect x="-2.3" y="-47.6" width="4.6" height="11.7" rx="2.3" transform="rotate(330)" />
            </>
          ) : (
            <>
              <rect x="-2.9" y="-48.3" width="5.8" height="12.4" rx="2.9" />
              <rect x="-2.9" y="-48.3" width="5.8" height="12.4" rx="2.9" transform="rotate(-37)" />
              <rect x="-2.9" y="-48.3" width="5.8" height="12.4" rx="2.9" transform="rotate(37)" />
            </>
          )}
        </g>
        {/* Le disque blanc, jusqu'au depart des traits : pose sur une carte,
            il en creuse le coin (l'encoche des maquettes). */}
        <circle className="v-medaillon__halo" r="35.9" />
        <circle className="v-medaillon__anneau" r="26.3" />
        <g className="v-medaillon__icone">
          {image ? (
            <image href={image.src} x={-image.largeur / 2} y={-image.hauteur / 2} width={image.largeur} height={image.hauteur} />
          ) : (
            children
          )}
        </g>
      </svg>
    </span>
  );
}

/* ============================ Qui sommes-nous ============================ */

function QuiSommesNous() {
  return (
    <section className="decouvrir-hero" aria-labelledby="decouvrir-hero-titre">
      <img className="decouvrir-hero__photo" src={quiSommesNous} alt="" fetchPriority="high" />
      <div className="decouvrir-hero__voile" aria-hidden="true" />
      <div className="decouvrir-hero__contenu">
        <h1 className="decouvrir-hero__titre" id="decouvrir-hero-titre">
          Qui sommes-nous ?
        </h1>
        <div className="trait-hope trait-hope--renverse decouvrir-hero__trait" aria-hidden="true" />
        <p className="decouvrir-hero__texte">
          Fondée en 2023, HOPE FOR A BETTER LIFE est une association à but non lucratif dédiée à transformer la
          vie des orphelins et des mères célibataires. Nous croyons fermement au potentiel humain et œuvrons
          pour offrir un accompagnement global – financier, matériel, moral et spirituel – aux personnes les
          plus vulnérables de notre société.
        </p>
        <Link to={LIEN_DON} className="accueil-bouton accueil-bouton--orange decouvrir-hero__don">
          Faire un don
        </Link>
      </div>
    </section>
  );
}

/* ======================= Raison d'etre et vision ======================= */

const CARTES = [
  {
    cle: 'raison',
    titre: 'Notre Raison d’Être',
    image: { src: iconeAmpoule, largeur: 21.7, hauteur: 31 },
    paragraphes: [
      'Parce que chaque histoire mérite une deuxième chance.',
      'Derrière chaque regard d’enfant et chaque combat de mère célibataire, il y a une force incroyable qui ne demande qu’à éclore. À Madagascar, la précarité isole, mais l’amour et l’accompagnement créent des miracles.',
      'Chez Hope for a Better Life, nous croyons fermement qu’une aide réussie ne se contente pas de secourir : elle transforme. Nous ne venons pas simplement apporter un soutien ponctuel, nous marchons aux côtés des mères et des enfants pour leur redonner confiance, dignité et moyens d’agir.',
      'Nous intervenons là où la vulnérabilité menace les trajectoires de vie, en offrant un accompagnement complet, rigoureux et personnalisé.',
    ],
  },
  {
    cle: 'vision',
    titre: 'Notre Vision',
    image: { src: iconeCible, largeur: 31, hauteur: 31 },
    paragraphes: [
      'Un monde où l’origine sociale ne détermine plus le destin d’un enfant ou d’une mère. Nous aspirons à une société où chaque personne accompagnée réécrit son histoire et accède à un avenir radieux, libre et autonome.',
    ],
  },
];

function RaisonEtVision() {
  const [ref, vu] = useApparition({ seuil: 0.1 });
  return (
    <section ref={ref} className={`decouvrir-cartes${vu ? ' v-apparu' : ''}`} aria-label="Notre raison d’être et notre vision">
      {CARTES.map((carte, rang) => (
        <article key={carte.cle} className={`decouvrir-carte decouvrir-carte--${carte.cle}`} style={{ '--rang': rang }}>
          <Medaillon className="decouvrir-carte__medaillon" image={carte.image} />
          <div className="decouvrir-carte__corps">
            <h2 className="decouvrir-carte__titre">{carte.titre}</h2>
            {carte.paragraphes.map((texte) => (
              <p key={texte.slice(0, 32)} className="decouvrir-carte__texte">
                {texte}
              </p>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

/* ============================ Notre mission ============================ */

const MISSION = [
  {
    cle: 'education',
    icone: <IconeDiplome />,
    titre: 'L’éducation de qualité pour les enfants,',
    texte: 'pour les enfants, afin de poser les bases d’un développement solide.',
  },
  {
    cle: 'formation',
    icone: <IconeFormation />,
    titre: 'La formation professionnelle et l’acquisition de compétences',
    texte: 'pour les mères, adaptées aux réalités du marché du travail local.',
  },
  {
    cle: 'insertion',
    icone: <IconeMallette creux="v-medaillon__creux" />,
    titre: 'L’insertion professionnelle et l’emploi',
    texte: 'assorties d’un suivi rapproché pour mesurer et garantir les progrès de chacun.',
  },
];

function NotreMission() {
  const [ref, vu] = useApparition({ seuil: 0.15 });
  return (
    <section ref={ref} className={`decouvrir-mission${vu ? ' v-apparu' : ''}`} aria-labelledby="decouvrir-mission-titre">
      <div className="v-conteneur">
        <h2 className="accueil-section__titre" id="decouvrir-mission-titre">
          Notre Mission
        </h2>
        <p className="decouvrir-mission__accroche">
          Éclairer, former et accompagner les orphelins et mères célibataires de Madagascar vers une autonomie
          durable. Nous concrétisons cet engagement en garantissant un accès direct à :
        </p>
        <ul className="decouvrir-mission__liste">
          {MISSION.map((etape, rang) => (
            <li key={etape.cle} className={`decouvrir-etape decouvrir-etape--${etape.cle}`} style={{ '--rang': rang }}>
              <span className="decouvrir-etape__barre decouvrir-etape__barre--gauche" aria-hidden="true" />
              <span className="decouvrir-etape__barre decouvrir-etape__barre--droite" aria-hidden="true" />
              <Medaillon className="decouvrir-etape__medaillon" variante="rayons">
                {etape.icone}
              </Medaillon>
              <h3 className="decouvrir-etape__titre">{etape.titre}</h3>
              <p className="decouvrir-etape__texte">{etape.texte}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ============================ Notre approche ============================ */

function NotreApproche() {
  const [ref, vu] = useApparition({ seuil: 0.2 });
  return (
    <section ref={ref} className={`decouvrir-approche${vu ? ' v-apparu' : ''}`} aria-labelledby="decouvrir-approche-titre">
      <img className="decouvrir-approche__photo" src={enfantTentes} alt="" loading="lazy" />
      <div className="decouvrir-approche__voile" aria-hidden="true" />
      <div className="decouvrir-approche__contenu">
        <h2 className="sr-only" id="decouvrir-approche-titre">
          Notre approche
        </h2>
        <p className="decouvrir-approche__texte">
          Chez Hope for a Better Life, nous mettons en œuvre une approche globale et humaine pour répondre aux
          besoins essentiels des orphelins et des mères célibataires à Madagascar. Chaque action que nous menons
          reflète notre engagement à leur offrir un avenir meilleur et à les accompagner vers une autonomie
          durable.
        </p>
        <Link to={LIEN_DON} className="accueil-bouton accueil-bouton--bleu">
          Faire un don
        </Link>
      </div>
    </section>
  );
}

/* =========================== Notre difference =========================== */

const PILIERS = [
  {
    pilier: 'Protéger & Prendre en charge',
    engagement: 'Offrir un environnement sécurisant, bienveillant et structuré dès les premiers jours de l’accompagnement.',
  },
  {
    pilier: 'Former pour Transformer',
    engagement: 'Remplacer l’assistance ponctuelle par l’apprentissage de métiers porteurs et l’accès à l’école.',
  },
  {
    pilier: 'Accompagner pas à pas',
    engagement: 'Assurer un suivi individuel et régulier de chaque bénéficiaire jusqu’à son insertion réussie.',
  },
  {
    pilier: 'Mesurer l’Impact',
    engagement: 'Évaluer avec précision l’évolution des conditions de vie et garantir la transparence de nos résultats.',
  },
];

function NotreDifference() {
  const [ref, vu] = useApparition({ seuil: 0.15 });
  return (
    <section ref={ref} className={`decouvrir-difference${vu ? ' v-apparu' : ''}`} aria-labelledby="decouvrir-difference-titre">
      <div className="v-conteneur">
        <h2 className="accueil-section__titre" id="decouvrir-difference-titre">
          Notre Différence : L’Engagement de l’Autonomie
        </h2>
        <p className="decouvrir-difference__accroche">Pourquoi soutenir Hope for a Better Life ?</p>
        <div className="decouvrir-tableau__cadre">
          <table className="decouvrir-tableau">
            <thead>
              <tr>
                <th scope="col">Notre Pilier</th>
                <th scope="col">Notre Engagement Sur le Terrain</th>
              </tr>
            </thead>
            <tbody>
              {PILIERS.map((ligne, rang) => (
                <tr key={ligne.pilier} style={{ '--rang': rang }}>
                  <th scope="row">{ligne.pilier}</th>
                  <td>{ligne.engagement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default function NousDecouvrir() {
  return (
    <>
      <QuiSommesNous />
      <RaisonEtVision />
      <NotreMission />
      <NotreApproche />
      <NotreDifference />
    </>
  );
}
