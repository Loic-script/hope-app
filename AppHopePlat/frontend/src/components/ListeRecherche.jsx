import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';

import { IconeCoche, IconeCroix, IconeRecherche } from './HopeIcons.jsx';

/** Au-dela de ce nombre de choix, la liste s'ouvre avec sa recherche. */
const SEUIL_RECHERCHE = 6;

/** Sur un ecran de telephone, la liste s'ouvre en panneau par-dessus la page. */
const ECRAN_ETROIT = '(max-width: 640px)';

/** Hauteur de la liste deroulee sur ordinateur, et celle de sa recherche. */
const HAUTEUR_LISTE = 320;
const HAUTEUR_RECHERCHE = 66;

/** "Réunion" et "reunion", "ESPAÑOL" et "espanol" se valent. */
export function normaliser(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
 * Une liste de choix que l'on peut fouiller.
 *
 * Une liste native de deux cents pays se parcourt au doigt, ligne a
 * ligne : sur Android, trouver "Royaume-Uni" ou "+33" y prend une minute.
 * Ici, la liste s'ouvre avec un champ de recherche : "fra", "+33", "33"
 * ou "France" menent au meme endroit, accents et majuscules indifferents.
 *
 * Sur ordinateur, elle se deroule sous le champ (ou au-dessus, s'il n'y a
 * pas la place dessous). Sur telephone, elle s'ouvre en panneau par-dessus
 * la page, a la hauteur que laisse le clavier ; le bouton "retour"
 * d'Android la referme sans quitter la page.
 *
 * Au clavier : fleches pour parcourir, Entree pour choisir, Echap pour
 * refermer. Taper une lettre sur le champ ferme ouvre la recherche avec
 * cette lettre. Les lecteurs d'ecran y trouvent le motif des listes a
 * recherche : une liste deroulante qui ouvre un champ de recherche relie a
 * ses options, et le nombre de resultats annonce.
 *
 * `groupes` : [{ libelle?, options: [{ valeur, libelle, detail?,
 * motsCles?, affichage? }] }]. `detail` s'affiche a droite ("+261",
 * "UTC+3") ; `motsCles` se cherchent sans s'afficher ; `affichage` est le
 * texte du champ ferme, s'il differe du libelle.
 */
