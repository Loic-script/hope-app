import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import HopeLogo from '../HopeLogo.jsx';
import BoutonAcces from './BoutonAcces.jsx';
import { LIEN_CONNEXION, LIENS_DROITE, LIENS_GAUCHE } from './liens.js';

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

  useEffect(() => {
    setOuvert(false);
  }, [emplacement.pathname]);

  useEffect(() => {
    const surDefilement = () => setResserre(window.scrollY > 12);
    surDefilement();
    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => window.removeEventListener('scroll', surDefilement);
  }, []);

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
