import fs from 'node:fs';
import path from 'node:path';

import { DOSSIER_PREUVES } from '../middleware/upload.middleware.js';
import { ErreurIntrouvable } from '../shared/errors.js';

export function envoyerFichierLivraison(res, fichier) {
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
