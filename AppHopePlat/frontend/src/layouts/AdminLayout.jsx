import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';

import HopeLogo from '../components/HopeLogo.jsx';
import {
  IconeAccueil,
  IconeBudgets,
  IconeChevronBas,
  IconeCloche,
  IconeDeconnexion,
  IconeDonateurs,
  IconeGraphique,
  IconeImpacts,
  IconeMessages,
  IconeParametres,
  IconeProjets,
} from '../components/admin/AdminIcons.jsx';
import { api } from '../services/api.js';
import * as authService from '../services/auth.service.js';
import { initiales } from '../utils/format.js';

/**
 * Les six sections de travail de l'espace administrateur.
 *
 * Trois entrees n'y figurent pas, et c'est voulu :
 *   * Notifications et Messages sont des alertes, pas des destinations : la
 *     barre du haut les montre avec leur pastille depuis n'importe ou ;
 *   * Parametres et Se deconnecter relevent du compte : ils vivent dans le
 *     menu du profil, en haut a droite.
 *
 * La barre n'affiche que les icones : le libelle sert d'aria-label et
 * s'affiche en infobulle au survol comme au focus clavier.
 */
const NAVIGATION = [
  { to: '/admin', label: 'Accueil', Icone: IconeAccueil, exact: true },
  { to: '/admin/projects', label: 'Projets', Icone: IconeProjets },
  { to: '/admin/impact', label: 'Impact', Icone: IconeImpacts },
  { to: '/admin/budget', label: 'Budget', Icone: IconeBudgets },
  { to: '/admin/donors', label: 'Donateurs', Icone: IconeDonateurs },
  { to: '/admin/statistics', label: 'Statistiques', Icone: IconeGraphique },
];

/**
 * Ossature de l'espace administrateur : bandeau sombre en haut, contenu
 * en dessous sur toute la largeur.
 *
 * Monte a l'interieur de RequireAuth : le profil verifie par
 * GET /api/admin/me arrive par le contexte et redescend vers les pages.
 */
export default function AdminLayout() {
  const { admin } = useOutletContext();
  const navigate = useNavigate();
  const emplacement = useLocation();

  const [compteurs, setCompteurs] = useState({ notifications: 0, messages: 0 });
  const [menuOuvert, setMenuOuvert] = useState(false);

  const profil = useRef(null);

  /** Recharge les pastilles : a chaque changement de page, et sur demande. */
  const rafraichirCompteurs = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/badges');
      setCompteurs(data);
    } catch {
      // Un echec de compteur ne doit jamais bloquer la navigation.
    }
  }, []);

  useEffect(() => {
    rafraichirCompteurs();
    setMenuOuvert(false);
  }, [emplacement.pathname, rafraichirCompteurs]);

  // Le menu du profil se ferme au clic exterieur et a la touche Echap.
  useEffect(() => {
    if (!menuOuvert) return undefined;

    const surClic = (evenement) => {
      if (!profil.current?.contains(evenement.target)) setMenuOuvert(false);
    };
    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') setMenuOuvert(false);
    };

    document.addEventListener('mousedown', surClic);
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('mousedown', surClic);
      document.removeEventListener('keydown', surTouche);
    };
  }, [menuOuvert]);

  async function seDeconnecter() {
    await authService.deconnecter();
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="admin">
      <header className="entete">
        {/* ---------- Marque, navigation, alertes, profil : une seule rangee ---------- */}
        <div className="entete__barre">
          <Link className="entete__marque" to="/admin" aria-label="HOPE — accueil administrateur">
            <HopeLogo compact />
          </Link>

          <nav className="nav-top" aria-label="Navigation principale">
            <div className="nav-top__groupe">
              {NAVIGATION.map(({ to, label, Icone, exact }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={exact}
                  aria-label={label}
                  className={({ isActive }) =>
                    `nav-top__lien${isActive ? ' nav-top__lien--actif' : ''}`
                  }
                >
                  <Icone />
                  <span className="nav-top__bulle" aria-hidden="true">
                    {label}
                  </span>
                </NavLink>
              ))}
            </div>
          </nav>

          <div className="entete__actions">
            <Link
              to="/admin/notifications"
              className="entete__action"
              aria-label={
                compteurs.notifications > 0
                  ? `Notifications : ${compteurs.notifications} non lue(s)`
                  : 'Notifications'
              }
            >
              <IconeCloche />
              {compteurs.notifications > 0 && <span className="entete__point" aria-hidden="true" />}
            </Link>

            <Link
              to="/admin/messages"
              className="entete__action"
              aria-label={
                compteurs.messages > 0
                  ? `Messages : ${compteurs.messages} non lu(s)`
                  : 'Messages'
              }
            >
              <IconeMessages />
              {compteurs.messages > 0 && <span className="entete__point" aria-hidden="true" />}
            </Link>

            <div className="profil" ref={profil}>
              <button
                type="button"
                className="profil__bouton"
                onClick={() => setMenuOuvert((ouvert) => !ouvert)}
                aria-expanded={menuOuvert}
                aria-haspopup="menu"
              >
                <span className="profil__avatar" aria-hidden="true">
                  {initiales(admin?.adminLog)}
                </span>
                <span className="profil__identite">
                  <span className="profil__nom">{admin?.adminLog ?? 'AdminHope'}</span>
                  <span className="profil__role">Administrateur</span>
                </span>
                <IconeChevronBas className="profil__chevron" />
              </button>

              {menuOuvert && (
                <div className="profil__menu" role="menu">
                  <Link className="profil__entree" to="/admin/settings" role="menuitem">
                    <IconeParametres />
                    Paramètres
                  </Link>
                  <div className="profil__separateur" />
                  <button
                    type="button"
                    className="profil__entree profil__entree--sortie"
                    onClick={seDeconnecter}
                    role="menuitem"
                  >
                    <IconeDeconnexion />
                    Se déconnecter
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="admin__contenu">
        <Outlet context={{ admin, rafraichirCompteurs }} />
      </main>
    </div>
  );
}
