import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { config } from '../config/env.js';
import { ErreurValidation } from '../shared/errors.js';

const dossierCourant = path.dirname(fileURLToPath(import.meta.url));

export const DOSSIER_MESSAGERIE = process.env.MESSAGERIE_DOSSIER
  ? path.resolve(process.env.MESSAGERIE_DOSSIER)
  : path.resolve(dossierCourant, '..', '..', 'uploads', 'messagerie');

fs.mkdirSync(DOSSIER_MESSAGERIE, { recursive: true });

export const MAX_PIECES = 5;

export const PLAFONDS = {
  image: 8 * 1024 * 1024,
  video: 25 * 1024 * 1024,
  pdf: 10 * 1024 * 1024,
};

export const PLAFOND_MAXIMAL = Math.max(...Object.values(PLAFONDS));

const COTE_IMAGE = 1600;

const QUALITE_JPEG = 82;

const LIBELLES = { image: 'photo', video: 'vidéo', pdf: 'PDF' };
const mo = (octets) => Math.round(octets / (1024 * 1024));

export function signature(tampon) {
  if (tampon.length >= 5 && tampon.subarray(0, 5).toString('latin1') === '%PDF-') {
    return { type: 'pdf', typeMime: 'application/pdf', extension: '.pdf' };
  }
  if (tampon.length >= 12 && tampon.subarray(4, 8).toString('latin1') === 'ftyp') {
    const marque = tampon.subarray(8, 12).toString('latin1');
    return marque === 'qt  '
      ? { type: 'video', typeMime: 'video/quicktime', extension: '.mov' }
      : { type: 'video', typeMime: 'video/mp4', extension: '.mp4' };
  }
  if (tampon.length >= 4 && tampon[0] === 0x1a && tampon[1] === 0x45 && tampon[2] === 0xdf && tampon[3] === 0xa3) {
    return { type: 'video', typeMime: 'video/webm', extension: '.webm' };
  }
  return null;
}

function decoderNom(nom) {
  const texte = String(nom ?? '');
  if ([...texte].some((caractere) => caractere.charCodeAt(0) > 0xff)) return texte;
  const utf8 = Buffer.from(texte, 'latin1').toString('utf8');
  return utf8.includes('\uFFFD') ? texte : utf8;
}

export function nomPropre(nom, repli = 'fichier') {
  // eslint-disable-next-line no-control-regex
  const base = path.basename(decoderNom(nom)).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (base || repli).slice(0, 200);
}

export async function preparer(fichiers) {
  if (fichiers.length > MAX_PIECES) {
    throw new ErreurValidation(`${MAX_PIECES} pièces jointes au plus par message.`, {
      files: 'Trop de fichiers',
    });
  }

  const prets = [];
  for (const fichier of fichiers) {
    const nom = nomPropre(fichier.originalname);
    const tampon = fichier.buffer;
    const reconnu = signature(tampon);

    if (reconnu) {
      if (tampon.length > PLAFONDS[reconnu.type]) {
        throw new ErreurValidation(
          `« ${nom} » dépasse ${mo(PLAFONDS[reconnu.type])} Mo, le maximum pour une ${LIBELLES[reconnu.type]}.`,
          { files: 'Fichier trop volumineux' }
        );
      }
      prets.push({ nomOrigine: nom, ...reconnu, contenu: tampon });
      continue;
    }

    if (tampon.length > PLAFONDS.image) {
      throw new ErreurValidation(`« ${nom} » dépasse ${mo(PLAFONDS.image)} Mo, le maximum pour une photo.`, {
        files: 'Fichier trop volumineux',
      });
    }

    let image;
    try {
      const meta = await sharp(tampon, { failOn: 'error' }).metadata();
      if (!meta.width || !meta.height) throw new Error('dimensions inconnues');

      image = await sharp(tampon, { failOn: 'error' })
        .rotate()
        .resize({ width: COTE_IMAGE, height: COTE_IMAGE, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: QUALITE_JPEG, mozjpeg: true })
        .toBuffer();
    } catch {
      throw new ErreurValidation(
        `« ${nom} » n’est ni une photo, ni une vidéo MP4, WebM ou MOV, ni un PDF.`,
        { files: 'Format non accepté' }
      );
    }

    const nomJpeg = nom.replace(/\.[a-z0-9]{2,5}$/i, '') + '.jpg';
    prets.push({ nomOrigine: nomJpeg, type: 'image', typeMime: 'image/jpeg', extension: '.jpg', contenu: image });
  }
  return prets;
}

