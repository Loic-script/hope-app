import { Link } from 'react-router-dom';

import appel from '../../assets/vitrine/engager-appel.jpg';
import couverture from '../../assets/vitrine/engager-couverture.jpg';
import Medaillon from '../../components/vitrine/Medaillon.jsx';
import { IconeBatiment, IconeGroupe, IconeReseau } from '../../components/vitrine/icones.jsx';
import { LIEN_DON } from '../../components/vitrine/liens.js';
import { useApparition } from '../../hooks/useApparition.js';

/**
 * "S'engager" : le bandeau des mains reunies, les trois voies pour
 * rejoindre HOPE en cartes a medaillon, puis l'appel a contribuer.
 */

/** Devenir partenaire : l'inscription d'un bailleur, validee ensuite par HOPE. */
const LIEN_PARTENAIRE = '/authentification?type=bailleur';

const VOIES = [
  {
    cle: 'organismes',
    titre: 'Organismes & Réseaux d’aide',
    texte: 'Tissons des partenariats humains et transparents pour démultiplier notre impact sur le terrain malgache.',
    icone: <IconeReseau />,
    echelle: 0.62,
  },
  {
    cle: 'entreprises',
    titre: 'Entreprises & Fondations',
    texte:
      'Donnez du sens à vos actions en soutenant des projets d’éducation et d’autonomisation des femmes qui transforment directement des vies.',
    icone: <IconeBatiment creux="v-medaillon__creux" />,
    echelle: 0.72,
  },
  {
    cle: 'donateurs',
    titre: 'Donateurs & Bénévoles',
    texte:
      'Votre temps, vos dons ou vos encouragements sont les étincelles qui permettent à une mère et son enfant de se relever.',
    icone: <IconeGroupe creux="v-medaillon__creux" />,
    echelle: 0.72,
  },
];

export default function SEngager() {
  const [refVoies, voiesVues] = useApparition({ seuil: 0.2 });
  const [refAppel, appelVu] = useApparition({ seuil: 0.3 });

  return (
    <>
      <section className="engager-hero" aria-labelledby="engager-hero-titre">
        <img className="engager-hero__photo" src={couverture} alt="" fetchPriority="high" />
        <div className="engager-hero__voile" aria-hidden="true" />
        <div className="v-conteneur engager-hero__contenu">
          <h1 className="engager-hero__titre" id="engager-hero-titre">
            <span className="engager-hero__ligne">Ensemble,</span>
            <span className="engager-hero__ligne">écrivons une plus belle histoire.</span>
          </h1>
          <div className="engager-hero__ligne-texte">
            {/* Le soleil de la charte (assets/soleil.svg), en tete du texte comme sur la maquette. */}
            <span className="engager-hero__soleil" aria-hidden="true" />
            <p className="engager-hero__texte">
              Que vous soyez une institution, une entreprise engagée ou un particulier au cœur généreux, votre présence
              à nos côtés change tout. C’est grâce à cette union que l’espoir prend vie.
            </p>
          </div>
        </div>
      </section>

      {/* Les trois voies chevauchent le bas du bandeau, leur medaillon en tete. */}
      <section ref={refVoies} className={`engager-voies${voiesVues ? ' v-apparu' : ''}`} aria-label="Trois façons de s’engager">
        <ul className="engager-cartes">
          {VOIES.map((voie, rang) => (
            <li key={voie.cle} className={`engager-carte engager-carte--${voie.cle} v-entree`} style={{ '--rang': rang }}>
              <Medaillon className="engager-carte__medaillon" variante="eventail" echelle={voie.echelle}>
                {voie.icone}
              </Medaillon>
              <h2 className="engager-carte__titre">{voie.titre}</h2>
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
          <div className="engager-appel__ligne v-entree" style={{ '--rang': 1 }}>
            <span className="engager-hero__soleil engager-appel__soleil" aria-hidden="true" />
            <p className="engager-appel__texte">
              L’espoir commence par une intention, mais il se réalise par l’action. Rejoignez Hope for a Better Life et
              devenez l’acteur d’un changement durable.
            </p>
          </div>
          <div className="engager-appel__actions v-entree" style={{ '--rang': 2 }}>
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
