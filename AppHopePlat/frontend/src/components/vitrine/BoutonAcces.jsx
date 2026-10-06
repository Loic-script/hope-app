import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { IconeChevronBas, IconeCoeur, IconeUtilisateur } from '../HopeIcons.jsx';
import { LIEN_CONNEXION, LIEN_DON } from './liens.js';

/**
 * Le bouton d'acces de la barre du site : une seule forme orange pour
 * deux portes.
 *
 *   - la partie principale est un lien dont le mot change toutes les
 *     cinq secondes : "Faire un don", puis "Connexion", puis de nouveau
 *     le don, sans fin. Les lettres du mot qui part basculent et
 *     s'envolent une a une, celles du mot qui arrive se redressent en
 *     cascade, et un eclat traverse le bouton. Il mene la ou son mot le
 *     dit ;
 *   - la fleche ouvre un petit menu qui nomme les deux portes en clair,
 *     pour qui ne veut pas attendre le bon mot.
 *
 * Le defilement s'arrete des que la souris ou le clavier est sur le
 * bouton, et tant que le menu est ouvert : la cible ne doit pas bouger
 * sous la main. Moins de mouvement demande : le mot reste "Faire un
 * don", le menu suffit pour l'autre porte.
 *
 * Le menu se ferme a la touche Echap, d'un clic hors de lui, et au
 * changement de page.
 */

const OPTIONS = [
  { cle: 'don', libelle: 'Faire un don', to: LIEN_DON, Icone: IconeCoeur },
  { cle: 'connexion', libelle: 'Connexion', to: LIEN_CONNEXION, Icone: IconeUtilisateur },
];

/** Le temps qu'un mot reste affiche avant de laisser la place a l'autre. */
const CADENCE = 5000;
/** Le temps que le mot sortant finisse de s'envoler, lettre apres lettre (vitrine.css). */
const GLISSEMENT = 700;

/**
 * Un mot lettre par lettre, chacune avec son rang (--i) pour la cascade.
 * Les lettres sont cachees aux lecteurs d'ecran : le mot entier leur est
 * donne a part.
 */
function Lettres({ mot }) {
  return (
    <span className="vitrine-acces__lettres" aria-hidden="true">
      {[...mot].map((lettre, i) => (
        <span key={`${i}-${lettre}`} className="vitrine-acces__lettre" style={{ '--i': i }}>
          {lettre === ' ' ? ' ' : lettre}
        </span>
      ))}
    </span>
  );
}

function mouvementReduit() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default function BoutonAcces() {
  const emplacement = useLocation();
  const boite = useRef(null);
  const premierChoix = useRef(null);

  const [indice, setIndice] = useState(0);
  // Le mot qui s'en va, le temps de son glissement.
  const [sortant, setSortant] = useState(null);
  const [pause, setPause] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  const fige = pause || ouvert || mouvementReduit();

  // Le mot suivant, a la cadence, sauf quand on vise le bouton.
  useEffect(() => {
    if (fige) return undefined;
    const minuterie = setInterval(() => {
      setIndice((courant) => {
        setSortant(courant);
        return (courant + 1) % OPTIONS.length;
      });
    }, CADENCE);
    return () => clearInterval(minuterie);
  }, [fige]);

  // Le mot sorti disparait une fois son glissement fini.
  useEffect(() => {
    if (sortant === null) return undefined;
    const minuterie = setTimeout(() => setSortant(null), GLISSEMENT);
    return () => clearTimeout(minuterie);
  }, [sortant]);

  // Le menu se referme quand on change de page.
  useEffect(() => {
    setOuvert(false);
  }, [emplacement.pathname]);

  // Menu ouvert : le premier choix a le focus ; Echap ou un clic dehors le ferme.
  useEffect(() => {
    if (!ouvert) return undefined;
    premierChoix.current?.focus();
    const auClavier = (e) => e.key === 'Escape' && setOuvert(false);
    const auClic = (e) => boite.current && !boite.current.contains(e.target) && setOuvert(false);
    document.addEventListener('keydown', auClavier);
    document.addEventListener('pointerdown', auClic);
    return () => {
      document.removeEventListener('keydown', auClavier);
      document.removeEventListener('pointerdown', auClic);
    };
  }, [ouvert]);

  const courant = OPTIONS[mouvementReduit() ? 0 : indice];

  return (
    <div
      ref={boite}
      className={`vitrine-acces${ouvert ? ' vitrine-acces--ouvert' : ''}`}
      onPointerEnter={() => setPause(true)}
      onPointerLeave={() => setPause(false)}
      onFocus={() => setPause(true)}
      onBlur={(e) => {
        if (!boite.current?.contains(e.relatedTarget)) setPause(false);
      }}
    >
      <Link to={courant.to} className="vitrine-acces__principal">
        {/* Le plus long des deux mots donne la largeur : le bouton ne respire pas. */}
        <span className="vitrine-acces__gabarit" aria-hidden="true">
          Faire un don
        </span>
        <span className="sr-only">{courant.libelle}</span>
        <span className="vitrine-acces__mots">
          {sortant !== null && (
            <span key={`sortant-${sortant}`} className="vitrine-acces__mot vitrine-acces__mot--sortant">
              <Lettres mot={OPTIONS[sortant].libelle} />
            </span>
          )}
          <span key={`courant-${courant.cle}`} className="vitrine-acces__mot vitrine-acces__mot--courant" data-mot={courant.libelle}>
            <Lettres mot={courant.libelle} />
          </span>
        </span>
        {/* L'eclat qui traverse le bouton a chaque changement de mot. */}
        {sortant !== null && <span key={`eclat-${sortant}`} className="vitrine-acces__eclat" aria-hidden="true" />}
      </Link>

      <button
        type="button"
        className="vitrine-acces__fleche"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-controls={ouvert ? 'vitrine-acces-menu' : undefined}
        aria-label="Choisir : faire un don ou se connecter"
        onClick={() => setOuvert((o) => !o)}
      >
        <IconeChevronBas />
      </button>

      {ouvert && (
        <ul id="vitrine-acces-menu" className="vitrine-acces__menu" role="menu" aria-label="Faire un don ou se connecter">
          {OPTIONS.map(({ cle, libelle, to, Icone }, rang) => (
            <li key={cle} role="none">
              <Link
                to={to}
                role="menuitem"
                className="vitrine-acces__choix"
                style={{ '--rang': rang }}
                ref={rang === 0 ? premierChoix : undefined}
              >
                <Icone className="vitrine-acces__choix-icone" />
                {libelle}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
