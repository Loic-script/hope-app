import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import HopeLogo from '../HopeLogo.jsx';
import BoutonAcces from './BoutonAcces.jsx';
import { LIEN_CONNEXION, LIENS_DROITE, LIENS_GAUCHE } from './liens.js';

/**
 * L'en-tete du site vitrine de HOPE.
 *
 * Sur grand ecran, le logotype au centre, trois liens de chaque cote, et
 * au bout le bouton d'acces (BoutonAcces) : la seule couleur pleine de
 * la barre, qui dit "Faire un don" puis "Connexion" en alternance, et
 * dont la fleche ouvre le choix des deux. La page courante passe au bleu
 * de la charte.
 *
 * Sur telephone et tablette, le logotype a gauche, le bouton d'acces et
 * un bouton de menu a droite ; le menu se deplie sous la barre,
 * "Connexion" en dernier, en toutes lettres. Il se ferme au changement
 * de page, a la touche Echap, ou d'un clic hors de lui.
 *
 * La barre reste en haut de l'ecran ; des qu'on descend, elle se resserre
 * et prend une ombre, pour se detacher du contenu qui passe dessous.
 */
function Lien({ to, libelle, exact }) {
  return (
    <NavLink to={to} end={exact} className={({ isActive }) => `vitrine-nav__lien${isActive ? ' vitrine-nav__lien--actif' : ''}`}>
      {libelle}
    </NavLink>
  );
}

export default function EnteteVitrine() {
  const [ouvert, setOuvert] = useState(false);
  const [resserre, setResserre] = useState(false);
  const emplacement = useLocation();
  const barre = useRef(null);

  // Le menu se referme quand on change de page.
  useEffect(() => {
    setOuvert(false);
  }, [emplacement.pathname]);

  // La barre se resserre des qu'on a quitte le haut de la page.
  useEffect(() => {
    const surDefilement = () => setResserre(window.scrollY > 12);
    surDefilement();
    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => window.removeEventListener('scroll', surDefilement);
  }, []);

  // Menu ouvert : Echap ou un clic dehors le ferme.
  useEffect(() => {
    if (!ouvert) return undefined;
    const auClavier = (e) => e.key === 'Escape' && setOuvert(false);
    const auClic = (e) => barre.current && !barre.current.contains(e.target) && setOuvert(false);
    document.addEventListener('keydown', auClavier);
    document.addEventListener('pointerdown', auClic);
    return () => {
      document.removeEventListener('keydown', auClavier);
      document.removeEventListener('pointerdown', auClic);
    };
  }, [ouvert]);

  return (
    <header
      ref={barre}
      className={`vitrine-entete${resserre ? ' vitrine-entete--resserre' : ''}${ouvert ? ' vitrine-entete--ouvert' : ''}`}
    >
      <div className="vitrine-entete__barre">
        <nav className="vitrine-nav vitrine-nav--gauche" aria-label="Menu principal, première partie">
          {LIENS_GAUCHE.map((lien) => (
            <Lien key={lien.to} {...lien} />
          ))}
        </nav>

        <Link to="/" className="vitrine-entete__logo" aria-label="HOPE, retour à l’accueil">
          <HopeLogo />
        </Link>

        <div className="vitrine-entete__droite">
          <nav className="vitrine-nav vitrine-nav--droite" aria-label="Menu principal, seconde partie">
            {LIENS_DROITE.map((lien) => (
              <Lien key={lien.to} {...lien} />
            ))}
          </nav>
          <BoutonAcces />
          <button
            type="button"
            className="vitrine-entete__menu"
            aria-expanded={ouvert}
            aria-controls="vitrine-menu-mobile"
            aria-label={ouvert ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setOuvert((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {/* Le menu des petits ecrans : les six liens, dans l'ordre, puis la connexion. */}
      <nav id="vitrine-menu-mobile" className="vitrine-mobile" aria-label="Menu principal" hidden={!ouvert}>
        {[...LIENS_GAUCHE, ...LIENS_DROITE, { to: LIEN_CONNEXION, libelle: 'Connexion' }].map((lien, rang) => (
          <NavLink
            key={lien.to}
            to={lien.to}
            end={lien.exact}
            style={{ '--rang': rang }}
            className={({ isActive }) => `vitrine-mobile__lien${isActive ? ' vitrine-mobile__lien--actif' : ''}`}
          >
            {lien.libelle}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