const COTE_PHOTO_GROUPE = 400;

export async function preparerPhotoGroupe(fichier) {
  const nom = nomPropre(fichier.originalname, 'photo');
  if (fichier.buffer.length > PLAFONDS.image) {
    throw new ErreurValidation(`« ${nom} » dépasse ${mo(PLAFONDS.image)} Mo, le maximum pour une photo.`, {
      photo: 'Fichier trop volumineux',
    });
  }
  try {
    const contenu = await sharp(fichier.buffer, { failOn: 'error' })
      .rotate()
      .resize({ width: COTE_PHOTO_GROUPE, height: COTE_PHOTO_GROUPE, fit: 'cover', position: 'attention' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: QUALITE_JPEG, mozjpeg: true })
      .toBuffer();
    return { contenu, extension: '.jpg' };
  } catch {
    throw new ErreurValidation(`« ${nom} » n’est pas une photo lisible.`, { photo: 'Format non accepté' });
  }
}

export async function ecrire(prets) {
  const ecrites = [];
  try {
    for (const piece of prets) {
      const fichier = `${crypto.randomUUID()}${piece.extension}`;
      await fsp.writeFile(path.join(DOSSIER_MESSAGERIE, fichier), piece.contenu, { flag: 'wx' });
      ecrites.push({
        nomOrigine: piece.nomOrigine,
        type: piece.type,
        typeMime: piece.typeMime,
        fichier,
        taille: piece.contenu.length,
      });
    }
    return ecrites;
  } catch (erreur) {
    await effacer(ecrites.map((piece) => piece.fichier));
    throw erreur;
  }
}

export function chemin(fichier) {
  return path.join(DOSSIER_MESSAGERIE, path.basename(String(fichier)));
}

export async function effacer(fichiers) {
  for (const fichier of fichiers) {
    try {
      await fsp.unlink(chemin(fichier));
    } catch (erreur) {
      if (erreur.code !== 'ENOENT') console.error('[HOPE] Fichier non efface :', fichier, erreur.message);
    }
  }
}

export async function dupliquer(pieces) {
  const copies = [];
  try {
    for (const piece of pieces) {
      const extension = path.extname(piece.fichier);
      const fichier = `${crypto.randomUUID()}${extension}`;
      await fsp.copyFile(chemin(piece.fichier), chemin(fichier), fs.constants.COPYFILE_EXCL);
      copies.push({ ...piece, fichier });
    }
    return copies;
  } catch (erreur) {
    await effacer(copies.map((piece) => piece.fichier));
    throw erreur;
  }
}

const DUREE_SIGNATURE_MS = 6 * 60 * 60 * 1000;

const CLE = crypto.createHmac('sha256', config.jwt.secret).update('hope:messagerie:fichiers').digest();

function signer(charge) {
  return crypto.createHmac('sha256', CLE).update(charge).digest('base64url');
}

export function adresseSignee(nature, id, acteur, maintenant = Date.now()) {
  const expire = Math.floor((maintenant + DUREE_SIGNATURE_MS) / 1000);
  const qui = `${acteur.type}.${acteur.id}`;
  const charge = `${nature}:${id}:${qui}:${expire}`;
  return `/api/messagerie/fichiers/${nature}/${id}?qui=${encodeURIComponent(qui)}&exp=${expire}&sig=${signer(charge)}`;
}

export function verifierSignature(nature, id, { qui, exp, sig }) {
  const expire = Number(exp);
  if (!qui || !sig || !Number.isInteger(expire) || expire * 1000 < Date.now()) return null;

  const attendue = Buffer.from(signer(`${nature}:${id}:${qui}:${expire}`));
  const recue = Buffer.from(String(sig));
  if (attendue.length !== recue.length || !crypto.timingSafeEqual(attendue, recue)) return null;

  const [type, ...reste] = String(qui).split('.');
  const identifiant = reste.join('.');
  if (type === 'admin' && /^\d+$/.test(identifiant)) return { type, id: Number(identifiant) };
  if (type === 'utilisateur' && identifiant) return { type, id: identifiant };
  return null;
}

export function disposition(nom, telecharger) {
  const ascii = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${telecharger ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nom)}`;
}
