import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { IconeChevronBas, IconeCoeur, IconeUtilisateur } from '../HopeIcons.jsx';
import { LIEN_CONNEXION, LIEN_DON } from './liens.js';

/**
 * Le bouton d'acces de la barre du site : une seule forme orange pour
 * deux portes.
 *
 *   - la partie principale est un lien dont le mot change toutes les
 *     cinq secondes : "Faire un don", puis "Connexion", puis de nouveau
 *     le don, sans fin. Le passage de l'un a l'autre se fait comme un
 *     dechiffrement : chaque lettre se brouille en caracteres qui
 *     defilent, puis se fixe sur la bonne, de gauche a droite. Le lien
 *     mene la ou son mot le dit ;
 *   - la fleche ouvre un petit menu qui nomme les deux portes en clair,
 *     pour qui ne veut pas attendre le bon mot.
 *
 * Le defilement s'arrete des que la souris ou le clavier est sur le
 * bouton, et tant que le menu est ouvert : la cible ne doit pas bouger
 * sous la main. Moins de mouvement demande : le mot reste "Faire un
 * don", le menu suffit pour l'autre porte.
 *
 * Le menu se ferme a la touche Echap, d'un clic hors de lui, et au
 * changement de page.
 */

const OPTIONS = [
  { cle: 'don', libelle: 'Faire un don', to: LIEN_DON, Icone: IconeCoeur },
  { cle: 'connexion', libelle: 'Connexion', to: LIEN_CONNEXION, Icone: IconeUtilisateur },
];

/** Le temps qu'un mot reste affiche avant de laisser la place a l'autre. */
const CADENCE = 5000;

/* Le dechiffrement : chaque lettre commence a se brouiller un peu apres
   la precedente (ESPACEMENT, plus un hasard), reste brouillee un moment
   (BROUILLAGE, plus un hasard), puis se fixe. Les caracteres qui defilent
   changent toutes les PERIODE millisecondes ; ils sont choisis etroits,
   pour que le mot brouille ne deborde pas de sa case. */
const ESPACEMENT = 45;
const BROUILLAGE = 280;
const PERIODE = 60;
const GLYPHES = 'abcdefghijklnoprstuvxyz0123456789#%*+<>=?!/;:';

function mouvementReduit() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Un mot, lettre par lettre, tel que le bouton le rend. */
function enClair(mot) {
  return [...mot].map((car) => ({ car, brouille: false }));
}

/** Le caractere brouille d'une lettre a un instant : il change par periode, sans hasard a chaque image. */
function glyphe(indice, t) {
  return GLYPHES[(indice * 7 + Math.floor(t / PERIODE) * 13) % GLYPHES.length];
}

export default function BoutonAcces() {
  const emplacement = useLocation();
  const boite = useRef(null);
  const premierChoix = useRef(null);
  const motAffiche = useRef(OPTIONS[0].libelle);

  const [indice, setIndice] = useState(0);
  const [lettres, setLettres] = useState(() => enClair(OPTIONS[0].libelle));
  const [pause, setPause] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  const fige = pause || ouvert || mouvementReduit();

  // Le mot suivant, a la cadence, sauf quand on vise le bouton.
  useEffect(() => {
    if (fige) return undefined;
    const minuterie = setInterval(() => setIndice((courant) => (courant + 1) % OPTIONS.length), CADENCE);
    return () => clearInterval(minuterie);
  }, [fige]);

  // Le dechiffrement, de l'ancien mot vers le nouveau.
  useEffect(() => {
    const nouveau = OPTIONS[indice].libelle;
    const ancien = motAffiche.current;
    motAffiche.current = nouveau;
    if (ancien === nouveau) return undefined;
    if (mouvementReduit()) {
      setLettres(enClair(nouveau));
      return undefined;
    }

    const longueur = Math.max(ancien.length, nouveau.length);
    const plan = Array.from({ length: longueur }, (_, i) => {
      const debut = i * ESPACEMENT + Math.random() * 90;
      return { debut, fin: debut + BROUILLAGE + Math.random() * 260 };
    });
    const depart = performance.now();
    let image = 0;

    const pas = (maintenant) => {
      const t = maintenant - depart;
      let fini = true;
      setLettres(
        plan.map((etape, i) => {
          if (t < etape.debut) {
            fini = false;
            return { car: ancien[i] ?? '', brouille: false };
          }
          if (t < etape.fin) {
            fini = false;
            return { car: glyphe(i, t), brouille: true };
          }
          return { car: nouveau[i] ?? '', brouille: false };
        })
      );
      if (!fini) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [indice]);

  // Le menu se referme quand on change de page.
  useEffect(() => {
    setOuvert(false);
  }, [emplacement.pathname]);

  // Menu ouvert : le premier choix a le focus ; Echap ou un clic dehors le ferme.
  useEffect(() => {
    if (!ouvert) return undefined;
    premierChoix.current?.focus();
    const auClavier = (e) => e.key === 'Escape' && setOuvert(false);
    const auClic = (e) => boite.current && !boite.current.contains(e.target) && setOuvert(false);
    document.addEventListener('keydown', auClavier);
    document.addEventListener('pointerdown', auClic);
    return () => {
      document.removeEventListener('keydown', auClavier);
      document.removeEventListener('pointerdown', auClic);
    };
  }, [ouvert]);

  const courant = OPTIONS[mouvementReduit() ? 0 : indice];

  return (
    <div
      ref={boite}
      className={`vitrine-acces${ouvert ? ' vitrine-acces--ouvert' : ''}`}
      onPointerEnter={() => setPause(true)}
      onPointerLeave={() => setPause(false)}
      onFocus={() => setPause(true)}
      onBlur={(e) => {
        if (!boite.current?.contains(e.relatedTarget)) setPause(false);
      }}
    >
      <Link to={courant.to} className="vitrine-acces__principal">
        {/* Le plus long des deux mots donne la largeur : le bouton ne respire pas. */}
        <span className="vitrine-acces__gabarit" aria-hidden="true">
          Faire un don
        </span>
        {/* Le mot entier pour les lecteurs d'ecran ; les lettres, elles, se brouillent. */}
        <span className="sr-only">{courant.libelle}</span>
        <span className="vitrine-acces__mots" aria-hidden="true">
          <span className="vitrine-acces__mot" data-mot={courant.libelle}>
            {lettres.map(({ car, brouille }, i) => (
              <span key={i} className={`vitrine-acces__lettre${brouille ? ' vitrine-acces__lettre--brouillee' : ''}`}>
                {car === ' ' ? ' ' : car}
              </span>
            ))}
          </span>
        </span>
      </Link>

      <button
        type="button"
        className="vitrine-acces__fleche"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-controls={ouvert ? 'vitrine-acces-menu' : undefined}
        aria-label="Choisir : faire un don ou se connecter"
        onClick={() => setOuvert((o) => !o)}
      >
        <IconeChevronBas />
      </button>

      {ouvert && (
        <ul id="vitrine-acces-menu" className="vitrine-acces__menu" role="menu" aria-label="Faire un don ou se connecter">
          {OPTIONS.map(({ cle, libelle, to, Icone }, rang) => (
            <li key={cle} role="none">
              <Link
                to={to}
                role="menuitem"
                className="vitrine-acces__choix"
                style={{ '--rang': rang }}
                ref={rang === 0 ? premierChoix : undefined}
              >
                <Icone className="vitrine-acces__choix-icone" />
                {libelle}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
