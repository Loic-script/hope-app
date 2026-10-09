import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';

import { IconeCroix } from './admin/AdminIcons.jsx';
import { IconeCoche, IconeFlecheGauche, IconeRecherche } from './HopeIcons.jsx';

export function normaliser(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function parLettre(options, cle = (option) => option.libelle) {
  const sections = new Map();
  for (const option of options) {
    const lettre = normaliser(cle(option)).replace(/[^a-z]/g, '').charAt(0).toUpperCase() || '#';
    if (!sections.has(lettre)) sections.set(lettre, []);
    sections.get(lettre).push(option);
  }
  return [...sections.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lettre, liste]) => ({ libelle: lettre, lettre, options: liste }));
}

function mots(texte) {
  const bruts = texte.split(/[\s,()/·.’']+/).filter(Boolean);
  return [...new Set([...bruts, ...bruts.flatMap((mot) => mot.split('-'))])].filter(Boolean);
}

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

function surligner(texte, requete) {
  const terme = normaliser(requete).split(/\s+/).filter(Boolean)[0];
  if (!terme || !texte) return texte;
  const plat = normaliser(texte);
  if (plat.length !== texte.length) return texte;
  const debut = plat.indexOf(terme);
  if (debut < 0) return texte;
  return (
    <>
      {texte.slice(0, debut)}
      <mark>{texte.slice(debut, debut + terme.length)}</mark>
      {texte.slice(debut + terme.length)}
    </>
  );
}

function drapeauEmoji(code) {
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split('')
      .map((lettre) => 0x1f1a5 + lettre.charCodeAt(0))
  );
}

let drapeauxEnCouleur = null;

function drapeauxDessines() {
  if (drapeauxEnCouleur !== null) return drapeauxEnCouleur;
  drapeauxEnCouleur = false;
  try {
    const toile = document.createElement('canvas');
    toile.width = 28;
    toile.height = 28;
    const pinceau = toile.getContext('2d', { willReadFrequently: true });
    pinceau.textBaseline = 'top';
    pinceau.font = '22px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    pinceau.fillText(drapeauEmoji('FR'), 0, 0);
    const points = pinceau.getImageData(0, 0, 28, 28).data;
    for (let i = 0; i < points.length; i += 4) {
      const [rouge, vert, bleu, opacite] = points.slice(i, i + 4);
      if (opacite > 0 && (Math.abs(rouge - vert) > 40 || Math.abs(vert - bleu) > 40)) {
        drapeauxEnCouleur = true;
        break;
      }
    }
  } catch {
  }
  return drapeauxEnCouleur;
}

function Visuel({ option }) {
  if (option.drapeau && drapeauxDessines()) {
    return (
      <span className="choix-page__drapeau" aria-hidden="true">
        {drapeauEmoji(option.drapeau)}
      </span>
    );
  }
  const pastille = option.pastille ?? option.drapeau;
  if (!pastille) return null;
  return (
    <span className="choix-page__pastille" aria-hidden="true">
      {pastille}
    </span>
  );
}

function lettreSous(evenement) {
  const cible = document.elementFromPoint(evenement.clientX, evenement.clientY);
  return cible?.closest?.('[data-index-lettre]')?.dataset.indexLettre ?? null;
}

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
  const [defile, setDefile] = useState(false);
  const [lettreVue, setLettreVue] = useState(null);
  const declencheur = useRef(null);
  const page = useRef(null);
  const liste = useRef(null);
  const champRecherche = useRef(null);
  const ouvertMaintenant = useRef(false);
  const minuterieLettre = useRef(0);

  const sections = useMemo(
    () =>
      (groupes ?? [])
        .map((groupe, rang) => ({
          cle: groupe.lettre ?? groupe.libelle ?? `groupe-${rang}`,
          libelle: groupe.libelle,
          lettre: groupe.lettre,
          options: groupe.options.map((option) => {
            const texte = normaliser(
              [option.libelle, option.sousTitre, option.detail, ...(option.motsCles ?? [])]
                .filter(Boolean)
                .join(' ')
            );
            return { ...option, texte, mots: mots(texte) };
          }),
        }))
        .filter((groupe) => groupe.options.length > 0),
    [groupes]
  );

  const toutes = useMemo(() => {
    const vues = new Set();
    const uniques = [];
    for (const option of sections.flatMap((groupe) => groupe.options)) {
      if (vues.has(option.valeur)) continue;
      vues.add(option.valeur);
      uniques.push(option);
    }
    return uniques;
  }, [sections]);
  const selection = toutes.find((option) => option.valeur === valeur);
  const lettres = useMemo(
    () => sections.filter((groupe) => groupe.lettre).map((groupe) => groupe.lettre),
    [sections]
  );

  const trouves = useMemo(() => rechercher(toutes, recherche), [toutes, recherche]);
  let affichees = sections;
  if (trouves) {
    affichees =
      trouves.length > 0
        ? [
            {
              cle: 'resultats',
              libelle: `${trouves.length} résultat${trouves.length > 1 ? 's' : ''}`,
              resultats: true,
              options: trouves,
            },
          ]
        : [];
  }
  const avecIndex = !trouves && lettres.length >= 8;

  function ouvrir() {
    if (disabled || ouvertMaintenant.current) return;
    ouvertMaintenant.current = true;
    flushSync(() => {
      setRecherche('');
      setDefile(false);
      setLettreVue(null);
      setOuvert(true);
    });
    page.current?.focus({ preventScroll: true });
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

  function allerA(lettre) {
    const cadre = liste.current;
    const section = cadre?.querySelector(`[data-lettre="${lettre}"]`);
    if (!cadre || !section) return;
    cadre.scrollTop = section.offsetTop;
    setLettreVue(lettre);
    window.clearTimeout(minuterieLettre.current);
    minuterieLettre.current = window.setTimeout(() => setLettreVue(null), 700);
  }

  const fermerMaintenant = useRef(fermer);
  fermerMaintenant.current = fermer;

  useLayoutEffect(() => {
    if (!ouvert || recherche) return;
    const cadre = liste.current;
    const choisie = cadre?.querySelector('[aria-selected="true"]');
    if (cadre && choisie) {
      cadre.scrollTop = Math.max(0, choisie.offsetTop - (cadre.clientHeight - choisie.offsetHeight) / 2);
    }
  }, [ouvert, recherche]);

  useLayoutEffect(() => {
    if (ouvert && recherche && liste.current) liste.current.scrollTop = 0;
  }, [ouvert, recherche]);

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

  useEffect(() => () => window.clearTimeout(minuterieLettre.current), []);

  const nombre = trouves?.length ?? toutes.length;

  const pageChoix = (
    <div
      ref={page}
      className={`choix-page${defile ? ' choix-page--defile' : ''}${avecIndex ? ' choix-page--index' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={idTitre}
      tabIndex={-1}
    >
      <div className="choix-page__entete">
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
      </div>

      <div className="choix-page__corps">
        <div
          ref={liste}
          className="choix-page__liste"
          role="listbox"
          aria-label={nom}
          onScroll={(evenement) => setDefile(evenement.currentTarget.scrollTop > 2)}
          onTouchMove={() => {
            if (document.activeElement === champRecherche.current) champRecherche.current.blur();
          }}
        >
          {affichees.map((section) => (
            <div
              key={section.cle}
              className="choix-page__section"
              role="group"
              aria-label={section.libelle}
              data-lettre={section.lettre}
            >
              {section.libelle && (
                <p
                  className={`choix-page__groupe${section.lettre ? ' choix-page__groupe--lettre' : ''}${
                    section.resultats ? ' choix-page__groupe--resultats' : ''
                  }`}
                  aria-hidden="true"
                >
                  {section.libelle}
                </p>
              )}
              {section.options.map((option) => {
                const choisie = option.valeur === valeur;
                const visuel = Boolean(option.drapeau || option.pastille);
                return (
                  <div
                    key={`${section.cle}:${option.valeur}`}
                    role="option"
                    aria-selected={choisie}
                    tabIndex={0}
                    data-valeur={option.valeur}
                    className={`choix-page__option${visuel ? ' choix-page__option--visuel' : ''}${
                      choisie ? ' choix-page__option--choisie' : ''
                    }`}
                    onClick={() => choisir(option)}
                    onKeyDown={(evenement) => {
                      if (evenement.key === 'Enter' || evenement.key === ' ') {
                        evenement.preventDefault();
                        choisir(option);
                      }
                    }}
                  >
                    <Visuel option={option} />
                    <span className="choix-page__textes">
                      <span className="choix-page__libelle">
                        {recherche ? surligner(option.libelle, recherche) : option.libelle}
                      </span>
                      {option.sousTitre && (
                        <span className="choix-page__sous-titre">
                          {recherche ? surligner(option.sousTitre, recherche) : option.sousTitre}
                        </span>
                      )}
                    </span>
                    {option.detail && <span className="choix-page__detail">{option.detail}</span>}
                    <span className="choix-page__marque">
                      {choisie && <IconeCoche className="choix-page__coche" />}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
          {trouves && trouves.length === 0 && (
            <p className="choix-page__vide">Aucun résultat pour « {recherche.trim()} ».</p>
          )}
        </div>

        {avecIndex && (
          <div
            className="choix-page__index"
            role="navigation"
            aria-label="Aller à une lettre"
            onPointerDown={(evenement) => {
              evenement.currentTarget.setPointerCapture?.(evenement.pointerId);
              const lettre = lettreSous(evenement);
              if (lettre) allerA(lettre);
            }}
            onPointerMove={(evenement) => {
              if (evenement.pointerType !== 'touch' && !evenement.buttons) return;
              const lettre = lettreSous(evenement);
              if (lettre && lettre !== lettreVue) allerA(lettre);
            }}
          >
            {lettres.map((lettre) => (
              <button
                key={lettre}
                type="button"
                data-index-lettre={lettre}
                onClick={() => allerA(lettre)}
                aria-label={`Aller à la lettre ${lettre}`}
              >
                {lettre}
              </button>
            ))}
          </div>
        )}
        {lettreVue && (
          <span className="choix-page__bulle" aria-hidden="true">
            {lettreVue}
          </span>
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
