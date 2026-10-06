import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { IconeChevronBas, IconeCoeur, IconeUtilisateur } from '../HopeIcons.jsx';
import { LIEN_CONNEXION, LIEN_DON } from './liens.js';

/**
 * Le bouton d'acces de la barre du site : une seule forme orange pour
 * deux portes.
 *
 *   - la partie principale est un lien dont le mot change toutes les
 *     cinq secondes : "Faire un don", puis "Connexion", puis de nouveau
 *     le don, sans fin. Le passage se fait en briques : chaque lettre du
 *     mot qui arrive tombe de haut comme un Lego, s'ecrase un peu a
 *     l'atterrissage, rebondit et se pose ; a chaque impact, les lettres
 *     deja posees encaissent une secousse, qui se propage ainsi le long
 *     du mot. Celles du mot qui part sont renversees et tombent par le
 *     bas. Le lien mene la ou son mot le dit ;
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
/** Le temps que les lettres du mot sortant aient fini de tomber (vitrine.css). */
const GLISSEMENT = 800;

/** L'espace insecable : un espace ordinaire s'effacerait entre deux briques. */
const ESPACE = String.fromCharCode(160);

function mouvementReduit() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Un nombre au hasard entre -amplitude et +amplitude. */
function hasard(amplitude) {
  return (Math.random() * 2 - 1) * amplitude;
}

/**
 * Un mot lettre par lettre, chaque lettre en deux couches :
 *   - la brique (.vitrine-acces__lettre) tombe et rebondit, a son rang
 *     (--i) et avec sa propre inclinaison (--rx), tiree au sort ;
 *   - le corps (.vitrine-acces__lettre-corps) encaisse une secousse a
 *     chaque brique qui atterrit apres elle : --reste en compte le nombre.
 */
function Lettres({ mot, graine }) {
  const lettres = useMemo(
    () => [...mot].map((car) => ({ car, rx: hasard(14).toFixed(1) })),
    // Un nouveau tirage a chaque entree en scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mot, graine]
  );
  const total = lettres.length;
  return (
    <span className="vitrine-acces__lettres" aria-hidden="true">
      {lettres.map(({ car, rx }, i) => (
        <span key={i} className="vitrine-acces__lettre" style={{ '--i': i, '--rx': `${rx}deg`, '--reste': total - 1 - i }}>
          <span className="vitrine-acces__lettre-corps">{car === ' ' ? ESPACE : car}</span>
        </span>
      ))}
    </span>
  );
}

export default function BoutonAcces() {
  const emplacement = useLocation();
  const boite = useRef(null);
  const premierChoix = useRef(null);

  const [indice, setIndice] = useState(0);
  // Le mot qui s'en va, le temps de s'estomper ; et un compteur de
  // bascules, pour que chaque entree tire ses propres tremblements.
  const [sortant, setSortant] = useState(null);
  const [bascule, setBascule] = useState(0);
  const [pause, setPause] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  const fige = pause || ouvert || mouvementReduit();

  // Le mot suivant, a la cadence, sauf quand on vise le bouton.
  useEffect(() => {
    if (fige) return undefined;
    const minuterie = setInterval(() => {
      setIndice((courant) => {
        setSortant(courant);
        setBascule((n) => n + 1);
        return (courant + 1) % OPTIONS.length;
      });
    }, CADENCE);
    return () => clearInterval(minuterie);
  }, [fige]);

  // Le mot sorti disparait une fois tombe.
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
        {/* Le mot entier pour les lecteurs d'ecran ; les lettres, elles, tombent en briques. */}
        <span className="sr-only">{courant.libelle}</span>
        <span className="vitrine-acces__mots" aria-hidden="true">
          {sortant !== null && (
            <span key={`sortant-${bascule}`} className="vitrine-acces__mot vitrine-acces__mot--sortant">
              <Lettres mot={OPTIONS[sortant].libelle} graine={`s${bascule}`} />
            </span>
          )}
          <span key={`courant-${bascule}`} className="vitrine-acces__mot vitrine-acces__mot--courant" data-mot={courant.libelle}>
            <Lettres mot={courant.libelle} graine={`c${bascule}`} />
          </span>
        </span>
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
