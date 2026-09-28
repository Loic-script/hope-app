/**
 * Sert un fichier de livraison de tache.
 *
 * Partage par l'espace benevole et par l'administration : seule change
 * la question de savoir qui a le droit de le lire, et c'est le service
 * qui la tranche.
 */
import fs from 'node:fs';
import path from 'node:path';

import { DOSSIER_PREUVES } from '../middleware/upload.middleware.js';
import { ErreurIntrouvable } from '../shared/errors.js';

export function envoyerFichierLivraison(res, fichier) {
  // basename() neutralise toute tentative de remontee de repertoire.
  const cheminAbsolu = path.join(DOSSIER_PREUVES, path.basename(fichier.filePath));
  if (!fs.existsSync(cheminAbsolu)) {
    throw new ErreurIntrouvable('Le fichier de la livraison', fichier.id);
  }

  res.setHeader('Content-Type', fichier.mimeType ?? 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(fichier.fileName ?? 'preuve')}"`
  );
  res.sendFile(cheminAbsolu);
}
