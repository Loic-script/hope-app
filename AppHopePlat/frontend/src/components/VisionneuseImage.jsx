import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { IconeCroix } from './admin/AdminIcons.jsx';

/**
 * La visionneuse : une image en grand, par-dessus la page.
 *
 * Posee en portail a la racine du document, et non la ou le composant
 * est ecrit : sans cela, le moindre parent a "overflow: hidden" -- une
 * carte, un volet, un tableau -- la rognerait.
 *
 * Elle se ferme a la croix, au clic sur le fond, et a la touche Echap.
 * Les trois, parce qu'on ne sait pas laquelle la personne cherchera.
 */
export function VisionneuseImage({ src, alt = '', legende = null, onFermer }) {
  useEffect(() => {
    if (!src) return undefined;

    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') onFermer();
    };
    document.addEventListener('keydown', surTouche);

    // La page ne doit pas defiler derriere la visionneuse.
    const defilement = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = defilement;
    };
  }, [src, onFermer]);

  if (!src) return null;

  return createPortal(
    <div
      className="visionneuse"
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image en grand'}
      onClick={onFermer}
    >
      <button type="button" className="visionneuse__fermer" onClick={onFermer} aria-label="Fermer">
        <IconeCroix />
      </button>

      {/*
        Le clic sur l'image ne ferme pas : seul le fond le fait. Sans ce
        garde-fou, viser l'image pour la regarder de plus pres la
        refermerait.
      */}
      <figure className="visionneuse__cadre" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} />
        {legende && <figcaption>{legende}</figcaption>}
      </figure>
    </div>,
    document.body
  );
}

/**
 * Une image qu'on peut agrandir.
 *
 * Le bouton couvre l'image entiere plutot que de se poser dans un coin :
 * on clique naturellement la photo pour la voir, pas une pastille a
 * cote. L'intitule reste pour le clavier et les lecteurs d'ecran, et un
 * repere visuel apparait au survol.
 */
export function PhotoAgrandissable({ src, alt = '', legende = null, className = '', children }) {
  const [ouverte, setOuverte] = useState(false);

  if (!src) return children ?? null;

  return (
    <>
      <button
        type="button"
        className={`photo-voir ${className}`.trim()}
        onClick={() => setOuverte(true)}
        aria-label={alt ? `Voir la photo : ${alt}` : 'Voir la photo'}
      >
        {children ?? <img src={src} alt={alt} />}
        <span className="photo-voir__indice" aria-hidden="true">
          Voir la photo
        </span>
      </button>

      {ouverte && (
        <VisionneuseImage
          src={src}
          alt={alt}
          legende={legende}
          onFermer={() => setOuverte(false)}
        />
      )}
    </>
  );
}
