import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { IMAGE_DE_PARTAGE, LOGO, LOGO_DES_COURRIELS } from '../shared/referencement.js';

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'frontend');
const PUBLIC = path.join(FRONTEND, 'public');
const LOGO_COMPLET = path.join(FRONTEND, 'src', 'assets', 'LOGO_WORDMARK_SUR_FOND_BLANC.png');
const LOGO_SUR_VIOLET = path.join(FRONTEND, 'src', 'assets', 'LOGO_WORDMARK_SUR_FOND_VIOLET.png');
const PICTOGRAMME = path.join(PUBLIC, 'favicon.svg');
const BLANC = '#ffffff';
const NUIT = '#2c2748';

async function surUnFond(source, { largeur, hauteur, largeurDuMotif, densite, fond = BLANC }) {
  const motif = await sharp(source, densite ? { density: densite } : {})
    .resize({ width: largeurDuMotif })
    .toBuffer();
  const compose = await sharp({ create: { width: largeur, height: hauteur, channels: 3, background: fond } })
    .composite([{ input: motif, gravity: 'centre' }])
    .png()
    .toBuffer();
  return sharp(compose).removeAlpha().png({ compressionLevel: 9 });
}

const visuels = [
  [
    IMAGE_DE_PARTAGE.chemin,
    await surUnFond(LOGO_COMPLET, {
      largeur: IMAGE_DE_PARTAGE.largeur,
      hauteur: IMAGE_DE_PARTAGE.hauteur,
      largeurDuMotif: 720,
    }),
  ],
  [LOGO, await surUnFond(LOGO_COMPLET, { largeur: 640, hauteur: 320, largeurDuMotif: 560 })],
  [
    '/apple-touch-icon.png',
    await surUnFond(PICTOGRAMME, { largeur: 180, hauteur: 180, largeurDuMotif: 136, densite: 300 }),
  ],
  [
    LOGO_DES_COURRIELS.chemin,
    await surUnFond(LOGO_SUR_VIOLET, {
      largeur: LOGO_DES_COURRIELS.largeur * 2,
      hauteur: LOGO_DES_COURRIELS.hauteur * 2,
      largeurDuMotif: 300,
      fond: NUIT,
    }),
  ],
];

for (const [chemin, image] of visuels) {
  const { width, height, size } = await image.toFile(path.join(PUBLIC, chemin));
  console.log(`[HOPE] ${chemin} : ${width} x ${height}, ${Math.round(size / 1024)} ko`);
}
