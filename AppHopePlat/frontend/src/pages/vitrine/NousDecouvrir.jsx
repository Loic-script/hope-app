import { Link } from 'react-router-dom';

import enfantTentes from '../../assets/vitrine/enfant-tentes.jpg';
import quiSommesNous from '../../assets/vitrine/qui-sommes-nous.jpg';
import iconeAmpoule from '../../assets/vitrine/icones/ampoule.png';
import { IconeDiplome, IconeFormation, IconeMallette } from '../../components/vitrine/icones.jsx';
import Medaillon from '../../components/vitrine/Medaillon.jsx';
import { LIEN_DON } from '../../components/vitrine/liens.js';
import { useApparition } from '../../hooks/useApparition.js';
import EquipeHope from './EquipeHope.jsx';

/**
 * "Nous decouvrir" : qui est HOPE, sa raison d'etre, sa vision, sa
 * mission, son approche et ce qui la distingue.
 *
 * Chaque section entre en scene quand elle arrive a l'ecran
 * (useApparition) ; tout s'arrete si le visiteur a demande moins de
 * mouvement.
 */

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

/* Les deux textes se suivent dans une seule carte violette, coiffee de
   l'ampoule ; la section tient sur un ecran (vitrine-decouvrir.css). */
const BLOCS = [
  {
    cle: 'raison',
    titre: 'Notre Raison d’Être',
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
    paragraphes: [
      'Un monde où l’origine sociale ne détermine plus le destin d’un enfant ou d’une mère. Nous aspirons à une société où chaque personne accompagnée réécrit son histoire et accède à un avenir radieux, libre et autonome.',
    ],
  },
];

function RaisonEtVision() {
  const [ref, vu] = useApparition({ seuil: 0.1 });
  return (
    <section ref={ref} className={`decouvrir-cartes${vu ? ' v-apparu' : ''}`} aria-label="Notre raison d’être et notre vision">
      <article className="decouvrir-carte" style={{ '--rang': 0 }}>
        <Medaillon className="decouvrir-carte__medaillon" image={{ src: iconeAmpoule, largeur: 21.7, hauteur: 31 }} />
        <div className="decouvrir-carte__corps">
          {BLOCS.map((bloc) => (
            <div key={bloc.cle} className="decouvrir-carte__bloc">
              <h2 className="decouvrir-carte__titre">{bloc.titre}</h2>
              {bloc.paragraphes.map((texte) => (
                <p key={texte.slice(0, 32)} className="decouvrir-carte__texte">
                  {texte}
                </p>
              ))}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

/* ============================ Notre mission ============================ */

const MISSION = [
  {
    cle: 'education',
    icone: <IconeDiplome />,
    echelle: 0.67,
    titre: 'L’éducation de qualité pour les enfants,',
    texte: 'pour les enfants, afin de poser les bases d’un développement solide.',
  },
  {
    cle: 'formation',
    icone: <IconeFormation creux="v-medaillon__creux" />,
    echelle: 0.55,
    titre: 'La formation professionnelle et l’acquisition de compétences',
    texte: 'pour les mères, adaptées aux réalités du marché du travail local.',
  },
  {
    cle: 'insertion',
    icone: <IconeMallette creux="v-medaillon__creux" />,
    echelle: 0.9,
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
        {/* La ligne violette court d'un bord a l'autre derriere les trois
            medaillons, qui l'interrompent de leur disque blanc. */}
        <ul className="decouvrir-mission__liste">
          {MISSION.map((etape, rang) => (
            <li key={etape.cle} className={`decouvrir-etape decouvrir-etape--${etape.cle}`} style={{ '--rang': rang }}>
              <Medaillon className="decouvrir-etape__medaillon" variante="rayons" echelle={etape.echelle}>
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
      <EquipeHope />
    </>
  );
}
