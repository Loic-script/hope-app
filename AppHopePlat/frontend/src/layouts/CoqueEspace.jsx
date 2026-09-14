import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

// Deux declinaisons officielles : celle sur fond sombre pour le rail,
// celle sur fond blanc pour le bandeau, qui est clair.
import logoSurFondViolet from '../assets/LOGO_WORDMARK_SUR_FOND_VIOLET.png';
import logoSurFondBlanc from '../assets/LOGO_WORDMARK_SUR_FOND_BLANC.png';
// Replie, le rail n'a la place que du pictogramme.
import pictogramme from '../assets/LOGO_PICTOGRAMME_FOND_VIOLET.png';
import {
  IconeChevronBas,
  IconeChevronDroit,
  IconeCloche,
  IconeDeconnexion,
} from '../components/admin/AdminIcons.jsx';
import { PleineDeconnexion } from '../components/IconesPleines.jsx';
import { initiales } from '../utils/format.js';

/**
 * La coque commune a tous les espaces connectes.
 *
 * Elle est nee de l'espace administrateur, puis partagee : le benevole
 * avait des onglets en haut, le bailleur un rail de libelles, et les
 * trois espaces ne se ressemblaient pas. Une seule ossature vaut mieux
 * que trois -- l'utilisateur qui passe de l'un a l'autre retrouve ses
 * reperes, et une correction profite a tout le monde.
 *
 * Ce qui change d'un espace a l'autre passe par les proprietes : les
 * familles du menu, l'intitule de l'espace, la personne connectee, la
 * cloche des notifications et les entrees du menu de profil. Le reste --
 * repli du rail, arc mobile, glissement au doigt, infobulles -- est le
 * meme partout.
 *
 * Les classes gardent le prefixe "admin" parce que la feuille de style
 * vient de la : les renommer toucherait un millier de lignes sans rien
 * changer a l'ecran.
 */

/**
 * Ouverture de l'arc, en degres.
 *
 * Volontairement faible : plus l'arc est ouvert, plus il est haut. A 150
 * il mangeait 133 px de hauteur ; a 70, sur un rayon plus grand, il n'en
 * prend que 89 tout en gardant le meme espacement entre boutons.
 */
const OUVERTURE_ARC = 70;

/**
 * Nombre d'entrees affichees a la fois sur l'arc.
 *
 * Impair : il faut une place centrale, et c'est elle qui revient a
 * l'entree active. Sur bureau la barre les montre toutes.
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
 * Les quatre couleurs de la charte, dans l'ordre ou les familles du menu
 * se les partagent.
 *
 * Elles sont relevees dans le logo : violet #5d5696, bleu #86b9de,
 * orange #e09735, jaune #f5e389. Le violet est fortement eclairci : le
 * rail est lui-meme violet, et cette couleur-la doit s'en detacher
 * autant que les trois autres, qui n'ont pas ce probleme.
 *
 * Une famille, une couleur : c'est elle qui distingue les groupes d'un
 * coup d'oeil, la ou l'intitule demande de lire.
 */
const TEINTES = [
  'var(--hope-jaune)',
  'var(--hope-bleu)',
  'var(--hope-orange)',
  'color-mix(in srgb, var(--hope-violet) 26%, #ffffff)',
];

/**
 * Place d'une entree sur l'arc, relative au centre.
 *
 * Le calcul est circulaire : l'entree qui suit la derniere revient a la
 * premiere. Sans ce rebouclage, centrer la premiere entree laisserait
 * l'arc a moitie vide au-dessus d'elle.
 *
 * @returns {number} 0 au centre, negatif au-dessus, positif en dessous
 */
function placeSurLArc(rang, centre, total) {
  const ecart = (((rang - centre) % total) + total) % total;
  return ecart > total / 2 ? ecart - total : ecart;
}

/**
 * @param {object} props
 * @param {Array}  props.groupes       familles du menu : { titre, entrees }
 * @param {string} props.espace        intitule affiche sous le logo
 * @param {string} props.accueil       route du logo, et page d'entree
 * @param {string} props.cleRail       ou retenir le repli, propre a l'espace
 * @param {object} props.identite      { nom, role } de la personne connectee
 * @param {Function} props.onDeconnexion
 * @param {object} [props.compteurs]   pastilles, par cle d'entree
 * @param {object} [props.notifications] { to, cle } ou null s'il n'y en a pas
 * @param {Array}  [props.entreesProfil] entrees du menu de profil
 * @param {import('react').ReactNode} props.children le contenu de la page
 */
