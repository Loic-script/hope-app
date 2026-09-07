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
  IconeJustificatifs,
  IconeParametres,
  IconeProjets,
  IconeRecherche,
} from '../components/admin/AdminIcons.jsx';
import { api } from '../services/api.js';
import * as authService from '../services/auth.service.js';
import { initiales } from '../utils/format.js';

/**
 * Les huit sections de l'espace administrateur, plus les parametres.
 *
 * La barre n'affiche que les icones : le libelle sert d'aria-label et
 * s'affiche en infobulle au survol comme au focus clavier.
 */
const NAVIGATION = [
  { to: '/admin', label: 'Accueil', Icone: IconeAccueil, exact: true },
  { to: '/admin/projects', label: 'Projets', Icone: IconeProjets },
  { to: '/admin/impact', label: 'Impact', Icone: IconeImpacts },
  { to: '/admin/budget', label: 'Budget', Icone: IconeBudgets },
  { to: '/admin/notifications', label: 'Notifications', Icone: IconeCloche, compteur: 'notifications' },
  { to: '/admin/donors', label: 'Donateurs', Icone: IconeDonateurs },
  { to: '/admin/messages', label: 'Messages', Icone: IconeJustificatifs, compteur: 'messages' },
  { to: '/admin/statistics', label: 'Statistiques', Icone: IconeGraphique },
  { to: '/admin/settings', label: 'Paramètres', Icone: IconeParametres },
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

  const [recherche, setRecherche] = useState('');
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

  /** La recherche globale ouvre la liste des projets, deja filtree. */
  function lancerRecherche(evenement) {
    evenement.preventDefault();
    const terme = recherche.trim();
    navigate(terme === '' ? '/admin/projects' : `/admin/projects?search=${encodeURIComponent(terme)}`);
  }

  return (
    <div className="admin">
      <header className="entete">
        {/* ---------- Marque, recherche, profil ---------- */}
        <div className="entete__barre">
          <Link className="entete__marque" to="/admin" aria-label="HOPE — accueil administrateur">
            <HopeLogo compact />
          </Link>

          <form className="entete__recherche" onSubmit={lancerRecherche} role="search">
            <IconeRecherche />
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher un projet, un donateur, un bénéficiaire…"
              aria-label="Recherche globale"
            />
          </form>

          <div className="entete__actions">
            <Link
              to="/admin/notifications"
              className="entete__cloche"
              aria-label={
                compteurs.notifications > 0
                  ? `Notifications : ${compteurs.notifications} non lue(s)`
                  : 'Notifications'
              }
            >
              <IconeCloche />
              {compteurs.notifications > 0 && <span className="entete__point" aria-hidden="true" />}
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

        {/* ---------- Navigation en icones ---------- */}
        <nav className="nav-top" aria-label="Navigation principale">
          <div className="nav-top__groupe">
            {NAVIGATION.map(({ to, label, Icone, exact, compteur }) => {
              const nombre = compteur ? compteurs[compteur] : 0;

              return (
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
                  {nombre > 0 && (
                    <span className="nav-top__compteur" aria-hidden="true">
                      {nombre > 99 ? '99+' : nombre}
                    </span>
                  )}
                  <span className="nav-top__bulle" aria-hidden="true">
                    {label}
                  </span>
                </NavLink>
              );
            })}
          </div>

          <div className="nav-top__groupe nav-top__groupe--fin">
            <button
              type="button"
              className="nav-top__lien nav-top__lien--sortie"
              onClick={seDeconnecter}
              aria-label="Se déconnecter"
            >
              <IconeDeconnexion />
              <span className="nav-top__bulle" aria-hidden="true">
                Se déconnecter
              </span>
            </button>
          </div>
        </nav>
      </header>

      <main className="admin__contenu">
        <Outlet context={{ admin, rafraichirCompteurs }} />
      </main>
    </div>
  );
}