export default function ListeRecherche({
  id,
  className = '',
  classePanneau = '',
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
  const idListe = `${base}liste`;
  const idOption = (position) => `${base}option-${position}`;

  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [actif, setActif] = useState(0);
  const [disposition, setDisposition] = useState({ ecran: false, versLeHaut: false, hauteur: null });

  const declencheur = useRef(null);
  const cadre = useRef(null);
  const liste = useRef(null);
  const champRecherche = useRef(null);
  // Lu par les gestionnaires d'evenements, plus a jour que l'etat.
  const ouvertMaintenant = useRef(false);
  const ouverteAuPointeur = useRef(false);
  const centrer = useRef(false);

  /* Chaque option, avec le texte ou on la cherche. */
  const sectionsCompletes = useMemo(
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
  const toutes = useMemo(() => sectionsCompletes.flatMap((groupe) => groupe.options), [sectionsCompletes]);
  const avecRecherche = toutes.length > SEUIL_RECHERCHE;
  const selection = toutes.find((option) => option.valeur === valeur);

  /* Ce que montre la liste : les groupes, ou les resultats de la recherche. */
  const { sections, resultats } = useMemo(() => {
    const trouves = rechercher(toutes, recherche);
    let position = 0;
    const faites = trouves
      ? [{ options: trouves.map((option) => ({ option, position: position++ })) }]
      : sectionsCompletes.map((groupe) => ({
          libelle: groupe.libelle,
          options: groupe.options.map((option) => ({ option, position: position++ })),
        }));
    return { sections: faites, resultats: faites.flatMap((groupe) => groupe.options) };
  }, [toutes, sectionsCompletes, recherche]);

  const enRecherche = recherche.trim() !== '';
  const annonce = enRecherche
    ? resultats.length === 0
      ? 'Aucun résultat.'
      : `${resultats.length} résultat${resultats.length > 1 ? 's' : ''}.`
    : '';

  /* ---------------- Ouvrir, refermer, choisir ---------------- */

  function ouvrir(texteInitial = '') {
    if (disabled || ouvertMaintenant.current) return;
    const ecran = window.matchMedia?.(ECRAN_ETROIT)?.matches ?? false;

    // Sur ordinateur : dessous s'il y a la place, sinon du cote le plus
    // grand ; jamais plus haut que ce que la fenetre laisse voir.
    let versLeHaut = false;
    let hauteur = null;
    if (!ecran) {
      const boite = (declencheur.current.offsetParent ?? declencheur.current).getBoundingClientRect();
      const entete = avecRecherche ? HAUTEUR_RECHERCHE : 0;
      const dessous = window.innerHeight - boite.bottom - 20;
      const dessus = boite.top - 20;
      versLeHaut = dessous < Math.min(HAUTEUR_LISTE, 220) + entete && dessus > dessous;
      hauteur = Math.max(140, Math.min(HAUTEUR_LISTE, (versLeHaut ? dessus : dessous) - entete));
    }

    const depart = texteInitial ? 0 : toutes.findIndex((option) => option.valeur === valeur);
    ouvertMaintenant.current = true;
    centrer.current = depart > 0;
    flushSync(() => {
      setDisposition({ ecran, versLeHaut, hauteur });
      setRecherche(texteInitial);
      setActif(Math.max(0, depart));
      setOuvert(true);
    });

    // Dans le geste meme : iOS n'ouvre le clavier qu'a cette condition.
    const cible = champRecherche.current ?? liste.current;
    cible?.focus({ preventScroll: true });
    if (texteInitial && champRecherche.current) {
      champRecherche.current.setSelectionRange(texteInitial.length, texteInitial.length);
    }
  }

  function fermer(rendreLeFocus) {
    if (!ouvertMaintenant.current) return;
    ouvertMaintenant.current = false;
    ouverteAuPointeur.current = false;
    flushSync(() => {
      setOuvert(false);
      setRecherche('');
    });
    if (rendreLeFocus) declencheur.current?.focus({ preventScroll: disposition.ecran });
    onQuitter?.();
  }

  function choisir(option) {
    if (option.valeur !== valeur) onChoisir?.(option.valeur);
    fermer(true);
  }

  // Les ecouteurs poses sur le document appellent toujours la version du
  // dernier rendu.
  const fermerMaintenant = useRef(fermer);
  fermerMaintenant.current = fermer;

  /*
   * A la souris, la liste s'ouvre des l'appui, comme une liste native.
   * Attendre le clic, c'est risquer de le perdre : quitter le champ
   * precedent peut y faire paraitre un message d'erreur, la page descend
   * de quelques pixels entre l'appui et le relachement, et le clic tombe
   * a cote. Au doigt, on attend le toucher entier : un glissement fait
   * defiler la page sans rien ouvrir.
   */
  function appui(evenement) {
    if (evenement.pointerType !== 'mouse' || evenement.button !== 0 || evenement.ctrlKey) return;
    if (ouvertMaintenant.current) return;
    ouverteAuPointeur.current = true;
    ouvrir();
  }

  function clic() {
    if (ouverteAuPointeur.current) {
      ouverteAuPointeur.current = false;
      return;
    }
    if (ouvertMaintenant.current) fermer(true);
    else ouvrir();
  }

  /* ---------------- Clavier ---------------- */

  function toucheDeclencheur(evenement) {
    if (ouvertMaintenant.current) return;
    if (evenement.key === 'ArrowDown' || evenement.key === 'ArrowUp') {
      evenement.preventDefault();
      ouvrir();
      return;
    }
    // Une lettre tapee sur le champ ferme : on cherche aussitot.
    const lettre =
      evenement.key.length === 1 &&
      evenement.key !== ' ' &&
      !evenement.ctrlKey &&
      !evenement.metaKey &&
      !evenement.altKey;
    if (lettre && avecRecherche) {
      evenement.preventDefault();
      ouvrir(evenement.key);
    }
  }

  function toucheListe(evenement) {
    const dernier = resultats.length - 1;
    const deplacer = (vers) => {
      evenement.preventDefault();
      setActif(Math.max(0, Math.min(dernier, vers)));
    };
    switch (evenement.key) {
      case 'ArrowDown':
        deplacer(actif + 1);
        break;
      case 'ArrowUp':
        deplacer(actif - 1);
        break;
      case 'PageDown':
        deplacer(actif + 8);
        break;
      case 'PageUp':
        deplacer(actif - 8);
        break;
      case 'Home':
      case 'End':
        // Dans la recherche, ces touches deplacent le curseur du texte.
        if (!avecRecherche) deplacer(evenement.key === 'Home' ? 0 : dernier);
        break;
      case 'Enter':
        evenement.preventDefault();
        if (resultats[actif]) choisir(resultats[actif].option);
        break;
      case ' ':
        if (!avecRecherche) {
          evenement.preventDefault();
          if (resultats[actif]) choisir(resultats[actif].option);
        }
        break;
      case 'Escape':
        evenement.preventDefault();
        evenement.stopPropagation();
        fermer(true);
        break;
      case 'Tab':
        // La liste se referme et le focus repart du champ : Tab mene au
        // champ suivant, Maj+Tab au precedent.
        fermer(true);
        break;
      default:
        // Liste courte, sans recherche : une lettre mene a la premiere
        // option qui commence par elle.
        if (!avecRecherche && evenement.key.length === 1 && !evenement.ctrlKey && !evenement.metaKey) {
          const lettre = normaliser(evenement.key);
          const suivante = resultats.findIndex(
            ({ position, option }) => position > actif && normaliser(option.libelle).startsWith(lettre)
          );
          const premiere = resultats.findIndex(({ option }) => normaliser(option.libelle).startsWith(lettre));
          const cible = suivante >= 0 ? suivante : premiere;
          if (cible >= 0) deplacer(cible);
        }
    }
  }

  /** Le champ perd le focus alors que la liste est fermee : on l'a quitte. */
  function quitterDeclencheur() {
    if (!ouvertMaintenant.current) onQuitter?.();
  }

  /* ---------------- Effets ---------------- */

  // L'option active reste visible ; a l'ouverture, le choix en cours est
  // centre dans la liste.
  useLayoutEffect(() => {
    if (!ouvert) return;
    const boite = liste.current;
    const element = boite?.querySelector(`[data-position="${actif}"]`);
    if (!boite || !element) {
      if (boite) boite.scrollTop = 0;
      return;
    }
    const haut = element.offsetTop;
    const bas = haut + element.offsetHeight;
    // Les titres de groupe restent colles en haut : l'option ne doit pas
    // passer dessous.
    const titre = boite.querySelector('.liste-recherche__groupe')?.offsetHeight ?? 0;
    if (centrer.current) {
      boite.scrollTop = haut - (boite.clientHeight - element.offsetHeight) / 2;
      centrer.current = false;
    } else if (haut - titre < boite.scrollTop) {
      boite.scrollTop = haut - titre - 4;
    } else if (bas > boite.scrollTop + boite.clientHeight) {
      boite.scrollTop = bas - boite.clientHeight + 4;
    }
  }, [ouvert, actif, recherche]);

  // Sur ordinateur, un clic ailleurs referme la liste.
  useEffect(() => {
    if (!ouvert || disposition.ecran) return undefined;
    function ailleurs(evenement) {
      if (cadre.current?.contains(evenement.target)) return;
      if (declencheur.current?.contains(evenement.target)) return;
      fermerMaintenant.current(false);
    }
    document.addEventListener('pointerdown', ailleurs, true);
    return () => document.removeEventListener('pointerdown', ailleurs, true);
  }, [ouvert, disposition.ecran]);

  // Sur telephone : le panneau prend la hauteur que laisse le clavier, et
  // la page, dessous, ne defile plus.
  useLayoutEffect(() => {
    if (!ouvert || !disposition.ecran) return undefined;
    const zone = window.visualViewport;
    const panneau = cadre.current;
    function ajuster() {
      if (!zone || !panneau) return;
      panneau.style.setProperty('--zone-hauteur', `${zone.height}px`);
      panneau.style.setProperty('--zone-haut', `${zone.offsetTop}px`);
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
  }, [ouvert, disposition.ecran]);

  // Sur telephone, le panneau occupe l'ecran : le bouton "retour"
  // d'Android doit le refermer, et non quitter la page -- ce qui ferait
  // perdre l'etape en cours. Une entree d'historique est ajoutee a
  // l'ouverture ; elle est retiree si l'on referme autrement.
  useEffect(() => {
    if (!ouvert || !disposition.ecran) return undefined;
    let parRetour = false;
    window.history.pushState({ ...window.history.state, listeRecherche: true }, '');
    function retour() {
      parRetour = true;
      fermerMaintenant.current(true);
    }
    window.addEventListener('popstate', retour);
    return () => {
      window.removeEventListener('popstate', retour);
      if (!parRetour && window.history.state?.listeRecherche) window.history.back();
    };
  }, [ouvert, disposition.ecran]);

  /* ---------------- Rendu ---------------- */

  const classesPanneau = [
    'liste-recherche__panneau',
    disposition.ecran && 'liste-recherche__panneau--ecran',
    disposition.ecran && !avecRecherche && 'liste-recherche__panneau--court',
    !disposition.ecran && disposition.versLeHaut && 'liste-recherche__panneau--haut',
    classePanneau,
  ]
    .filter(Boolean)
    .join(' ');

  const panneau = (
    <>
      {disposition.ecran && (
        <div className="liste-recherche__voile" aria-hidden="true" onClick={() => fermer(true)} />
      )}
      <div
        ref={cadre}
        className={classesPanneau}
        role={disposition.ecran ? 'dialog' : undefined}
        aria-modal={disposition.ecran ? true : undefined}
        aria-label={disposition.ecran ? nom : undefined}
        // Un clic dans le panneau laisse le focus a la recherche : le
        // clavier du telephone ne se ferme pas a chaque geste.
        onMouseDown={(evenement) => {
          if (evenement.target !== champRecherche.current) evenement.preventDefault();
        }}
      >
        {disposition.ecran && (
          <div className="liste-recherche__tete">
            <p className="liste-recherche__titre">{nom}</p>
            <button
              type="button"
              className="liste-recherche__fermer"
              onClick={() => fermer(true)}
              aria-label="Fermer la liste"
            >
              <IconeCroix />
            </button>
          </div>
        )}

        {avecRecherche && (
          <div className="liste-recherche__recherche">
            <IconeRecherche className="liste-recherche__loupe" />
            <input
              ref={champRecherche}
              type="text"
              inputMode="search"
              enterKeyHint="go"
              className="liste-recherche__saisie"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={idListe}
              aria-activedescendant={resultats[actif] ? idOption(actif) : undefined}
              aria-label={`Rechercher : ${nom}`}
              placeholder={indiceRecherche}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={recherche}
              onChange={(evenement) => {
                setRecherche(evenement.target.value);
                setActif(0);
              }}
              onKeyDown={toucheListe}
            />
            {recherche && (
              <button
                type="button"
                className="liste-recherche__effacer"
                onClick={() => {
                  setRecherche('');
                  setActif(0);
                  champRecherche.current?.focus();
                }}
                aria-label="Effacer la recherche"
              >
                <IconeCroix />
              </button>
            )}
          </div>
        )}

        <div
          ref={liste}
          id={idListe}
          role="listbox"
          aria-label={nom}
          className="liste-recherche__liste"
          style={disposition.hauteur ? { maxHeight: disposition.hauteur } : undefined}
          tabIndex={avecRecherche ? -1 : 0}
          aria-activedescendant={!avecRecherche && resultats[actif] ? idOption(actif) : undefined}
          onKeyDown={avecRecherche ? undefined : toucheListe}
        >
          {sections.map((section, rang) => {
            const options = section.options.map(({ option, position }) => {
              const choisie = option.valeur === valeur;
              return (
                <div
                  key={option.valeur}
                  id={idOption(position)}
                  role="option"
                  aria-selected={choisie}
                  data-position={position}
                  data-valeur={option.valeur}
                  className={`liste-recherche__option${
                    position === actif ? ' liste-recherche__option--active' : ''
                  }`}
                  onPointerMove={(evenement) => {
                    if (evenement.pointerType === 'mouse' && position !== actif) setActif(position);
                  }}
                  onClick={() => choisir(option)}
                >
                  <span className="liste-recherche__libelle">
                    {enRecherche ? surligner(option.libelle, recherche) : option.libelle}
                  </span>
                  {option.detail && <span className="liste-recherche__detail">{option.detail}</span>}
                  <IconeCoche className="liste-recherche__coche" />
                </div>
              );
            });
            if (!section.libelle) return <div key={rang} role="presentation">{options}</div>;
            const idGroupe = `${base}groupe-${rang}`;
            return (
              <div key={rang} role="group" aria-labelledby={idGroupe}>
                <div className="liste-recherche__groupe" id={idGroupe} role="presentation">
                  {section.libelle}
                </div>
                {options}
              </div>
            );
          })}
        </div>

        {enRecherche && resultats.length === 0 && (
          <p className="liste-recherche__vide">
            Aucun résultat pour « {recherche.trim()} ».
          </p>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {annonce}
        </p>
      </div>
    </>
  );

  return (
    <>
      <button
        {...attributs}
        ref={declencheur}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={ouvert ? idListe : undefined}
        className={`${className} liste-recherche__declencheur`.trim()}
        data-vide={!selection}
        data-valeur={valeur ?? ''}
        disabled={disabled}
        onPointerDown={appui}
        // Ouverte a l'appui, la liste garde le focus dans sa recherche :
        // le champ ne doit pas le reprendre dans la foulee.
        onMouseDown={(evenement) => {
          if (ouverteAuPointeur.current) evenement.preventDefault();
        }}
        onClick={clic}
        onKeyDown={toucheDeclencheur}
        onBlur={quitterDeclencheur}
      >
        {rendu ? (
          rendu(selection)
        ) : (
          <span className="liste-recherche__valeur">
            {selection ? selection.affichage ?? selection.libelle : indice}
          </span>
        )}
      </button>
      {ouvert && (disposition.ecran ? createPortal(panneau, document.body) : panneau)}
    </>
  );
}
