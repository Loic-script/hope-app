import { urlMedia } from '../../services/api.js';
import { initiales } from '../../utils/format.js';
import { PhotoAgrandissable } from '../VisionneuseImage.jsx';

/**
 * Le visage d'une personne : sa photo, qu'un clic agrandit, ou ses
 * initiales a defaut.
 *
 * Sert a reconnaitre quelqu'un d'un coup d'oeil -- un benevole a son
 * profil, un beneficiaire dans la liste. Le disque garde la meme taille
 * avec ou sans photo : une liste ne saute pas quand les images arrivent.
 *
 * @param {{ src?: string|null, nom?: string, taille?: 'petit'|'grand' }} props
 *   src : une adresse /media, ou une adresse signee rendue par l'API
 */
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
