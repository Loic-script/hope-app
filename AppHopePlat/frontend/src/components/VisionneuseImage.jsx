import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { IconeCroix } from './admin/AdminIcons.jsx';

export function VisionneuseImage({ src, alt = '', legende = null, onFermer }) {
  useEffect(() => {
    if (!src) return undefined;

    const surTouche = (evenement) => {
      if (evenement.key === 'Escape') onFermer();
    };
    document.addEventListener('keydown', surTouche);

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

      <figure className="visionneuse__cadre" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={alt} />
        {legende && <figcaption>{legende}</figcaption>}
      </figure>
    </div>,
    document.body
  );
}

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
