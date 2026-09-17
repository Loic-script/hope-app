/**
 * Les pieces jointes de la messagerie : analyse, traitement, stockage,
 * et adresses de lecture signees.
 *
 * Trois regles tiennent tout le fichier :
 *
 * 1. Le type se juge au contenu. Ni le type MIME annonce par le
 *    navigateur, ni l'extension ne font foi : un fichier texte renomme
 *    en ".pdf" reste un fichier texte, et il est refuse.
 *
 * 2. Tout se verifie avant d'ecrire quoi que ce soit. Un lot dont une
 *    piece est refusee ne laisse ni fichier sur le disque, ni message a
 *    moitie envoye.
 *
 * 3. Rien n'est public. Les fichiers vivent hors du dossier servi, sous
 *    un nom aleatoire ; on les lit par une adresse signee, liee a une
 *    personne, et la participation au fil est reverifiee a chaque lecture.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { config } from '../config/env.js';
import { ErreurValidation } from '../shared/errors.js';

const dossierCourant = path.dirname(fileURLToPath(import.meta.url));

/**
 * Le dossier prive des pieces jointes.
 *
 * Hors de uploads/medias, qui est servi tel quel : rien ici ne doit etre
 * atteignable sans passer par la route controlee. MESSAGERIE_DOSSIER le
 * deplace -- une base d'essai ecrit ailleurs que la vraie.
 */
export const DOSSIER_MESSAGERIE = process.env.MESSAGERIE_DOSSIER
  ? path.resolve(process.env.MESSAGERIE_DOSSIER)
  : path.resolve(dossierCourant, '..', '..', 'uploads', 'messagerie');

fs.mkdirSync(DOSSIER_MESSAGERIE, { recursive: true });

/** Nombre de pieces par message. */
export const MAX_PIECES = 5;

/** Plafonds par type, controles aussi dans le navigateur. */
export const PLAFONDS = {
  image: 8 * 1024 * 1024,
  video: 25 * 1024 * 1024,
  pdf: 10 * 1024 * 1024,
};

/** Le plus haut des plafonds : la seule limite que multer connaisse. */
export const PLAFOND_MAXIMAL = Math.max(...Object.values(PLAFONDS));

/** Cote maximale d'une image, apres redimensionnement. */
const COTE_IMAGE = 1600;

/** Qualite JPEG des images recompressees. */
const QUALITE_JPEG = 82;

const LIBELLES = { image: 'photo', video: 'vidéo', pdf: 'PDF' };
const mo = (octets) => Math.round(octets / (1024 * 1024));

/* ================================================================
   Analyse du contenu
   ================================================================ */

/**
 * Reconnait une video ou un PDF a ses premiers octets.
 *
 * - PDF : "%PDF-" en tete ;
 * - MP4 / MOV : la boite "ftyp" a l'octet 4 ; la marque "qt  " designe
 *   un fichier QuickTime, le reste de l'ISO BMFF est du MP4 ;
 * - WebM : la signature EBML 1A 45 DF A3.
 *
 * @returns {{type: 'video'|'pdf', typeMime: string, extension: string}|null}
 */
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

/**
 * Le nom tel que le navigateur l'a envoye.
 *
 * multer lit le nom d'un fichier multipart en latin-1 : "réunion" arrive
 * "rÃ©union". On relit ces octets en UTF-8 -- sauf si le resultat n'est
 * pas de l'UTF-8 valide, auquel cas le nom etait vraiment en latin-1.
 */
function decoderNom(nom) {
  const texte = String(nom ?? '');
  if ([...texte].some((caractere) => caractere.charCodeAt(0) > 0xff)) return texte;
  const utf8 = Buffer.from(texte, 'latin1').toString('utf8');
  return utf8.includes('\uFFFD') ? texte : utf8;
}

/** Un nom d'origine presentable : decode, sans chemin, sans caractere de controle. */
export function nomPropre(nom, repli = 'fichier') {
  const base = path.basename(decoderNom(nom)).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (base || repli).slice(0, 200);
}

