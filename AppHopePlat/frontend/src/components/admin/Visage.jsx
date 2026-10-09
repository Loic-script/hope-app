import { urlMedia } from '../../services/api.js';
import { initiales } from '../../utils/format.js';
import { PhotoAgrandissable } from '../VisionneuseImage.jsx';

export default function Visage({ src, nom = '', taille = 'petit' }) {
  const adresse = src ? urlMedia(src) : null;
  const alt = nom ? `Photo de ${nom}` : 'Photo';

  return (
    <span className={`visage visage--${taille}`}>
      {adresse ? (
        <PhotoAgrandissable src={adresse} alt={alt} legende={nom || null} className="photo-voir--pastille">
          <img src={adresse} alt={alt} loading="lazy" />
        </PhotoAgrandissable>
      ) : (
        <span className="visage__initiales" aria-hidden="true">
          {initiales(nom)}
        </span>
      )}
    </span>
  );
}
