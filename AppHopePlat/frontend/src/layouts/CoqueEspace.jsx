import { useEffect, useId, useRef, useState } from 'react';
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
  IconeCroix,
  IconeDeconnexion,
  IconeMenu,
} from '../components/admin/AdminIcons.jsx';
import { PleineDeconnexion } from '../components/IconesPleines.jsx';
import { useClocheQuiSonne } from '../hooks/useClocheQuiSonne.js';
import { urlMedia } from '../services/api.js';
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
 * repli du rail, tiroir mobile, infobulles -- est le meme partout.
 *
 * Les classes gardent le prefixe "admin" parce que la feuille de style
 * vient de la : les renommer toucherait un millier de lignes sans rien
 * changer a l'ecran.
 */

/**
 * En dessous de cette largeur, le rail devient un tiroir.
 *
 * Il a d'abord ete un arc de boutons au bas de l'ecran. L'arc ne montrait
 * que cinq entrees a la fois, sans leur nom, et il fallait le faire
 * tourner pour trouver les autres. Le tiroir est le menu de telephone que
 * tout le monde connait : un bouton en haut, le meme menu que sur
 * ordinateur, toutes les entrees nommees d'un coup d'oeil.
 */
const LARGEUR_TIROIR = '(max-width: 560px)';

/**
 * Les quatre couleurs de la charte, dans l'ordre ou les familles du menu
 * se les partagent. Une famille, une couleur : c'est elle qui distingue
 * les groupes d'un coup d'oeil, la ou l'intitule demande de lire.
 *
 * Chacune vient par paire : la couleur du disque, et l'encre du
 * pictogramme pose dessus.
 *
 * L'encre n'est pas blanche partout, et ce n'est pas une fantaisie. Le
 * contraste est un rapport entre deux luminosites : l'inverser ne le
 * change pas. Une icone blanche sur un disque jaune se lit aussi mal
 * qu'une icone jaune sur un disque blanc -- 1,29 dans les deux sens,
 * quand il en faut 3 pour une forme.
 *
 * Sur les trois couleurs claires, l'encre est donc le violet fonce de la
 * charte : 6,78 sur le jaune, 4,18 sur le bleu, 3,61 sur l'orange. C'est
 * aussi le motif du jeu d'illustrations HOPE, ou le pictogramme violet
 * est cercle de jaune. Seul le disque violet, sur lequel le violet ne
 * dirait rien, prend l'encre blanche -- 6,49.
 */
const TEINTES = [
  { fond: 'var(--hope-jaune)', encre: 'var(--hope-violet-lisible)' },
  { fond: 'var(--hope-bleu)', encre: 'var(--hope-violet-lisible)' },
  { fond: 'var(--hope-orange)', encre: 'var(--hope-violet-lisible)' },
  { fond: 'var(--hope-violet)', encre: '#ffffff' },
];