/**
 * Analyse et prepare un lot de fichiers, sans rien ecrire.
 *
 * Chaque fichier est classe d'apres son contenu, mesure au plafond de ce
 * type, et -- pour une image -- decode, redresse, redimensionne et
 * recompresse. Un seul refus arrete tout le lot.
 *
 * @param {{originalname: string, buffer: Buffer, size: number}[]} fichiers
 * @returns {Promise<{nomOrigine: string, type: string, typeMime: string,
 *                    extension: string, contenu: Buffer}[]>}
 */
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

    // Ni PDF ni video : ce doit etre une image, et elle doit se decoder.
    if (tampon.length > PLAFONDS.image) {
      throw new ErreurValidation(`« ${nom} » dépasse ${mo(PLAFONDS.image)} Mo, le maximum pour une photo.`, {
        files: 'Fichier trop volumineux',
      });
    }

    let image;
    try {
      // failOn 'error' : une image tronquee ou falsifiee ne passe pas.
      const meta = await sharp(tampon, { failOn: 'error' }).metadata();
      if (!meta.width || !meta.height) throw new Error('dimensions inconnues');

      /*
       * rotate() applique l'orientation EXIF puis la retire ; la sortie
       * JPEG n'emporte aucune metadonnee -- ni appareil, ni GPS -- tant
       * qu'on ne demande pas withMetadata(). Les transparences sont
       * posees sur du blanc, que le JPEG ne sait pas representer.
       */
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

/** Cote de la photo d'un groupe : un carre, recadre au centre. */
const COTE_PHOTO_GROUPE = 400;

/**
 * Prepare la photo d'un groupe : une image qui se decode, redressee,
 * recadree en carre et recompressee -- sans metadonnees.
 *
 * @returns {Promise<{contenu: Buffer, extension: string}>}
 */
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

/* ================================================================
   Disque
   ================================================================ */

/**
 * Ecrit les pieces preparees, sous des noms aleatoires.
 *
 * Si l'ecriture echoue en cours de lot, ce qui a deja ete ecrit est
 * efface : le lot entre en entier, ou pas du tout.
 *
 * @returns {Promise<object[]>} les pieces, avec leur nom sur le disque et leur taille
 */
export async function ecrire(prets) {
  const ecrites = [];
  try {
    for (const piece of prets) {
      const fichier = `${crypto.randomUUID()}${piece.extension}`;
      // wx : jamais d'ecrasement, meme d'un nom deja pris.
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

/** Le chemin absolu d'un fichier de la messagerie ; basename neutralise toute remontee. */
export function chemin(fichier) {
  return path.join(DOSSIER_MESSAGERIE, path.basename(String(fichier)));
}

/** Efface des fichiers sans faire echouer l'appel s'ils ont deja disparu. */
export async function effacer(fichiers) {
  for (const fichier of fichiers) {
    try {
      await fsp.unlink(chemin(fichier));
    } catch (erreur) {
      if (erreur.code !== 'ENOENT') console.error('[HOPE] Fichier non efface :', fichier, erreur.message);
    }
  }
}

/**
 * Duplique physiquement des fichiers, sous de nouveaux noms.
 *
 * Un message transfere doit survivre a la suppression de l'original :
 * partager le meme fichier ferait disparaitre la copie avec lui.
 */
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

/* ================================================================
   Adresses signees
   ================================================================ */

/** Duree de validite d'une adresse de lecture. */
const DUREE_SIGNATURE_MS = 6 * 60 * 60 * 1000;

/** Cle propre a la messagerie, derivee du secret des jetons. */
const CLE = crypto.createHmac('sha256', config.jwt.secret).update('hope:messagerie:fichiers').digest();

function signer(charge) {
  return crypto.createHmac('sha256', CLE).update(charge).digest('base64url');
}

/**
 * L'adresse de lecture d'un fichier, pour une personne.
 *
 * Une balise <img> ou <video> ne peut pas envoyer le jeton d'une session :
 * l'adresse porte donc sa propre preuve -- qui, quoi, jusqu'a quand --
 * signee. La signature seule ne suffit pas : la participation au fil est
 * reverifiee a chaque lecture.
 *
 * @param {'piece'|'groupe'} nature
 */
export function adresseSignee(nature, id, acteur, maintenant = Date.now()) {
  const expire = Math.floor((maintenant + DUREE_SIGNATURE_MS) / 1000);
  const qui = `${acteur.type}.${acteur.id}`;
  const charge = `${nature}:${id}:${qui}:${expire}`;
  return `/api/messagerie/fichiers/${nature}/${id}?qui=${encodeURIComponent(qui)}&exp=${expire}&sig=${signer(charge)}`;
}

/**
 * Verifie une adresse signee.
 *
 * @returns {{type: string, id: string|number}|null} l'acteur, ou null si
 *          la signature est fausse ou expiree
 */
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

/**
 * L'en-tete Content-Disposition, avec le nom d'origine en UTF-8.
 *
 * filename= en ASCII pour les navigateurs anciens, filename*= pour les
 * autres : "Compte-rendu reunion.pdf" garde ses accents.
 */
export function disposition(nom, telecharger) {
  const ascii = nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${telecharger ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nom)}`;
}
