/**
 * Service des medias de projet.
 *
 * Un projet peut etre illustre de deux facons :
 *   * un fichier televerse depuis le poste de l'administrateur — il est
 *     stocke dans backend/uploads/medias et servi sous /media ;
 *   * une adresse externe, si la photo ou la video est deja en ligne.
 *
 * Dans les deux cas, le projet ne conserve qu'une adresse (media_url) et la
 * nature du media (media_type). Ce service se charge du premier cas.
 */
import path from 'node:path';

import {
  DOSSIER_MEDIAS,
  PREFIXE_MEDIAS,
  natureDuMedia,
  supprimerFichier,
} from '../middleware/upload.middleware.js';
import { ErreurValidation } from '../shared/errors.js';

/**
 * Enregistre un media deja ecrit sur le disque par le middleware multer.
 *
 * @param {Express.Multer.File} fichier
 * @returns {{ url: string, type: 'PHOTO'|'VIDEO', fileName: string,
 *             mimeType: string, size: number }}
 */
export function enregistrer(fichier) {
  if (!fichier) {
    throw new ErreurValidation('Aucun fichier reçu. Le champ « file » est obligatoire.', {
      file: 'Champ obligatoire',
    });
  }

  const type = natureDuMedia(fichier.mimetype);
  if (!type) {
    // Le filtre multer devrait deja avoir refuse ce cas ; on ne laisse pas
    // trainer le fichier si jamais il passait.
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

/**
 * Supprime un media televerse, a partir de l'adresse stockee sur le projet.
 * Une adresse externe (http…) n'est evidemment pas touchee.
 */
export async function supprimer(adresse) {
  if (typeof adresse !== 'string' || !adresse.startsWith(`${PREFIXE_MEDIAS}/`)) return false;

  // Le chemin est reconstruit depuis le dossier de stockage : une valeur
  // piegee en base ne peut pas faire sortir du dossier.
  const nom = path.basename(adresse);
  await supprimerFichier(path.join(DOSSIER_MEDIAS, nom));
  return true;
}