export default function CoqueEspace({
  groupes,
  espace,
  accueil,
  cleRail,
  identite,
  onDeconnexion,
  compteurs = {},
  notifications = null,
  entreesProfil = [],
  children,
}) {
  const emplacement = useLocation();

  // La meme liste a plat, et le rang de chaque entree. L'arc mobile
  // raisonne en rangs continus : il ignore les familles, qui n'auraient
  // de toute facon la place ni d'un intitule ni d'un separateur.
  const navigation = useMemo(() => groupes.flatMap((groupe) => groupe.entrees), [groupes]);
  const rangs = useMemo(
    () => new Map(navigation.map((entree, rang) => [entree.to, rang])),
    [navigation]
  );

  const [menuOuvert, setMenuOuvert] = useState(false);

  /*
   * Rail replie ou deploye. Deploye par defaut : les noms se lisent sans
   * avoir a survoler, et c'est la forme qui rend le menu lisible d'un
   * coup d'oeil. Le repli existe pour rendre la largeur a qui en manque.
   */
  const [railReplie, setRailReplie] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(cleRail) === '1'
  );

  function basculerRail() {
    setRailReplie((replie) => {
      const suivant = !replie;
      try {
        localStorage.setItem(cleRail, suivant ? '1' : '0');
      } catch {
        // Navigation privee : le reglage ne survivra pas, tant pis.
      }
      return suivant;
    });
  }

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
  const fenetre = enArc ? FENETRE_ARC : navigation.length;
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

  // Changer de page ferme le menu de profil et remet l'entree active au
  // sommet : la rotation manuelle en cours est abandonnee.
  useEffect(() => {
    setMenuOuvert(false);
    setRotationArc(0);
  }, [emplacement.pathname]);

  /** Rang de l'entree correspondant a la page affichee. */
  const rangActif = navigation.findIndex(({ to, exact }) =>
    exact ? emplacement.pathname === to : emplacement.pathname.startsWith(to)
  );

  /** L'entree active, telle que le fil d'Ariane la nomme. */
  const entreeActive = rangActif >= 0 ? navigation[rangActif] : null;

  /*
   * Ce qui occupe le sommet de l'arc : l'entree active, decalee de la
   * rotation manuelle eventuelle.
   */
  const centreArc =
    (Math.max(0, rangActif) + rotationArc + navigation.length * 8) % navigation.length;

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

  const nonLusNotifications = notifications ? (compteurs[notifications.cle] ?? 0) : 0;

  return (
    /*
      La largeur du rail descend en variable CSS : c'est elle qui decale
      le bandeau et le contenu. Une classe suffirait, mais la variable
      evite d'ecrire deux fois la meme mesure dans la feuille de style.
    */
    <div
      className="admin"
      style={{
        '--admin-rail-actuel': railReplie ? 'var(--admin-rail-large)' : 'var(--admin-rail-ouvert)',
      }}
    >
      {/*
        Rail vertical a gauche sur ecran large, arc en bas de l'ecran sur
        mobile : c'est la meme balise, seule sa mise en page change.

        Le rail montre les noms en clair ; replie, il n'a de place que
        pour les icones et les noms redeviennent des infobulles. Dans les
        deux cas c'est l'aria-label du lien qui porte le nom pour les
        lecteurs d'ecran.
      */}
      <aside className={`lateral${railReplie ? ' lateral--replie' : ''}`}>
        {/*
          La marque en tete du rail, et non au centre du bandeau : c'est
          la colonne de gauche qui identifie l'espace, comme sur la
          plupart des back-offices. Le bandeau garde son logo sur
          telephone, ou le rail cede la place a l'arc.
        */}
        <div className="lateral__marque">
          <Link className="lateral__logo" to={accueil} aria-label={`HOPE — ${espace}`}>
            <img src={railReplie ? pictogramme : logoSurFondViolet} alt="HOPE" />
          </Link>
        </div>

        <p className="lateral__espace">{espace}</p>

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
          {groupes.map((groupe, rangGroupe) => (
            <div
              className="lateral__groupe"
              key={groupe.titre ?? `groupe-${rangGroupe}`}
              style={{ '--teinte-famille': TEINTES[rangGroupe % TEINTES.length] }}
            >
              {groupe.titre && (
                <p className="lateral__section" aria-hidden="true">
                  {groupe.titre}
                </p>
              )}

              {groupe.entrees.map(({ to, label, Icone, exact, compteur }) => {
                // Place fractionnaire pendant un geste : l'arc suit le doigt.
                const place =
                  placeSurLArc(rangs.get(to), centreArc, navigation.length) + glissement;
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
                    style={{ '--angle': `${place * (OUVERTURE_ARC / (fenetre - 1))}deg` }}
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
          entrees. Le rail les affiche toutes : elles n'ont rien a faire
          tourner, et les rendre malgre tout mettrait deux boutons morts
          dans le parcours clavier.
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

          Absent de l'arc, qui n'a pas de pied ou l'accrocher.
        */}
        {!enArc && (
          <div className="lateral__pied">
            <button
              type="button"
              className="lateral__lien lateral__lien--sortie"
              onClick={onDeconnexion}
              aria-label="Se déconnecter"
            >
              <PleineDeconnexion />
              <span className="lateral__libelle" aria-hidden="true">
                Se déconnecter
              </span>
            </button>
          </div>
        )}
      </aside>

      {/*
        La poignee qui replie le rail. Elle est posee a cheval sur son
        bord droit, a mi-hauteur -- la ou la main la cherche -- et non
        dans la tete, qui revient tout entiere au logo.

        Hors du rail dans le DOM : celui-ci masque ce qui deborde de sa
        largeur, et la poignee y serait rognee de moitie. Elle suit donc
        le bord par la meme variable de largeur.
      */}
      {!enArc && (
        <button
          type="button"
          className={`lateral__basculer${railReplie ? ' lateral__basculer--replie' : ''}`}
          onClick={basculerRail}
          aria-label={railReplie ? 'Déployer le menu' : 'Replier le menu'}
          aria-expanded={!railReplie}
        >
          <IconeChevronDroit />
        </button>
      )}

      <header className="entete">
        {/* ---------- Marque au centre, alertes et profil a droite ---------- */}
        <div className="entete__barre">
          {/*
            Le fil d'Ariane occupe la colonne de gauche, vide jusqu'ici
            sur ecran large. Il ne remplace pas le menu : il dit ou l'on
            se trouve, ce que le rail ne fait que par une pastille de
            couleur. Absent de l'arc, ou la marque tient le centre.
          */}
          {!enArc && (
            <nav className="entete__fil" aria-label="Fil d'Ariane">
              <Link to={accueil}>Mon espace</Link>
              {entreeActive && (
                <>
                  <span aria-hidden="true">/</span>
                  <span className="entete__fil-ici">{entreeActive.label}</span>
                </>
              )}
            </nav>
          )}

          <Link className="entete__marque" to={accueil} aria-label={`HOPE — ${espace}`}>
            <img className="entete__logo" src={logoSurFondBlanc} alt="HOPE" />
          </Link>

          <div className="entete__actions">
            {notifications && (
              <Link
                to={notifications.to}
                className="entete__action"
                aria-label={
                  nonLusNotifications > 0
                    ? `Notifications : ${nonLusNotifications} non lue(s)`
                    : 'Notifications'
                }
              >
                <IconeCloche />
                {nonLusNotifications > 0 && (
                  <span className="entete__point" aria-hidden="true" />
                )}
              </Link>
            )}

            <div className="profil" ref={profil}>
              <button
                type="button"
                className="profil__bouton"
                onClick={() => setMenuOuvert((ouvert) => !ouvert)}
                aria-expanded={menuOuvert}
                aria-haspopup="menu"
              >
                <span className="profil__avatar" aria-hidden="true">
                  {initiales(identite?.nom)}
                </span>
                <span className="profil__identite">
                  <span className="profil__nom">{identite?.nom}</span>
                  <span className="profil__role">{identite?.role}</span>
                </span>
                <IconeChevronBas className="profil__chevron" />
              </button>

              {menuOuvert && (
                <div className="profil__menu" role="menu">
                  {entreesProfil.map(({ to, label, Icone }) => (
                    <Link className="profil__entree" to={to} role="menuitem" key={to}>
                      <Icone />
                      {label}
                    </Link>
                  ))}
                  {entreesProfil.length > 0 && <div className="profil__separateur" />}
                  <button
                    type="button"
                    className="profil__entree profil__entree--sortie"
                    onClick={onDeconnexion}
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

      <main className="admin__contenu">{children}</main>
    </div>
  );
}
