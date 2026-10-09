import path from 'node:path';

import {
  DOSSIER_MEDIAS,
  PREFIXE_MEDIAS,
  natureDuMedia,
  supprimerFichier,
} from '../middleware/upload.middleware.js';
import { ErreurValidation } from '../shared/errors.js';

export function enregistrer(fichier) {
  if (!fichier) {
    throw new ErreurValidation('Aucun fichier reçu. Le champ « file » est obligatoire.', {
      file: 'Champ obligatoire',
    });
  }

  const type = natureDuMedia(fichier.mimetype);
  if (!type) {
    supprimerFichier(fichier.path);
    throw new ErreurValidation('Format de média non pris en charge.', {
      file: 'Format non accepté',
    });
  }

  return {
    url: `${PREFIXE_MEDIAS}/${fichier.filename}`,
    type,
    fileName: fichier.originalname,
    mimeType: fichier.mimetype,
    size: fichier.size,
  };
}

export async function supprimer(adresse) {
  if (typeof adresse !== 'string' || !adresse.startsWith(`${PREFIXE_MEDIAS}/`)) return false;

  const nom = path.basename(adresse);
  await supprimerFichier(path.join(DOSSIER_MEDIAS, nom));
  return true;
}
