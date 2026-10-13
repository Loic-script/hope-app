import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { IMAGE_DE_PARTAGE, LOGO } from '../shared/referencement.js';

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'frontend');
const PUBLIC = path.join(FRONTEND, 'public');
const LOGO_COMPLET = path.join(FRONTEND, 'src', 'assets', 'LOGO_WORDMARK_SUR_FOND_BLANC.png');
const PICTOGRAMME = path.join(PUBLIC, 'favicon.svg');
const BLANC = '#ffffff';

async function surFondBlanc(source, { largeur, hauteur, largeurDuMotif, densite }) {
  const motif = await sharp(source, densite ? { density: densite } : {})
    .resize({ width: largeurDuMotif })
    .toBuffer();
  const compose = await sharp({ create: { width: largeur, height: hauteur, channels: 3, background: BLANC } })
    .composite([{ input: motif, gravity: 'centre' }])
    .png()
    .toBuffer();
  return sharp(compose).removeAlpha().png({ compressionLevel: 9 });
}

const visuels = [
  [
    IMAGE_DE_PARTAGE.chemin,
    await surFondBlanc(LOGO_COMPLET, {
      largeur: IMAGE_DE_PARTAGE.largeur,
      hauteur: IMAGE_DE_PARTAGE.hauteur,
      largeurDuMotif: 720,
    }),
  ],
  [LOGO, await surFondBlanc(LOGO_COMPLET, { largeur: 640, hauteur: 320, largeurDuMotif: 560 })],
  [
    '/apple-touch-icon.png',
    await surFondBlanc(PICTOGRAMME, { largeur: 180, hauteur: 180, largeurDuMotif: 136, densite: 300 }),
  ],
];

for (const [chemin, image] of visuels) {
  const { width, height, size } = await image.toFile(path.join(PUBLIC, chemin));
  console.log(`[HOPE] ${chemin} : ${width} x ${height}, ${Math.round(size / 1024)} ko`);
}
