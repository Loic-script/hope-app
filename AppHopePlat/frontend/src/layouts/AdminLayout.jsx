import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';

// Declinaison officielle pour fond sombre : les lettres y sont deja
// blanches, contrairement au composant SVG qu'il fallait recolorer.
import logoSurFondViolet from '../assets/LOGO_WORDMARK_SUR_FOND_VIOLET.png';
import {
  IconeAccueil,
  IconeBudgets,
  IconeChevronBas,
  IconeChevronDroit,
  IconeCloche,
  IconeDeconnexion,
  IconeDonateurs,
  IconeGraphique,
  IconeImpacts,
  IconeMessages,
  IconeParametres,
  IconePreuves,
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
  { to: '/admin/proofs', label: 'Preuves terrain', Icone: IconePreuves },
  { to: '/admin/impact', label: 'Impact', Icone: IconeImpacts },
  { to: '/admin/budget', label: 'Budget', Icone: IconeBudgets },
  { to: '/admin/donors', label: 'Donateurs', Icone: IconeDonateurs },
  { to: '/admin/statistics', label: 'Statistiques', Icone: IconeGraphique },
];

/**
 * Ouverture de l'arc, en degres.
 *
 * Volontairement faible : plus l'arc est ouvert, plus il est haut. A 150
 * il mangeait 133 px de hauteur ; a 70, sur un rayon plus grand, il n'en
 * prend que 89 tout en gardant le meme espacement entre boutons.
 */
const OUVERTURE_ARC = 70;

/**
 * Nombre d'entrees posees sur l'arc a la fois. Impair : il faut une
 * place centrale, et c'est elle qui revient a l'entree active.
 */
const FENETRE_ARC = 5;

/** Nombre de places de part et d'autre du centre. */
const RAYON_FENETRE = (FENETRE_ARC - 1) / 2;

/** Distance a parcourir, en pixels, pour faire tourner l'arc d'un cran. */
const PIXELS_PAR_CRAN = 62;

/**
 * Deplacement au-dela duquel un geste est un glissement et non un clic.
 * Sans ce seuil, le moindre tremblement pendant un clic ferait naviguer
 * vers une entree qu'on n'a fait qu'effleurer.
 */
const SEUIL_GLISSEMENT = 6;

/**
 * Place d'une entree sur l'arc, relative au centre.
 *
 * Le calcul est circulaire : l'entree qui suit la derniere revient a la
 * premiere. Sans ce reboudage, centrer la premiere entree laisserait
 * l'arc a moitie vide au-dessus d'elle.
 *
 * @returns {number} 0 au centre, negatif au-dessus, positif en dessous
 */
