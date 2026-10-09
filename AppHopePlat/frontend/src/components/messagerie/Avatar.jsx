import pictogramme from '../../assets/LOGO_PICTOGRAMME_FOND_VIOLET.png';
import { urlMedia } from '../../services/api.js';
import { initiales } from './outils.js';

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