/**
 * @param {object} props
 * @param {Array}  props.groupes       familles du menu : { titre, entrees }
 * @param {string} props.espace        intitule affiche sous le logo
 * @param {string} props.accueil       route du logo, et page d'entree
 * @param {string} props.cleRail       ou retenir le repli, propre a l'espace
 * @param {object} props.identite      { nom, role, photoUrl } de la personne connectee
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

  /*
   * Forme du menu : rail ou tiroir. Le CSS seul ne suffit pas -- c'est
   * elle qui decide du bouton ☰, du fil d'Ariane, et de ce que le clavier
   * peut atteindre quand le tiroir est ouvert.
   */
  const [enTiroir, setEnTiroir] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(LARGEUR_TIROIR).matches
  );
  const [tiroirOuvert, setTiroirOuvert] = useState(false);

  useEffect(() => {
    const requete = window.matchMedia(LARGEUR_TIROIR);
    const suivre = (e) => {
      setEnTiroir(e.matches);
      // Un tiroir reste ouvert d'un telephone tourne en tablette
      // bloquerait le defilement d'une page qui n'en a plus.
      setTiroirOuvert(false);
    };
    requete.addEventListener('change', suivre);
    return () => requete.removeEventListener('change', suivre);
  }, []);

  // Le tiroir montre toujours le menu entier : le repli, reglage de
  // bureau, ne s'y applique pas.
  const replie = railReplie && !enTiroir;

  const idTiroir = useId();
  const boutonTiroir = useRef(null);
  const tiroir = useRef(null);
  const profil = useRef(null);

  // Changer de page ferme le menu de profil et le tiroir.
  useEffect(() => {
    setMenuOuvert(false);
    setTiroirOuvert(false);
  }, [emplacement.pathname]);

  /*
   * Tiroir ouvert : le focus y entre, Echap le ferme, et la page dessous
   * ne defile plus. A la fermeture, le focus revient au bouton ☰ -- sans
   * quoi il tomberait sur le <body>, et le clavier repartirait du debut.
   */
  useEffect(() => {
    if (!tiroirOuvert) return undefined;

    const bouton = boutonTiroir.current;
    const panneau = tiroir.current;
    panneau?.querySelector('.lateral__fermer')?.focus();

    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') setTiroirOuvert(false);
    };
    document.addEventListener('keydown', surTouche);

    return () => {
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = avant;
      // Toucher le voile, qui n'est pas focalisable, a deja renvoye le
      // focus au <body> : il faut le rattraper la aussi.
      const focus = document.activeElement;
      if (!focus || focus === document.body || panneau?.contains(focus)) bouton?.focus();
    };
  }, [tiroirOuvert]);

  /**
   * Un lien choisi dans le tiroir le referme, meme s'il mene a la page
   * deja affichee -- le changement d'adresse ne le ferait pas.
   */
  function surClicTiroir(evenement) {
    if (evenement.target.closest('a')) setTiroirOuvert(false);
  }

  const navigation = groupes.flatMap((groupe) => groupe.entrees);

  /** L'entree correspondant a la page affichee, telle que le fil d'Ariane la nomme. */
  const entreeActive =
    navigation.find(({ to, exact }) =>
      exact ? emplacement.pathname === to : emplacement.pathname.startsWith(to)
    ) ?? null;

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

  // Undefined tant que les pastilles ne sont pas chargees : la cloche
  // ne sonne que sur une hausse d'un nombre deja connu.
  const compteNotifications = notifications ? compteurs[notifications.cle] : undefined;
  const nonLusNotifications = compteNotifications ?? 0;
  const cloche = useClocheQuiSonne(compteNotifications ?? null);

  // Tiroir ouvert, le reste de l'ecran sort du parcours clavier : le
  // focus ne peut pas s'echapper derriere le voile.
  const derriereLeTiroir = enTiroir && tiroirOuvert;

  return (
    /*
      La largeur du rail descend en variable CSS : c'est elle qui decale
      le bandeau et le contenu. Une classe suffirait, mais la variable
      evite d'ecrire deux fois la meme mesure dans la feuille de style.
    */
    <div
      className="admin"
      style={{
        '--admin-rail-actuel': replie ? 'var(--admin-rail-large)' : 'var(--admin-rail-ouvert)',
      }}
    >
      {/*
        Le voile sous le tiroir : le toucher referme le menu. Il n'a rien
        a dire aux lecteurs d'ecran, qui ont le bouton Fermer et Echap.
      */}
      {enTiroir && (
        <div
          className={`lateral__voile${tiroirOuvert ? ' lateral__voile--visible' : ''}`}
          onClick={() => setTiroirOuvert(false)}
          aria-hidden="true"
        />
      )}

      {/*
        Rail vertical a gauche sur ecran large, tiroir sur telephone :
        c'est la meme balise, avec le meme contenu.

        Le rail montre les noms en clair ; replie, il n'a de place que
        pour les icones et les noms redeviennent des infobulles. Dans les
        deux cas c'est l'aria-label du lien qui porte le nom pour les
        lecteurs d'ecran.
      */}
      <aside
        ref={tiroir}
        id={idTiroir}
        className={
          'lateral' + (replie ? ' lateral--replie' : '') + (tiroirOuvert ? ' lateral--ouvert' : '')
        }
        role={enTiroir ? 'dialog' : undefined}
        aria-modal={enTiroir ? true : undefined}
        aria-label={enTiroir ? 'Menu' : undefined}
        onClick={enTiroir ? surClicTiroir : undefined}
      >
        {/*
          La marque en tete du rail, et non au centre du bandeau : c'est
          la colonne de gauche qui identifie l'espace, comme sur la
          plupart des back-offices.
        */}
        <div className="lateral__marque">
          <Link className="lateral__logo" to={accueil} aria-label={`HOPE — ${espace}`}>
            <img src={replie ? pictogramme : logoSurFondViolet} alt="HOPE" />
          </Link>

          {enTiroir && (
            <button
              type="button"
              className="lateral__fermer"
              onClick={() => setTiroirOuvert(false)}
              aria-label="Fermer le menu"
            >
              <IconeCroix />
            </button>
          )}
        </div>

        <p className="lateral__espace">{espace}</p>

        <nav className="lateral__nav" aria-label="Navigation principale">
          {groupes.map((groupe, rangGroupe) => (
            <div
              className="lateral__groupe"
              key={groupe.titre ?? `groupe-${rangGroupe}`}
              style={{
                '--teinte-famille': TEINTES[rangGroupe % TEINTES.length].fond,
                '--encre-famille': TEINTES[rangGroupe % TEINTES.length].encre,
              }}
            >
              {groupe.titre && (
                <p className="lateral__section" aria-hidden="true">
                  {groupe.titre}
                </p>
              )}

              {groupe.entrees.map(({ to, label, Icone, exact, compteur, annonce }) => {
                const nonLus = compteur ? (compteurs[compteur] ?? 0) : 0;

                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={exact}
                    // La pastille est decorative : c'est l'aria-label qui
                    // annonce le nombre, sans quoi un lecteur d'ecran
                    // lirait "Messages 3" sans dire de quoi il s'agit.
                    // Une entree peut dire autre chose que "non lu" :
                    // des demandes a valider, par exemple.
                    aria-label={
                      nonLus > 0 ? `${label} : ${annonce ? annonce(nonLus) : `${nonLus} non lu(s)`}` : label
                    }
                    className={({ isActive }) =>
                      `lateral__lien${isActive ? ' lateral__lien--actif' : ''}`
                    }
                  >
                    {/*
                      L'icone dans son cercle. Le cercle est dans le DOM
                      et non dessine en CSS sur le lien : replie, le rail
                      centre l'icone sur son axe, et un entourage pose
                      par-dessus se serait decale avec elle.
                    */}
                    <span className="lateral__icone" aria-hidden="true">
                      <Icone />
                    </span>
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
          Le pied du rail. Se deconnecter reste aussi dans le menu du
          profil : c'est la meme action a deux endroits, et non un
          doublon a arbitrer -- l'un se trouve avec le compte, l'autre au
          bout du menu, la ou l'oeil descend en fin de session.
        */}
        <div className="lateral__pied">
          <button
            type="button"
            className="lateral__lien lateral__lien--sortie"
            onClick={onDeconnexion}
            aria-label="Se déconnecter"
          >
            <span className="lateral__icone" aria-hidden="true">
              <PleineDeconnexion />
            </span>
            <span className="lateral__libelle" aria-hidden="true">
              Se déconnecter
            </span>
          </button>
        </div>
      </aside>

      {/*
        La poignee qui replie le rail. Elle est posee a cheval sur son
        bord droit, a mi-hauteur -- la ou la main la cherche -- et non
        dans la tete, qui revient tout entiere au logo.

        Hors du rail dans le DOM : celui-ci masque ce qui deborde de sa
        largeur, et la poignee y serait rognee de moitie. Elle suit donc
        le bord par la meme variable de largeur.

        Le tiroir ne se replie pas : pas de poignee sur telephone.
      */}
      {!enTiroir && (
        <button
          type="button"
          className={`lateral__basculer${replie ? ' lateral__basculer--replie' : ''}`}
          onClick={basculerRail}
          aria-label={replie ? 'Déployer le menu' : 'Replier le menu'}
          aria-expanded={!replie}
        >
          <IconeChevronDroit />
        </button>
      )}

      <header className="entete" inert={derriereLeTiroir}>
        {/* ---------- Menu ou fil d'Ariane, marque, alertes et profil ---------- */}
        <div className="entete__barre">
          {/*
            Sur telephone, la colonne de gauche porte le bouton du tiroir,
            a l'endroit ou tout le monde le cherche.
          */}
          {enTiroir && (
            <button
              type="button"
              ref={boutonTiroir}
              className="entete__action entete__menu"
              onClick={() => setTiroirOuvert(true)}
              aria-label="Ouvrir le menu"
              aria-expanded={tiroirOuvert}
              aria-controls={idTiroir}
            >
              <IconeMenu />
            </button>
          )}

          {/*
            Le fil d'Ariane occupe la colonne de gauche sur ecran large. Il
            ne remplace pas le menu : il dit ou l'on se trouve, ce que le
            rail ne fait que par une pastille de couleur. Sur telephone, la
            place revient au bouton du menu.
          */}
          {!enTiroir && (
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
              <div className="cloche">
                <Link
                  to={notifications.to}
                  className={`entete__action cloche__lien${cloche.sonne ? ' cloche__lien--sonne' : ''}`}
                  aria-label={
                    nonLusNotifications > 0
                      ? `Notifications : ${nonLusNotifications} non lue(s)`
                      : 'Notifications'
                  }
                >
                  {/* L'onde part de la cloche a chaque arrivee : elle
                      attire l'oeil sans rien deplacer autour. */}
                  {cloche.sonne && <span className="cloche__onde" aria-hidden="true" />}
                  <IconeCloche />
                  {nonLusNotifications > 0 && (
                    <span className="cloche__compte" aria-hidden="true">
                      {nonLusNotifications > 99 ? '99+' : nonLusNotifications}
                    </span>
                  )}
                </Link>

                {/*
                  Ce qui vient d'arriver, une poignee de secondes, sous la
                  cloche. La region est "polie" : un lecteur d'ecran
                  l'annonce sans couper ce qu'il est en train de dire.
                */}
                <div className="cloche__annonce-zone" role="status" aria-live="polite">
                  {cloche.arrivees > 0 && (
                    <div className="cloche__annonce">
                      <span className="cloche__annonce-point" aria-hidden="true" />
                      <span className="cloche__annonce-texte">
                        {cloche.arrivees === 1
                          ? 'Une nouvelle notification'
                          : `${cloche.arrivees} nouvelles notifications`}
                      </span>
                      <Link className="cloche__annonce-lien" to={notifications.to}>
                        Voir
                      </Link>
                      <button
                        type="button"
                        className="cloche__annonce-fermer"
                        onClick={cloche.fermer}
                        aria-label="Masquer l’annonce"
                      >
                        <IconeCroix />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="profil" ref={profil}>
              <button
                type="button"
                className="profil__bouton"
                onClick={() => setMenuOuvert((ouvert) => !ouvert)}
                aria-expanded={menuOuvert}
                aria-haspopup="menu"
              >
                {/* La photo si le compte en a une, ses initiales sinon.
                    Le disque est le meme dans les deux cas. */}
                <span className="profil__avatar" aria-hidden="true">
                  {identite?.photoUrl ? (
                    <img src={urlMedia(identite.photoUrl)} alt="" />
                  ) : (
                    initiales(identite?.nom)
                  )}
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

      <main className="admin__contenu" inert={derriereLeTiroir}>
        {children}
      </main>
    </div>
  );
}
