import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { config } from '../config/env.js';
import { ErreurValidation } from '../shared/errors.js';

const dossierCourant = path.dirname(fileURLToPath(import.meta.url));

export const DOSSIER_PHOTOS_BENEFICIAIRES = path.resolve(
  process.env.BENEFICIAIRES_DOSSIER || path.join(dossierCourant, '..', '..', 'uploads', 'beneficiaires')
);

const COTE_MAX = 1000;
const QUALITE_JPEG = 82;
const PLAFOND_OCTETS = 8 * 1024 * 1024;

const DUREE_SIGNATURE_MS = 6 * 60 * 60 * 1000;

const CLE = crypto.createHmac('sha256', config.jwt.secret).update('hope:beneficiaires:photos').digest();

const NOM_VALIDE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

export function nomValide(fichier) {
  return typeof fichier === 'string' && NOM_VALIDE.test(fichier);
}

export function chemin(fichier) {
  return path.join(DOSSIER_PHOTOS_BENEFICIAIRES, path.basename(fichier));
}

export function existe(fichier) {
  return nomValide(fichier) && fs.existsSync(chemin(fichier));
}

export async function enregistrer(fichier) {
  if (!fichier?.buffer) {
    throw new ErreurValidation('Aucune photo reçue.', { photo: 'Champ obligatoire' });
  }
  if (fichier.buffer.length > PLAFOND_OCTETS) {
    throw new ErreurValidation('La photo dépasse 8 Mo.', { photo: 'Fichier trop volumineux' });
  }

  let contenu;
  try {
    contenu = await sharp(fichier.buffer, { failOn: 'error' })
      .rotate()
      .resize({ width: COTE_MAX, height: COTE_MAX, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: QUALITE_JPEG, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new ErreurValidation('Ce fichier n’est pas une photo lisible (JPEG, PNG ou WebP).', {
      photo: 'Format non accepté',
    });
  }

  await fsp.mkdir(DOSSIER_PHOTOS_BENEFICIAIRES, { recursive: true });
  const nom = `${crypto.randomUUID()}.jpg`;
  await fsp.writeFile(chemin(nom), contenu, { flag: 'wx' });
  return nom;
}

export async function effacer(fichier) {
  if (!nomValide(fichier)) return;
  await fsp.rm(chemin(fichier), { force: true });
}

function signer(charge) {
  return crypto.createHmac('sha256', CLE).update(charge).digest('base64url');
}

export function adresseSignee(fichier, admin, maintenant = Date.now()) {
  if (!nomValide(fichier) || !admin?.id) return null;
  const expire = Math.floor((maintenant + DUREE_SIGNATURE_MS) / 1000);
  const qui = String(admin.id);
  const sig = signer(`${fichier}:${qui}:${expire}`);
  return `/api/fichiers/beneficiaires/${fichier}?qui=${qui}&exp=${expire}&sig=${sig}`;
}

export function verifierSignature(fichier, { qui, exp, sig } = {}) {
  const expire = Number(exp);
  if (!nomValide(fichier) || !/^\d+$/.test(String(qui ?? '')) || !sig) return null;
  if (!Number.isInteger(expire) || expire * 1000 < Date.now()) return null;

  const attendue = Buffer.from(signer(`${fichier}:${qui}:${expire}`));
  const recue = Buffer.from(String(sig));
  if (attendue.length !== recue.length || !crypto.timingSafeEqual(attendue, recue)) return null;
  return Number(qui);
}
