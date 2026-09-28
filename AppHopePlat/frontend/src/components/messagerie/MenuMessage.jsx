import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Marge gardee entre le menu et les bords de la fenetre. */
const MARGE = 8;

/**
 * Le bouton ⋯ d'une bulle, et son menu.
 *
 * Le menu est en position fixe, calcule a l'ouverture : sous le bouton
 * s'il y a la place, au-dessus sinon, et cale a gauche ou a droite pour
 * ne jamais sortir de la fenetre. Il se referme au clic exterieur, avec
 * Echap, au defilement et au redimensionnement -- une position calculee
 * ne suit pas un fil qui bouge.
 *
 * @param {{ actions: {cle: string, libelle: string, danger?: boolean,
 *                     onChoisir: () => void}[],
 *           cote: 'gauche'|'droite' }} props
 *        cote : le cote de la bulle, pour aligner le menu sur elle
 */
export default function MenuMessage({ actions, cote }) {
  const [ouvert, setOuvert] = useState(false);
  const [position, setPosition] = useState(null);
  const bouton = useRef(null);
  const menu = useRef(null);

  function fermer(rendreLeFocus = false) {
    setOuvert(false);
    setPosition(null);
    if (rendreLeFocus) bouton.current?.focus();
  }

  // La position se calcule une fois le menu rendu : il faut sa taille.
  useLayoutEffect(() => {
    if (!ouvert || !bouton.current || !menu.current) return;
    const ancre = bouton.current.getBoundingClientRect();
    const taille = menu.current.getBoundingClientRect();

    const dessous = ancre.bottom + 4;
    const top = dessous + taille.height > window.innerHeight - MARGE
      ? Math.max(MARGE, ancre.top - 4 - taille.height)
      : dessous;

    const souhaite = cote === 'droite' ? ancre.right - taille.width : ancre.left;
    const left = Math.min(Math.max(MARGE, souhaite), window.innerWidth - MARGE - taille.width);

    setPosition({ top, left });
  }, [ouvert, cote]);

  // Le focus entre dans le menu une fois celui-ci visible : un element
  // encore masque, le temps de la mesure, ne le prendrait pas.
  useEffect(() => {
    if (ouvert && position) menu.current?.querySelector('[role="menuitem"]')?.focus();
  }, [ouvert, position]);

  useEffect(() => {
    if (!ouvert) return undefined;
    const clicExterieur = (evenement) => {
      if (!menu.current?.contains(evenement.target) && !bouton.current?.contains(evenement.target)) fermer();
    };
    const defilement = (evenement) => {
      if (!menu.current?.contains(evenement.target)) fermer();
    };
    const redimensionnement = () => fermer();

    document.addEventListener('mousedown', clicExterieur);
    document.addEventListener('touchstart', clicExterieur);
    // capture : le fil defile dans son propre conteneur, pas la fenetre.
    window.addEventListener('scroll', defilement, true);
    window.addEventListener('resize', redimensionnement);
    return () => {
      document.removeEventListener('mousedown', clicExterieur);
      document.removeEventListener('touchstart', clicExterieur);
      window.removeEventListener('scroll', defilement, true);
      window.removeEventListener('resize', redimensionnement);
    };
  }, [ouvert]);

  function surTouche(evenement) {
    const elements = [...menu.current.querySelectorAll('[role="menuitem"]')];
    const index = elements.indexOf(document.activeElement);
    const aller = (i) => elements[(i + elements.length) % elements.length]?.focus();

    if (evenement.key === 'Escape') {
      evenement.preventDefault();
      fermer(true);
    } else if (evenement.key === 'ArrowDown') {
      evenement.preventDefault();
      aller(index + 1);
    } else if (evenement.key === 'ArrowUp') {
      evenement.preventDefault();
      aller(index - 1);
    } else if (evenement.key === 'Home') {
      evenement.preventDefault();
      aller(0);
    } else if (evenement.key === 'End') {
      evenement.preventDefault();
      aller(elements.length - 1);
    } else if (evenement.key === 'Tab') {
      fermer();
    }
  }

  if (actions.length === 0) return null;

  return (
    <>
      <button
        ref={bouton}
        type="button"
        className="msg-menu-bouton"
        aria-label="Actions sur le message"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        onClick={() => (ouvert ? fermer() : setOuvert(true))}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="5.5" cy="12" r="1.8" fill="currentColor" />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" />
          <circle cx="18.5" cy="12" r="1.8" fill="currentColor" />
        </svg>
      </button>

      {ouvert && (
        <div
          ref={menu}
          className="msg-menu"
          role="menu"
          aria-label="Actions sur le message"
          onKeyDown={surTouche}
          // Invisible le temps de mesurer, pour ne pas clignoter au mauvais endroit.
          style={position ? { top: position.top, left: position.left } : { top: 0, left: 0, visibility: 'hidden' }}
        >
          {actions.map((action) => (
            <button
              key={action.cle}
              type="button"
              role="menuitem"
              className={`msg-menu__action${action.danger ? ' msg-menu__action--danger' : ''}`}
              onClick={() => {
                fermer();
                action.onChoisir();
              }}
            >
              {action.libelle}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
