import { NavLink, Outlet, useNavigate, useOutletContext } from 'react-router-dom';

import logoSurFondViolet from '../assets/LOGO_WORDMARK_SUR_FOND_VIOLET.png';
import * as bailleurService from '../services/bailleur.service.js';
import * as fmt from '../utils/format.js';

/**
 * Les six ecrans de l'espace, dans l'ordre de la lecture : ce que
 * l'argent a produit, ce qui a ete promis, les pieces, les preuves, les
 * nouvelles, puis l'organisation.
 */
const NAVIGATION = [
  { to: '/bailleur', label: 'Tableau de bord', exact: true },
  { to: '/bailleur/partenariat', label: 'Partenariat' },
  { to: '/bailleur/rapports', label: 'Rapports' },
  { to: '/bailleur/preuves', label: 'Preuves terrain' },
  { to: '/bailleur/actualites', label: 'Actualités' },
  { to: '/bailleur/organisation', label: 'Mon organisation' },
];

/** Libelle du niveau de partenariat. */
const NIVEAUX = { bronze: 'Partenaire Bronze', argent: 'Partenaire Argent', or: 'Partenaire Or' };

/**
 * Ossature de l'espace bailleur : un rail fixe a gauche, le contenu a
 * droite.
 *
 * Le rail est permanent et porte les libelles en clair, contrairement
 * aux icones de l'espace administrateur : un bailleur vient quelques
 * fois par an et n'a pas memorise les pictogrammes.
 *
 * Monte a l'interieur de RequireBailleur : l'organisation verifiee par
 * GET /api/bailleur/me arrive par le contexte.
 */
export default function BailleurLayout() {
  const { bailleur } = useOutletContext();
  const navigate = useNavigate();

  async function seDeconnecter() {
    await bailleurService.deconnecter();
    navigate('/bailleur/login', { replace: true });
  }

  return (
    <div className="bailleur">
      <aside className="rail">
        <div className="rail__marque">
          <img className="rail__logo" src={logoSurFondViolet} alt="HOPE" />
          <span className="rail__espace">Espace partenaire</span>
        </div>

        <div className="rail__organisation">
          <p className="rail__raison">{bailleur?.raisonSociale ?? 'Organisation'}</p>
          <p className="rail__type">{bailleur?.typeLibelle}</p>
          {bailleur?.niveau && (
            <span className={`rail__niveau rail__niveau--${bailleur.niveau}`}>
              {NIVEAUX[bailleur.niveau]}
            </span>
          )}
        </div>

        <nav className="rail__nav" aria-label="Navigation de l’espace partenaire">
          {NAVIGATION.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) => `rail__lien${isActive ? ' rail__lien--actif' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="rail__pied">
          <p className="rail__personne">
            {`${bailleur?.prenom ?? ''} ${bailleur?.nom ?? ''}`.trim()}
          </p>
          {bailleur?.fonction && <p className="rail__fonction">{bailleur.fonction}</p>}
          {bailleur?.partenaireDepuis && (
            <p className="rail__depuis">
              Partenaire depuis le {fmt.date(bailleur.partenaireDepuis)}
            </p>
          )}
          <button type="button" className="rail__sortie" onClick={seDeconnecter}>
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="bailleur__contenu">
        <Outlet context={{ bailleur }} />
      </main>
    </div>
  );
}
