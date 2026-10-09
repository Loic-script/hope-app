import { Link } from 'react-router-dom';

import appel from '../../assets/vitrine/engager-appel.jpg';
import couverture from '../../assets/vitrine/engager-couverture.jpg';
import { IconeBatiment, IconeGroupe, IconeReseau } from '../../components/vitrine/icones.jsx';
import { LIEN_DON } from '../../components/vitrine/liens.js';
import { useApparition } from '../../hooks/useApparition.js';

const LIEN_PARTENAIRE = '/authentification?type=bailleur';

const VOIES = [
  {
    cle: 'organismes',
    titre: ['Organismes &', 'Réseaux d’aide'],
    texte: 'Tissons des partenariats humains et transparents pour démultiplier notre impact sur le terrain malgache.',
    icone: <IconeReseau />,
  },
  {
    cle: 'entreprises',
    titre: ['Entreprises &', 'Fondations'],
    texte:
      'Donnez du sens à vos actions en soutenant des projets d’éducation et d’autonomisation des femmes qui transforment directement des vies.',
    icone: <IconeBatiment creux="engager-soleil__creux" />,
  },
  {
    cle: 'donateurs',
    titre: ['Donateurs &', 'Bénévoles'],
    texte:
      'Votre temps, vos dons ou vos encouragements sont les étincelles qui permettent à une mère et son enfant de se relever.',
    icone: <IconeGroupe creux="engager-soleil__creux" />,
  },
];

const RAYONS = [
  { cle: 'gauche', x: 70.6, y: 37.1, angle: -36.8 },
  { cle: 'milieu', x: 122, y: 16.5, angle: 0 },
  { cle: 'droite', x: 173.4, y: 37.1, angle: 36.8 },
];

function SoleilCarte({ children }) {
  return (
    <svg className="engager-soleil" viewBox="0 0 244 124" aria-hidden="true">
      {RAYONS.map((r, i) => (
        <g key={r.cle} transform={`translate(${r.x} ${r.y})${r.angle ? ` rotate(${r.angle})` : ''}`}>
          <g className="engager-soleil__rayon" style={{ '--i': i }}>
            <rect className="engager-soleil__rayon-vif" x="-5.7" y="-16.3" width="11.4" height="32.6" rx="5.7" />
          </g>
        </g>
      ))}
      <rect className="engager-soleil__barre engager-soleil__barre--gauche" x="13" y="65" width="57" height="12" rx="6" />
      <rect className="engager-soleil__barre engager-soleil__barre--droite" x="174" y="65" width="57" height="12" rx="6" />
      <g className="engager-soleil__coeur">
        <circle className="engager-soleil__anneau" cx="122" cy="82.5" r="37.1" />
        <g className="engager-soleil__icone" transform="translate(122 82.5)">
          {children}
        </g>
      </g>
    </svg>
  );
}

export default function SEngager() {
  const [refVoies, voiesVues] = useApparition({ seuil: 0.2 });
  const [refAppel, appelVu] = useApparition({ seuil: 0.3 });

  return (
    <>
      <section className="engager-hero" aria-labelledby="engager-hero-titre">
        <img className="engager-hero__photo" src={couverture} alt="" fetchPriority="high" />
        <div className="engager-hero__voile" aria-hidden="true" />
        <div className="v-conteneur engager-hero__contenu">
          <div className="engager-hero__bloc">
            <h1 className="engager-hero__titre" id="engager-hero-titre">
              <span className="engager-hero__ligne">Ensemble,</span>
              <span className="engager-hero__ligne">écrivons une plus belle histoire.</span>
            </h1>
            <div className="engager-hero__trait" aria-hidden="true" />
            <p className="engager-hero__texte">
              Que vous soyez <strong>une institution</strong>, <strong>une entreprise</strong> engagée ou{' '}
              <strong>un particulier</strong> au cœur généreux, votre présence à nos côtés change tout. C’est grâce à
              cette union que l’espoir prend vie.
            </p>
          </div>
        </div>
      </section>

      <section ref={refVoies} className={`engager-voies${voiesVues ? ' v-apparu' : ''}`} aria-label="Trois façons de s’engager">
        <ul className="engager-cartes">
          {VOIES.map((voie, rang) => (
            <li key={voie.cle} className={`engager-carte engager-carte--${voie.cle} v-entree`} style={{ '--rang': rang }}>
              <span className="engager-carte__fond" aria-hidden="true" />
              <SoleilCarte>{voie.icone}</SoleilCarte>
              <h2 className="engager-carte__titre">
                {voie.titre.map((ligne) => (
                  <span key={ligne}>{ligne}</span>
                ))}
              </h2>
              <p className="engager-carte__texte">{voie.texte}</p>
            </li>
          ))}
        </ul>
      </section>

      <section ref={refAppel} className={`engager-appel${appelVu ? ' v-apparu' : ''}`} aria-labelledby="engager-appel-titre">
        <img className="engager-appel__photo" src={appel} alt="" loading="lazy" />
        <div className="engager-appel__voile" aria-hidden="true" />
        <div className="v-conteneur engager-appel__contenu">
          <h2 className="engager-appel__titre v-entree" id="engager-appel-titre" style={{ '--rang': 0 }}>
            <span>Vous souhaitez contribuer pour</span>
            <span>
              <strong>aider une vie</strong> dès aujourd’hui{' '}?
            </span>
          </h2>
          <div className="engager-appel__trait v-entree" aria-hidden="true" style={{ '--rang': 1 }} />
          <p className="engager-appel__texte v-entree" style={{ '--rang': 2 }}>
            L’espoir commence par une intention, mais il se réalise par l’action. Rejoignez{' '}
            <span className="engager-appel__marque">Hope for a Better Life</span> et devenez l’acteur d’un changement
            durable.
          </p>
          <div className="engager-appel__actions v-entree" style={{ '--rang': 3 }}>
            <Link to={LIEN_DON} className="accueil-bouton accueil-bouton--orange">
              Faire un don
            </Link>
            <Link to={LIEN_PARTENAIRE} className="accueil-bouton accueil-bouton--violet">
              Devenir partenaire
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
