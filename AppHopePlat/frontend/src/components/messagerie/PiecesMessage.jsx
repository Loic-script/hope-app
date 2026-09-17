import { useState } from 'react';

import { urlMedia } from '../../services/api.js';
import { VisionneuseImage } from '../VisionneuseImage.jsx';
import { poids } from './outils.js';

/**
 * Les pieces jointes d'un message.
 *
 * - images : une grille de vignettes, qui s'ouvrent en grand ;
 * - video : lue sur place, sans la telecharger d'avance (preload
 *   "metadata" : la duree et la premiere image, rien de plus) ;
 * - PDF : une carte qui s'ouvre dans un onglet, et un bouton pour
 *   l'enregistrer.
 *
 * De simples <img> et <video> : un optimiseur d'images mettrait les
 * fichiers en cache sous une adresse publique, et ce sont des pieces
 * privees.
 */
export default function PiecesMessage({ pieces }) {
  const [agrandie, setAgrandie] = useState(null);

  const images = pieces.filter((piece) => piece.type === 'image');
  const videos = pieces.filter((piece) => piece.type === 'video');
  const pdfs = pieces.filter((piece) => piece.type === 'pdf');

  return (
    <div className="msg-pieces">
      {images.length > 0 && (
        <div className={`msg-pieces__images msg-pieces__images--${Math.min(images.length, 3)}`}>
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              className="msg-pieces__vignette"
              onClick={() => setAgrandie(image)}
              aria-label={`Agrandir la photo ${image.nom}`}
            >
              <img src={urlMedia(image.url)} alt={image.nom} loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {videos.map((video) => (
        <video
          key={video.id}
          className="msg-pieces__video"
          src={urlMedia(video.url)}
          controls
          preload="metadata"
          playsInline
          aria-label={`Vidéo ${video.nom}`}
        />
      ))}

      {pdfs.map((pdf) => (
        <div key={pdf.id} className="msg-pieces__pdf">
          <a className="msg-pieces__pdf-lien" href={urlMedia(pdf.url)} target="_blank" rel="noopener noreferrer">
            <span className="msg-pieces__pdf-icone" aria-hidden="true">PDF</span>
            <span className="msg-pieces__pdf-texte">
              <span className="msg-pieces__pdf-nom">{pdf.nom}</span>
              <span className="msg-pieces__pdf-poids">{poids(pdf.taille)}</span>
            </span>
          </a>
          <a
            className="msg-pieces__enregistrer"
            href={`${urlMedia(pdf.url)}&telecharger=1`}
            rel="noopener noreferrer"
            aria-label={`Enregistrer ${pdf.nom}`}
            title="Enregistrer"
          >
            <IconeTelecharger />
          </a>
        </div>
      ))}

      {agrandie && (
        <VisionneuseImage src={urlMedia(agrandie.url)} alt={agrandie.nom} legende={agrandie.nom} onFermer={() => setAgrandie(null)} />
      )}
    </div>
  );
}

function IconeTelecharger() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
    </svg>
  );
}