function placeSurLArc(rang, centre, total) {
  const ecart = (((rang - centre) % total) + total) % total;
  return ecart > total / 2 ? ecart - total : ecart;
}

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

  /**
   * Rotation manuelle de l'arc, en crans, par rapport a la position ou
   * l'entree active occupe le centre. Les fleches la font varier ; elle
   * repart de zero des qu'on change de page.
   */
  const [rotationArc, setRotationArc] = useState(0);

  /**
   * Glissement en cours, en crans fractionnaires. Zero au repos ; pendant
   * un geste, l'arc suit le doigt ou le curseur sans a-coups, et se cale
   * sur le cran le plus proche au relachement.
   */
  const [glissement, setGlissement] = useState(0);
  const [enGlissement, setEnGlissement] = useState(false);
  const geste = useRef(null);

  /**
   * Retient qu'un glissement vient de s'achever.
   *
   * Le navigateur emet le clic APRES le relachement du pointeur : sans
   * ce drapeau, qui survit a la fin du geste, le filtre du clic
   * trouverait le geste deja efface et laisserait naviguer.
   */
  const vientDeGlisser = useRef(false);

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

  // Changer de page remet l'entree active au sommet : la rotation
  // manuelle en cours est abandonnee.
  useEffect(() => {
    setRotationArc(0);
  }, [emplacement.pathname]);

  /** Rang de l'entree correspondant a la page affichee. */
  const rangActif = NAVIGATION.findIndex(({ to, exact }) =>
    exact ? emplacement.pathname === to : emplacement.pathname.startsWith(to)
  );

  /*
   * Ce qui occupe le sommet de l'arc : l'entree active, decalee de la
   * rotation manuelle eventuelle.
   *
   * Cliquer une entree l'amene donc au sommet. Elle y change de couleur
   * mais garde sa taille : c'est l'agrandissement, retire depuis, qui
   * donnait l'impression qu'elle sortait de l'arc.
   */
  const centreArc =
    (Math.max(0, rangActif) + rotationArc + NAVIGATION.length * 8) % NAVIGATION.length;

  /* ---------- Glissement de l'arc, souris et tactile ----------
   *
   * Les evenements Pointer couvrent souris, doigt et stylet avec un seul
   * jeu de gestionnaires.
   *
   * La capture du pointeur n'est demandee qu'une fois le seuil franchi,
   * et surtout PAS des l'appui : un pointeur capture fait rediriger le
   * clic vers l'element capteur. Capturer trop tot volait donc son clic
   * a chaque lien, et le menu devenait impossible a utiliser.
   */
  function debuterGeste(evenement) {
    geste.current = { x: evenement.clientX, aBouge: false };
    vientDeGlisser.current = false;
    setEnGlissement(true);
  }

  function suivreGeste(evenement) {
    if (!geste.current) return;

    const ecart = evenement.clientX - geste.current.x;

    // Le seuil franchi, c'est un glissement : on capture le pointeur pour
    // suivre le geste meme si le curseur quitte l'arc, et on renonce au
    // clic qui suivra.
    if (!geste.current.aBouge && Math.abs(ecart) > SEUIL_GLISSEMENT) {
      geste.current.aBouge = true;
      evenement.currentTarget.setPointerCapture(evenement.pointerId);
    }

    if (geste.current.aBouge) setGlissement(ecart / PIXELS_PAR_CRAN);
  }

  function terminerGeste() {
    if (!geste.current) return;

    // On se cale sur le cran le plus proche. Un glissement vers la droite
    // fait descendre les entrees le long de l'arc, donc recule le centre.
    const crans = Math.round(glissement);
    if (crans !== 0) setRotationArc((r) => r - crans);

    vientDeGlisser.current = geste.current.aBouge;
    geste.current = null;
    setGlissement(0);
    setEnGlissement(false);
  }

  /**
   * Un glissement ne doit pas naviguer : on annule le clic qui suit,
   * mais seulement si le doigt a reellement parcouru du chemin.
   */
  function filtrerClic(evenement) {
    if (!vientDeGlisser.current) return;

    evenement.preventDefault();
    evenement.stopPropagation();
    vientDeGlisser.current = false;
  }

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
      {/*
        Barre laterale sur ecran large, barre du bas sur mobile : c'est la
        meme balise, seule sa mise en page change. Elle n'affiche que des
        icones ; le libelle sert d'infobulle au survol et au focus clavier,
        et c'est l'aria-label du lien qui porte le nom pour les lecteurs
        d'ecran.
      */}
      <aside className="lateral">
        <nav
          className={`lateral__nav${enGlissement ? ' lateral__nav--glisse' : ''}`}
          aria-label="Navigation principale"
          onPointerDown={debuterGeste}
          onPointerMove={suivreGeste}
          onPointerUp={terminerGeste}
          onPointerCancel={terminerGeste}
          onClickCapture={filtrerClic}
        >
          {NAVIGATION.map(({ to, label, Icone, exact }, rang) => {
            // Place fractionnaire pendant un geste : l'arc suit le doigt.
            const place = placeSurLArc(rang, centreArc, NAVIGATION.length) + glissement;
            // La demi-place de marge evite qu'une entree apparaisse d'un
            // coup au bord de l'arc en cours de glissement.
            const surLArc = Math.abs(place) <= RAYON_FENETRE + 0.5;

            return (
              <NavLink
                key={to}
                to={to}
                end={exact}
                aria-label={label}
                // Hors de l'arc, l'entree est retiree du parcours clavier
                // en plus d'etre invisible : on ne tabule pas vers un
                // bouton qu'on ne voit pas.
                tabIndex={surLArc ? undefined : -1}
                aria-hidden={surLArc ? undefined : true}
                style={{
                  '--angle': `${place * (OUVERTURE_ARC / (FENETRE_ARC - 1))}deg`,
                }}
                className={({ isActive }) =>
                  `lateral__lien${isActive ? ' lateral__lien--actif' : ''}` +
                  (surLArc ? '' : ' lateral__lien--horschamp')
                }
              >
                <Icone />
                <span className="lateral__libelle" aria-hidden="true">
                  {label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="lateral__fleches">
          <button
            type="button"
            className="lateral__fleche"
            onClick={() => setRotationArc((r) => r - 1)}
            aria-label="Faire tourner le menu vers le haut"
          >
            <IconeChevronDroit />
          </button>
          <button
            type="button"
            className="lateral__fleche"
            onClick={() => setRotationArc((r) => r + 1)}
            aria-label="Faire tourner le menu vers le bas"
          >
            <IconeChevronDroit />
          </button>
        </div>
      </aside>

      <header className="entete">
        {/* ---------- Marque au centre, alertes et profil a droite ---------- */}
        <div className="entete__barre">
          <Link className="entete__marque" to="/admin" aria-label="HOPE — accueil administrateur">
            <img className="entete__logo" src={logoSurFondViolet} alt="HOPE" />
          </Link>

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
