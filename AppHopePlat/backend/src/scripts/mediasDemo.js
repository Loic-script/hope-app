import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOSSIER_MEDIAS, PREFIXE_MEDIAS } from '../middleware/upload.middleware.js';

export const DOSSIER_MEDIAS_DEMO = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'medias-demo'
);

const NATURES = new Map([
  ['.jpg', 'PHOTO'],
  ['.jpeg', 'PHOTO'],
  ['.png', 'PHOTO'],
  ['.webp', 'PHOTO'],
  ['.mp4', 'VIDEO'],
  ['.webm', 'VIDEO'],
]);

export async function poserMedia(nomSource, prefixe = 'projet') {
  await fs.mkdir(DOSSIER_MEDIAS, { recursive: true });

  const extension = path.extname(nomSource).toLowerCase();
  const identifiant = crypto.randomBytes(16).toString('hex');
  const nomDisque = `${prefixe}-${Date.now()}-${identifiant}${extension}`;

  await fs.copyFile(
    path.join(DOSSIER_MEDIAS_DEMO, nomSource),
    path.join(DOSSIER_MEDIAS, nomDisque)
  );

  return {
    mediaUrl: `${PREFIXE_MEDIAS}/${nomDisque}`,
    mediaType: NATURES.get(extension) ?? 'PHOTO',
  };
}
