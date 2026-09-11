import { NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom';

import logoSurFondViolet from '../assets/LOGO_WORDMARK_SUR_FOND_VIOLET.png';
import * as benevoleService from '../services/benevole.service.js';
import { initiales } from '../utils/format.js';

/**
 * Les cinq ecrans de l'espace benevole, dans l'ordre du parcours :
 * on regarde ce qui se passe, on choisit une mission, on suit ses
 * taches, on compte ses heures, on tient son profil a jour.
 */
const NAVIGATION = [
  { to: '/benevole', label: 'Vue d’ensemble', exact: true },
  { to: '/benevole/missions', label: 'Missions' },
  { to: '/benevole/taches', label: 'Mes tâches' },
  { to: '/benevole/journal', label: 'Mon journal' },
  { to: '/benevole/profil', label: 'Mon profil' },
];

/**
 * Ossature de l'espace benevole : un bandeau, un menu, le contenu.
 *
 * Monte a l'interieur de RequireBenevole : le profil verifie par
 * GET /api/benevole/me arrive par le contexte et redescend vers les
 * pages.
 */
export default function BenevoleLayout() {
  const { benevole } = useOutletContext();
  const navigate = useNavigate();

  async function seDeconnecter() {
    await benevoleService.deconnecter();
    navigate('/benevole/login', { replace: true });
  }

  return (
    <div className="benevole">
      <header className="benevole__entete">
        <div className="benevole__barre">
          <img className="benevole__logo" src={logoSurFondViolet} alt="HOPE" />

          <div className="benevole__identite">
            <span className="benevole__avatar" aria-hidden="true">
              {initiales(`${benevole?.prenom ?? ''} ${benevole?.nom ?? ''}`.trim())}
            </span>
            <span className="benevole__qui">
              <span className="benevole__nom">
                {`${benevole?.prenom ?? ''} ${benevole?.nom ?? ''}`.trim() || 'Bénévole'}
              </span>
              <span className="benevole__role">Bénévole</span>
            </span>
            <button type="button" className="benevole__sortie" onClick={seDeconnecter}>
              Se déconnecter
            </button>
          </div>
        </div>

        <nav className="benevole__menu" aria-label="Navigation de l’espace bénévole">
          {NAVIGATION.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `benevole__lien${isActive ? ' benevole__lien--actif' : ''}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="benevole__contenu">
        <Outlet context={{ benevole }} />
      </main>
    </div>
  );
}
