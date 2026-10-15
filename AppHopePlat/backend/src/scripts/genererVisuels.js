import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { IMAGE_DE_PARTAGE, LOGO } from '../shared/referencement.js';

const FRONTEND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'frontend');
const PUBLIC = path.join(FRONTEND, 'public');
const LOGO_COMPLET = path.join(FRONTEND, 'src', 'assets', 'LOGO_WORDMARK_SUR_FOND_BLANC.png');
const PICTOGRAMME = path.join(PUBLIC, 'favicon.svg');
const BLANC = '#ffffff';

const TAILLES_ICO = [16, 32, 48];
const TAILLE_ICONE = 96;

function pictogramme(taille) {
  return sharp(PICTOGRAMME).resize(taille, taille).png({ compressionLevel: 9 });
}

async function ico(tailles) {
  const images = await Promise.all(tailles.map((taille) => pictogramme(taille).toBuffer()));
  const entete = Buffer.alloc(6 + 16 * images.length);
  entete.writeUInt16LE(1, 2);
  entete.writeUInt16LE(images.length, 4);
  let position = entete.length;
  images.forEach((image, rang) => {
    const entree = 6 + 16 * rang;
    entete.writeUInt8(tailles[rang], entree);
    entete.writeUInt8(tailles[rang], entree + 1);
    entete.writeUInt16LE(1, entree + 4);
    entete.writeUInt16LE(32, entree + 6);
    entete.writeUInt32LE(image.length, entree + 8);
    entete.writeUInt32LE(position, entree + 12);
    position += image.length;
  });
  return Buffer.concat([entete, ...images]);
}

async function surFondBlanc(source, { largeur, hauteur, largeurDuMotif }) {
  const motif = await sharp(source).resize({ width: largeurDuMotif }).toBuffer();
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
  ['/apple-touch-icon.png', await surFondBlanc(PICTOGRAMME, { largeur: 180, hauteur: 180, largeurDuMotif: 156 })],
  [`/favicon-${TAILLE_ICONE}x${TAILLE_ICONE}.png`, pictogramme(TAILLE_ICONE)],
];

for (const [chemin, image] of visuels) {
  const { width, height, size } = await image.toFile(path.join(PUBLIC, chemin));
  console.log(`[HOPE] ${chemin} : ${width} x ${height}, ${Math.round(size / 1024)} ko`);
}

fs.writeFileSync(path.join(PUBLIC, 'favicon.ico'), await ico(TAILLES_ICO));
console.log(`[HOPE] /favicon.ico : ${TAILLES_ICO.join(', ')} px`);
