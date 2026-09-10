import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';

// Declinaison officielle pour fond sombre : les lettres y sont deja
// blanches, contrairement au composant SVG qu'il fallait recolorer.
import logoSurFondViolet from '../assets/LOGO_WORDMARK_SUR_FOND_VIOLET.png';
import {
  IconeAccueil,
  IconeBeneficiaires,
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
 * Les neuf sections de travail, rangees en trois familles.
 *
 * L'ordre suit celui du travail : "Pilotage" ce que l'on fait -- ouvrir
 * un projet, enregistrer les personnes accompagnees, documenter le
 * terrain ; "Communaute" les echanges avec ceux qui soutiennent HOPE ;
 * "Analyse" ce que l'on constate ensuite. Trois familles courtes se
 * lisent d'un coup d'oeil la ou une liste de neuf demande d'etre
 * parcourue.
 *
 * Messages n'est plus dans le bandeau : repondre a un donateur est un
 * travail quotidien, pas une alerte qu'on traite en passant. La pastille
 * de non-lus le suit dans le rail, elle n'est pas perdue.
 *
 * Deux entrees n'y figurent pas, et c'est voulu :
 *   * Notifications reste une alerte et non une destination : la barre du
 *     haut la montre avec sa pastille depuis n'importe ou ;
 *   * Parametres releve du compte : il vit dans le menu du profil, en
 *     haut a droite, avec la deconnexion.
 */
const GROUPES = [
  {
    titre: 'Pilotage',
    entrees: [
      { to: '/admin', label: 'Accueil', Icone: IconeAccueil, exact: true },
      { to: '/admin/projects', label: 'Projets', Icone: IconeProjets },
      { to: '/admin/beneficiaries', label: 'Bénéficiaires', Icone: IconeBeneficiaires },
      { to: '/admin/proofs', label: 'Preuves terrain', Icone: IconePreuves },
    ],
  },
  {
    titre: 'Communauté',
    entrees: [
      // "compteur" designe la cle des pastilles renvoyees par
      // /admin/badges : l'entree porte alors son nombre de non-lus.
      { to: '/admin/messages', label: 'Messages', Icone: IconeMessages, compteur: 'messages' },
    ],
  },
  {
    titre: 'Analyse',
    entrees: [
      { to: '/admin/impact', label: 'Impact', Icone: IconeImpacts },
      { to: '/admin/budget', label: 'Budget', Icone: IconeBudgets },
      { to: '/admin/donors', label: 'Donateurs', Icone: IconeDonateurs },
      { to: '/admin/statistics', label: 'Statistiques', Icone: IconeGraphique },
    ],
  },
];

/**
 * La meme liste a plat, et le rang de chaque entree.
 *
 * L'arc mobile raisonne en rangs continus : il ignore les familles, qui
 * n'auraient de toute facon la place ni d'un intitule ni d'un
 * separateur. Le rail de bureau, lui, s'en sert.
 */
const NAVIGATION = GROUPES.flatMap((groupe) => groupe.entrees);
const RANGS = new Map(NAVIGATION.map((entree, rang) => [entree.to, rang]));

/**
 * Ouverture de l'arc, en degres.
 *
 * Volontairement faible : plus l'arc est ouvert, plus il est haut. A 150
 * il mangeait 133 px de hauteur ; a 70, sur un rayon plus grand, il n'en
 * prend que 89 tout en gardant le meme espacement entre boutons.
 */
const OUVERTURE_ARC = 70;

/**
 * Nombre d'entrees affichees a la fois, selon la forme du menu.
 *
 * Sur mobile l'arc n'en accueille que cinq -- impair, il faut une place
 * centrale, et c'est elle qui revient a l'entree active. Sur bureau la
 * barre les montre toutes : rien a masquer, donc rien a faire tourner.
 */
const FENETRE_ARC = 5;

/** En dessous de cette largeur, le menu prend la forme d'un arc. */
const LARGEUR_ARC = '(max-width: 560px)';

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

  /*
   * Forme du menu. On ne peut pas la deduire du seul CSS : c'est elle qui
   * decide combien d'entrees sont rendues, donc lesquelles sont
   * focalisables au clavier et annoncees aux lecteurs d'ecran. Une entree
   * masquee par CSS mais presente dans le DOM serait un piege a tabulation.
   */
  const [enArc, setEnArc] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(LARGEUR_ARC).matches
  );

  useEffect(() => {
    const requete = window.matchMedia(LARGEUR_ARC);
    const suivre = (e) => setEnArc(e.matches);
    requete.addEventListener('change', suivre);
    return () => requete.removeEventListener('change', suivre);
  }, []);

  // Sur bureau la barre montre tout ; sur mobile l'arc n'accueille que cinq.
  const fenetre = enArc ? FENETRE_ARC : NAVIGATION.length;
  const rayonFenetre = (fenetre - 1) / 2;

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
        Rail vertical a gauche sur ecran large, arc en bas de l'ecran sur
        mobile : c'est la meme balise, seule sa mise en page change.

        Le rail montre les icones en permanence et se deploie au survol
        pour reveler les noms ; l'arc, lui, n'a de place que pour les
        icones. Dans les deux cas c'est l'aria-label du lien qui porte le
        nom pour les lecteurs d'ecran.
      */}
      <aside className="lateral">
        <nav
          className={`lateral__nav${enGlissement ? ' lateral__nav--glisse' : ''}`}
          aria-label="Navigation principale"
          onPointerDown={enArc ? debuterGeste : undefined}
          onPointerMove={enArc ? suivreGeste : undefined}
          onPointerUp={enArc ? terminerGeste : undefined}
          onPointerCancel={enArc ? terminerGeste : undefined}
          onClickCapture={enArc ? filtrerClic : undefined}
        >
          {/*
            Le groupe est un simple conteneur : en arc il passe en
            display: contents et s'efface, si bien que les entrees restent
            positionnees par rapport au repere du <nav>.
          */}
          {GROUPES.map((groupe) => (
            <div className="lateral__groupe" key={groupe.titre}>
              <p className="lateral__section" aria-hidden="true">
                {groupe.titre}
              </p>

              {groupe.entrees.map(({ to, label, Icone, exact, compteur }) => {
                // Place fractionnaire pendant un geste : l'arc suit le doigt.
                const place =
                  placeSurLArc(RANGS.get(to), centreArc, NAVIGATION.length) + glissement;
                // La demi-place de marge evite qu'une entree apparaisse
                // d'un coup au bord de l'arc en cours de glissement.
                const surLArc = !enArc || Math.abs(place) <= rayonFenetre + 0.5;
                const nonLus = compteur ? (compteurs[compteur] ?? 0) : 0;

                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={exact}
                    // La pastille est decorative : c'est l'aria-label qui
                    // annonce le nombre, sans quoi un lecteur d'ecran
                    // lirait "Messages 3" sans dire de quoi il s'agit.
                    aria-label={nonLus > 0 ? `${label} : ${nonLus} non lu(s)` : label}
                    // Hors de l'arc, l'entree est retiree du parcours
                    // clavier en plus d'etre invisible : on ne tabule pas
                    // vers un bouton qu'on ne voit pas.
                    tabIndex={surLArc ? undefined : -1}
                    aria-hidden={surLArc ? undefined : true}
                    style={{
                      '--angle': `${place * (OUVERTURE_ARC / (fenetre - 1))}deg`,
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
                    {nonLus > 0 && (
                      <span className="lateral__pastille" aria-hidden="true">
                        {nonLus > 99 ? '99+' : nonLus}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/*
          Les fleches ne servent qu'a l'arc, qui ne montre que cinq
          entrees sur sept. Le rail les affiche toutes : elles n'ont rien
          a faire tourner, et les rendre malgre tout mettrait deux boutons
          morts dans le parcours clavier.
        */}
        {enArc && (
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
        )}

        {/*
          Le pied du rail. Se deconnecter reste aussi dans le menu du
          profil : c'est la meme action a deux endroits, et non un
          doublon a arbitrer -- l'un se trouve avec le compte, l'autre au
          bout du menu, la ou l'oeil descend en fin de session.

          Absent de l'arc, qui n'a pas de pied ou l'accrocher, et ou une
          huitieme pastille prendrait la place d'une section.
        */}
        {!enArc && (
          <div className="lateral__pied">
            <button
              type="button"
              className="lateral__lien lateral__lien--sortie"
              onClick={seDeconnecter}
              aria-label="Se déconnecter"
            >
              <IconeDeconnexion />
              <span className="lateral__libelle" aria-hidden="true">
                Se déconnecter
              </span>
            </button>
          </div>
        )}
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
