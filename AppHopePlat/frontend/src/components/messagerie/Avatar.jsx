import pictogramme from '../../assets/LOGO_PICTOGRAMME_FOND_VIOLET.png';
import { urlMedia } from '../../services/api.js';
import { initiales } from './outils.js';

/**
 * La pastille d'une personne, d'un groupe ou de l'equipe.
 *
 * L'equipe porte le pictogramme HOPE : dans un fil d'assistance,
 * l'utilisateur ne parle pas a une personne mais a l'association. A
 * defaut de photo, les initiales -- d'un nom ou d'un groupe.
 *
 * @param {{ nom: string, photoUrl?: string|null, src?: string|null,
 *           equipe?: boolean, taille?: 'petite'|'moyenne'|'grande' }} props
 *        src : l'adresse signee d'une photo de groupe ;
 *        photoUrl : un chemin /media. Les deux sont completes ici.
 */
export default function Avatar({ nom, photoUrl = null, src = null, equipe = false, taille = 'moyenne' }) {
  const classe = `msg-avatar msg-avatar--${taille}`;

  if (equipe) {
    return (
      <span className={`${classe} msg-avatar--equipe`} aria-hidden="true">
        <img src={pictogramme} alt="" />
      </span>
    );
  }

  const adresse = src ? urlMedia(src) : photoUrl ? urlMedia(photoUrl) : null;
  return (
    <span className={classe} aria-hidden="true">
      {adresse ? <img src={adresse} alt="" /> : initiales(nom)}
    </span>
  );
}
