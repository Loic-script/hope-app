import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';

import { IconeCroix } from './admin/AdminIcons.jsx';
import { IconeCoche, IconeFlecheGauche, IconeRecherche } from './HopeIcons.jsx';

/** "Réunion" et "reunion", "ESPAÑOL" et "espanol" se valent. */
export function normaliser(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Les mots d'un texte : "Côte d’Ivoire (+225)" -> cote, d, ivoire, +225. */
function mots(texte) {
  const bruts = texte.split(/[\s,()/·.’']+/).filter(Boolean);
  return [...new Set([...bruts, ...bruts.flatMap((mot) => mot.split('-'))])].filter(Boolean);
}

/**
 * Les options qui repondent a la recherche, les meilleures d'abord.
 *
 * Chaque terme doit se trouver quelque part. Un mot entier ("33" pour la
 * France) passe devant un debut de mot ("fra"), qui passe devant un
 * morceau ("233" pour le Ghana) ; a egalite, l'ordre de la liste.
 */
function rechercher(options, requete) {
  const termes = normaliser(requete).split(/\s+/).filter(Boolean);
  if (termes.length === 0) return null;
  const trouves = [];
  options.forEach((option, rang) => {
    let score = 0;
    for (const terme of termes) {
      if (option.mots.includes(terme)) continue;
      if (option.mots.some((mot) => mot.startsWith(terme))) score += 1;
      else if (option.texte.includes(terme)) score += 2;
      else return;
    }
    trouves.push({ option, score, rang });
  });
  return trouves.sort((a, b) => a.score - b.score || a.rang - b.rang).map(({ option }) => option);
}

/** Le libelle, le morceau cherche mis en evidence. */
function surligner(libelle, requete) {
  const terme = normaliser(requete).split(/\s+/).filter(Boolean)[0];
  if (!terme) return libelle;
  const plat = normaliser(libelle);
  // Une lettre qui change de longueur en perdant son accent decalerait
  // tout : on renonce alors a surligner.
  if (plat.length !== libelle.length) return libelle;
  const debut = plat.indexOf(terme);
  if (debut < 0) return libelle;
  return (
    <>
      {libelle.slice(0, debut)}
      <mark>{libelle.slice(debut, debut + terme.length)}</mark>
      {libelle.slice(debut + terme.length)}
    </>
  );
}

/**
 * Un choix parmi une longue liste, sur une page a lui -- pour le telephone.
 *
 * Sur un telephone, la liste native de deux cents pays ou de quatre cents
 * fuseaux se parcourt au doigt, ligne a ligne, dans une roue etroite. Ici,
 * toucher le champ ouvre une page entiere : un titre et un retour en
 * haut, la recherche juste dessous, et la liste sur toute la hauteur.
 * "fra", "Germany", "+33", "español" ou "UTC+3" menent au bon endroit,
 * accents et majuscules indifferents.
 *
 * Le bouton "retour" d'Android referme la page sans quitter le formulaire
 * -- ce qui ferait perdre l'etape en cours.
 *
 * Sur ordinateur, le formulaire garde ses listes natives : ce composant ne
 * sert que sur un petit ecran.
 *
 * `groupes` : [{ libelle?, options: [{ valeur, libelle, detail?,
 * motsCles?, affichage? }] }]. `detail` s'affiche a droite ("+261",
 * "UTC+3") ; `motsCles` se cherchent sans s'afficher ; `affichage` est le
 * texte du champ ferme, s'il differe du libelle.
 */
export default function ChoixSurPage({
  id,
  className = '',
  nom,
  valeur,
  groupes,
  indice = '',
  indiceRecherche = 'Rechercher…',
  rendu,
  onChoisir,
  onQuitter,
  disabled = false,
  ...attributs
}) {
  const base = useId();
  const idTitre = `${base}titre`;

  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState('');
  const declencheur = useRef(null);
  const page = useRef(null);
  const liste = useRef(null);
  const champRecherche = useRef(null);
  const ouvertMaintenant = useRef(false);

  /* Chaque option, avec le texte ou on la cherche. */
  const sections = useMemo(
    () =>
      (groupes ?? [])
        .map((groupe) => ({
          libelle: groupe.libelle,
          options: groupe.options.map((option) => {
            const texte = normaliser(
              [option.libelle, option.detail, ...(option.motsCles ?? [])].filter(Boolean).join(' ')
            );
            return { ...option, texte, mots: mots(texte) };
          }),
        }))
        .filter((groupe) => groupe.options.length > 0),
    [groupes]
  );
  const toutes = useMemo(() => sections.flatMap((groupe) => groupe.options), [sections]);
  const selection = toutes.find((option) => option.valeur === valeur);

  const trouves = useMemo(() => rechercher(toutes, recherche), [toutes, recherche]);
  const affichees = trouves ? [{ options: trouves }] : sections;

  /* ---------------- Ouvrir, refermer, choisir ---------------- */

  function ouvrir() {
    if (disabled || ouvertMaintenant.current) return;
    ouvertMaintenant.current = true;
    flushSync(() => {
      setRecherche('');
      setOuvert(true);
    });
    // Dans le geste meme : c'est la seule facon d'ouvrir le clavier sur
    // un telephone. La recherche est ce qu'on vient faire ici.
    champRecherche.current?.focus({ preventScroll: true });
  }

  function fermer() {
    if (!ouvertMaintenant.current) return;
    ouvertMaintenant.current = false;
    flushSync(() => setOuvert(false));
    declencheur.current?.focus({ preventScroll: true });
    onQuitter?.();
  }

  function choisir(option) {
    if (option.valeur !== valeur) onChoisir?.(option.valeur);
    fermer();
  }

  // Les ecouteurs poses sur la fenetre appellent la version du dernier rendu.
  const fermerMaintenant = useRef(fermer);
  fermerMaintenant.current = fermer;

  /* ---------------- Effets ---------------- */

  // A l'ouverture, le choix en cours est deja sous les yeux.
  useLayoutEffect(() => {
    if (!ouvert || recherche) return;
    const choisie = liste.current?.querySelector('[aria-selected="true"]');
    if (choisie && liste.current) {
      liste.current.scrollTop =
        choisie.offsetTop - (liste.current.clientHeight - choisie.offsetHeight) / 2;
    }
  }, [ouvert, recherche]);

  // Une nouvelle recherche repart du haut de la liste.
  useLayoutEffect(() => {
    if (ouvert && recherche && liste.current) liste.current.scrollTop = 0;
  }, [ouvert, recherche]);

  // La page prend la hauteur que laisse le clavier ; la page du
  // formulaire, dessous, ne defile plus.
  useLayoutEffect(() => {
    if (!ouvert) return undefined;
    const zone = window.visualViewport;
    const cadre = page.current;
    function ajuster() {
      if (!zone || !cadre) return;
      cadre.style.setProperty('--zone-hauteur', `${zone.height}px`);
      cadre.style.setProperty('--zone-haut', `${zone.offsetTop}px`);
    }
    ajuster();
    zone?.addEventListener('resize', ajuster);
    zone?.addEventListener('scroll', ajuster);
    const racine = document.documentElement;
    const debordement = racine.style.overflow;
    racine.style.overflow = 'hidden';
    return () => {
      zone?.removeEventListener('resize', ajuster);
      zone?.removeEventListener('scroll', ajuster);
      racine.style.overflow = debordement;
    };
  }, [ouvert]);

  // Le bouton "retour" d'Android referme la page, et non le formulaire :
  // une entree d'historique est ajoutee a l'ouverture, et retiree si
  // l'on referme autrement.
  useEffect(() => {
    if (!ouvert) return undefined;
    let parRetour = false;
    window.history.pushState({ ...window.history.state, choixSurPage: true }, '');
    function retour() {
      parRetour = true;
      fermerMaintenant.current();
    }
    function touche(evenement) {
      if (evenement.key === 'Escape') fermerMaintenant.current();
    }
    window.addEventListener('popstate', retour);
    window.addEventListener('keydown', touche);
    return () => {
      window.removeEventListener('popstate', retour);
      window.removeEventListener('keydown', touche);
      if (!parRetour && window.history.state?.choixSurPage) window.history.back();
    };
  }, [ouvert]);

  /* ---------------- Rendu ---------------- */

  const nombre = trouves?.length ?? toutes.length;

  const pageChoix = (
    <div
      ref={page}
      className="choix-page"
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitre}
    >
      <header className="choix-page__tete">
        <button
          type="button"
          className="choix-page__retour"
          onClick={fermer}
          aria-label="Revenir au formulaire"
        >
          <IconeFlecheGauche />
        </button>
        <h2 className="choix-page__titre" id={idTitre}>
          {nom}
        </h2>
      </header>

      <div className="choix-page__recherche">
        <IconeRecherche className="choix-page__loupe" />
        <input
          ref={champRecherche}
          type="text"
          inputMode="search"
          enterKeyHint="go"
          className="choix-page__saisie"
          aria-label={`Rechercher : ${nom}`}
          placeholder={indiceRecherche}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          value={recherche}
          onChange={(evenement) => setRecherche(evenement.target.value)}
          onKeyDown={(evenement) => {
            // Entree choisit le premier resultat.
            if (evenement.key === 'Enter' && trouves?.length) {
              evenement.preventDefault();
              choisir(trouves[0]);
            }
          }}
        />
        {recherche && (
          <button
            type="button"
            className="choix-page__effacer"
            onClick={() => {
              setRecherche('');
              champRecherche.current?.focus();
            }}
            aria-label="Effacer la recherche"
          >
            <IconeCroix />
          </button>
        )}
      </div>

      <div ref={liste} className="choix-page__liste" role="listbox" aria-label={nom}>
        {affichees.map((section, rang) => (
          <div key={section.libelle ?? rang} role="group" aria-label={section.libelle}>
            {section.libelle && (
              <p className="choix-page__groupe" aria-hidden="true">
                {section.libelle}
              </p>
            )}
            {section.options.map((option) => {
              const choisie = option.valeur === valeur;
              return (
                <div
                  key={option.valeur}
                  role="option"
                  aria-selected={choisie}
                  tabIndex={0}
                  data-valeur={option.valeur}
                  className={`choix-page__option${choisie ? ' choix-page__option--choisie' : ''}`}
                  onClick={() => choisir(option)}
                  onKeyDown={(evenement) => {
                    if (evenement.key === 'Enter' || evenement.key === ' ') {
                      evenement.preventDefault();
                      choisir(option);
                    }
                  }}
                >
                  <span className="choix-page__libelle">
                    {recherche ? surligner(option.libelle, recherche) : option.libelle}
                  </span>
                  {option.detail && <span className="choix-page__detail">{option.detail}</span>}
                  {choisie && <IconeCoche className="choix-page__coche" />}
                </div>
              );
            })}
          </div>
        ))}
        {trouves && trouves.length === 0 && (
          <p className="choix-page__vide">Aucun résultat pour « {recherche.trim()} ».</p>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {recherche ? `${nombre} résultat${nombre > 1 ? 's' : ''}.` : ''}
      </p>
    </div>
  );

  return (
    <>
      <button
        {...attributs}
        ref={declencheur}
        type="button"
        id={id}
        className={`${className} choix-page__declencheur`.trim()}
        aria-haspopup="dialog"
        aria-expanded={ouvert}
        data-vide={!selection}
        data-valeur={valeur ?? ''}
        disabled={disabled}
        onClick={ouvrir}
      >
        {rendu ? (
          rendu(selection)
        ) : (
          <span className="choix-page__valeur">
            {selection ? (selection.affichage ?? selection.libelle) : indice}
          </span>
        )}
      </button>
      {ouvert && createPortal(pageChoix, document.body)}
    </>
  );
}
