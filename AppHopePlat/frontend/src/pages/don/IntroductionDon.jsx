import { Link } from 'react-router-dom';

import mainCoeur from '../../assets/vitrine/icones/main-coeur.png';
import { IconeFleche } from '../../components/HopeIcons.jsx';
import { useCompteur } from '../../hooks/useApparition.js';

/**
 * L'introduction du don sans compte (pages/don/DonSansCompte.jsx) : avant
 * de demander quoi que ce soit, dire en un ecran a quoi sert le geste,
 * comment il se passe en trois etapes, et ce qui le rend sur.
 *
 * Tout entre en scene l'un apres l'autre ; les rayons du soleil tournent
 * lentement autour de la main qui tend un coeur (visuel fourni par
 * HOPE), les deux chiffres se comptent sous les yeux. Le
 * visiteur qui a demande moins de mouvement voit tout en place, d'un coup
 * (don-invite.css, prefers-reduced-motion).
 *
 * Les chiffres sont ceux que le site affiche dans "Nos impacts".
 */

const ETAPES = [
  { numero: 1, titre: 'Vous vous présentez', texte: 'Votre nom et votre courriel, pour le reçu.' },
  { numero: 2, titre: 'Vous choisissez', texte: 'Un projet précis, ou le fonds HOPE.' },
  { numero: 3, titre: 'Vous payez à votre façon', texte: 'MVola, Orange Money, carte, virement…' },
];

const GAGES = ['Sans créer de compte', 'Confirmé par l’équipe HOPE', 'Reçu par courriel'];

/** Un chiffre qui monte de zero a sa valeur, des l'ouverture. */
function Chiffre({ valeur, libelle, rang }) {
  const compte = useCompteur(valeur, true, 1500);
  return (
    <div className="don-intro__chiffre" style={{ '--rang': rang }}>
      <dt className="don-intro__nombre">
        <span aria-hidden="true">{compte}</span>
        <span className="sr-only">{valeur}</span>
      </dt>
      <dd className="don-intro__libelle">{libelle}</dd>
    </div>
  );
}

export default function IntroductionDon({ onCommencer }) {
  return (
    <section className="don-intro" aria-labelledby="don-intro-titre">
      {/* Le soleil : la couronne de rayons tourne autour du disque. */}
      <div className="don-intro__soleil" style={{ '--rang': 0 }} aria-hidden="true">
        <span className="don-intro__halo" />
        <svg className="don-intro__couronne" viewBox="-64 -64 128 128">
          {Array.from({ length: 12 }, (_, i) => i * 30).map((angle) => (
            <rect
              key={angle}
              x="-3.2"
              y="-63"
              width="6.4"
              height="13"
              rx="3.2"
              transform={angle === 0 ? undefined : `rotate(${angle})`}
            />
          ))}
        </svg>
        <span className="don-intro__coeur">
          <img src={mainCoeur} alt="" />
        </span>
      </div>

      <p className="don-intro__sur-titre" style={{ '--rang': 1 }}>
        Faire un don
      </p>
      <h1 className="don-intro__titre" id="don-intro-titre" style={{ '--rang': 2 }}>
        Votre geste change une vie
      </h1>
      <p className="don-intro__texte" style={{ '--rang': 3 }}>
        En quelques minutes, sans créer de compte, votre don rejoint les enfants orphelins et les mères célibataires
        que HOPE accompagne à Madagascar.
      </p>

      <ol className="don-intro__etapes" style={{ '--rang': 4 }} aria-label="Comment ça se passe">
        {ETAPES.map((etape, rang) => (
          <li key={etape.numero} className="don-intro__etape" style={{ '--rang': rang }}>
            <span className="don-intro__numero" aria-hidden="true">
              {etape.numero}
            </span>
            <span className="don-intro__etape-titre">{etape.titre}</span>
            <span className="don-intro__etape-texte">{etape.texte}</span>
          </li>
        ))}
      </ol>

      <dl className="don-intro__chiffres" style={{ '--rang': 5 }}>
        <Chiffre valeur={300} libelle="enfants orphelins soutenus" rang={0} />
        <Chiffre valeur={100} libelle="mères célibataires accompagnées" rang={1} />
      </dl>

      <ul className="don-intro__gages" style={{ '--rang': 6 }} aria-label="Ce qui vous est garanti">
        {GAGES.map((gage) => (
          <li key={gage} className="don-intro__gage">
            {gage}
          </li>
        ))}
      </ul>

      <button type="button" className="parcours__continuer don-intro__bouton" style={{ '--rang': 7 }} onClick={onCommencer}>
        Commencer mon don
        <IconeFleche className="parcours__fleche" />
      </button>
      <p className="don-intro__compte" style={{ '--rang': 8 }}>
        Vous avez déjà un compte ? <Link to="/authentification">Se connecter</Link>
      </p>
    </section>
  );
}
