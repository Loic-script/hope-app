import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

import logoSurFondViolet from '../assets/LOGO_WORDMARK_SUR_FOND_VIOLET.png';
import logoSurFondBlanc from '../assets/LOGO_WORDMARK_SUR_FOND_BLANC.png';
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

const LARGEUR_TIROIR = '(max-width: 560px)';

const TEINTES = [
  { fond: 'var(--hope-jaune)', encre: 'var(--hope-violet-lisible)' },
  { fond: 'var(--hope-bleu)', encre: 'var(--hope-violet-lisible)' },
  { fond: 'var(--hope-orange)', encre: 'var(--hope-violet-lisible)' },
  { fond: 'var(--hope-violet)', encre: '#ffffff' },
];

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

  const [railReplie, setRailReplie] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(cleRail) === '1'
  );

  function basculerRail() {
    setRailReplie((replie) => {
      const suivant = !replie;
      try {
        localStorage.setItem(cleRail, suivant ? '1' : '0');
      } catch {
      }
      return suivant;
    });
  }

  const [enTiroir, setEnTiroir] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(LARGEUR_TIROIR).matches
  );
  const [tiroirOuvert, setTiroirOuvert] = useState(false);

  useEffect(() => {
    const requete = window.matchMedia(LARGEUR_TIROIR);
    const suivre = (e) => {
      setEnTiroir(e.matches);
      setTiroirOuvert(false);
    };
    requete.addEventListener('change', suivre);
    return () => requete.removeEventListener('change', suivre);
  }, []);

  const replie = railReplie && !enTiroir;

  const idTiroir = useId();
  const boutonTiroir = useRef(null);
  const tiroir = useRef(null);
  const profil = useRef(null);

  useEffect(() => {
    setMenuOuvert(false);
    setTiroirOuvert(false);
  }, [emplacement.pathname]);

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
      const focus = document.activeElement;
      if (!focus || focus === document.body || panneau?.contains(focus)) bouton?.focus();
    };
  }, [tiroirOuvert]);

  function surClicTiroir(evenement) {
    if (evenement.target.closest('a')) setTiroirOuvert(false);
  }

  const navigation = groupes.flatMap((groupe) => groupe.entrees);

  const entreeActive =
    navigation.find(({ to, exact }) =>
      exact ? emplacement.pathname === to : emplacement.pathname.startsWith(to)
    ) ?? null;

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

  const compteNotifications = notifications ? compteurs[notifications.cle] : undefined;
  const nonLusNotifications = compteNotifications ?? 0;
  const cloche = useClocheQuiSonne(compteNotifications ?? null);

  const derriereLeTiroir = enTiroir && tiroirOuvert;

  return (
    <div
      className="admin"
      style={{
        '--admin-rail-actuel': replie ? 'var(--admin-rail-large)' : 'var(--admin-rail-ouvert)',
      }}
    >
      {enTiroir && (
        <div
          className={`lateral__voile${tiroirOuvert ? ' lateral__voile--visible' : ''}`}
          onClick={() => setTiroirOuvert(false)}
          aria-hidden="true"
        />
      )}

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
                    aria-label={
                      nonLus > 0 ? `${label} : ${annonce ? annonce(nonLus) : `${nonLus} non lu(s)`}` : label
                    }
                    className={({ isActive }) =>
                      `lateral__lien${isActive ? ' lateral__lien--actif' : ''}`
                    }
                  >
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
        <div className="entete__barre">
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
                  {cloche.sonne && <span className="cloche__onde" aria-hidden="true" />}
                  <IconeCloche />
                  {nonLusNotifications > 0 && (
                    <span className="cloche__compte" aria-hidden="true">
                      {nonLusNotifications > 99 ? '99+' : nonLusNotifications}
                    </span>
                  )}
                </Link>

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
                aria-label={`Menu du compte${identite?.nom ? ` de ${identite.nom}` : ''}`}
                onClick={() => setMenuOuvert((ouvert) => !ouvert)}
                aria-expanded={menuOuvert}
                aria-haspopup="menu"
              >
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
