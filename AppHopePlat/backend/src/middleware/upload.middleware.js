/**
 * Televersement des justificatifs.
 *
 * Points de securite :
 *   * le nom d'origine n'est jamais utilise comme nom de fichier sur le
 *     disque : on genere un identifiant aleatoire, ce qui evite les
 *     traversees de repertoire ("../../etc/passwd") et les collisions ;
 *   * seuls PDF, JPEG et PNG sont acceptes, verifies sur le type MIME et
 *     sur l'extension ;
 *   * la taille est plafonnee a 10 Mo.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import multer from 'multer';

import { ErreurValidation } from '../shared/errors.js';

const dossierCourant = path.dirname(fileURLToPath(import.meta.url));

/** backend/uploads/justificatifs */
export const DOSSIER_JUSTIFICATIFS = path.resolve(
  dossierCourant,
  '..',
  '..',
  'uploads',
  'justificatifs'
);

/** Types acceptes : type MIME -> extension imposee sur le disque. */
const TYPES_ACCEPTES = new Map([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
]);

const EXTENSIONS_ACCEPTEES = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

/** 10 Mo, conformement au cahier des charges. */
export const TAILLE_MAXIMALE = 10 * 1024 * 1024;

// Le dossier doit exister avant le premier televersement.
fs.mkdirSync(DOSSIER_JUSTIFICATIFS, { recursive: true });

const stockage = multer.diskStorage({
  destination(_req, _fichier, suite) {
    suite(null, DOSSIER_JUSTIFICATIFS);
  },
  filename(_req, fichier, suite) {
    // Nom genere : jamais celui fourni par le client.
    const extension = TYPES_ACCEPTES.get(fichier.mimetype) ?? '.bin';
    const identifiant = crypto.randomBytes(16).toString('hex');
    const horodatage = Date.now();
    suite(null, `justificatif-${horodatage}-${identifiant}${extension}`);
  },
});

function filtrer(_req, fichier, suite) {
  const extension = path.extname(fichier.originalname ?? '').toLowerCase();

  if (!TYPES_ACCEPTES.has(fichier.mimetype) || !EXTENSIONS_ACCEPTEES.has(extension)) {
    suite(
      new ErreurValidation(
        'Format de fichier non accepte. Formats autorises : PDF, JPG, JPEG, PNG.',
        { file: 'Format non accepte' }
      )
    );
    return;
  }
  suite(null, true);
}

const televerseur = multer({
  storage: stockage,
  fileFilter: filtrer,
  limits: { fileSize: TAILLE_MAXIMALE, files: 1 },
});

/**
 * Middleware acceptant un fichier unique sous le champ "file".
 * Traduit les erreurs multer en erreurs applicatives HOPE.
 */
export function televerserJustificatif(req, res, suite) {
  televerseur.single('file')(req, res, (erreur) => {
    if (!erreur) {
      suite();
      return;
    }

    if (erreur instanceof multer.MulterError) {
      if (erreur.code === 'LIMIT_FILE_SIZE') {
        suite(
          new ErreurValidation('Le fichier depasse la taille maximale de 10 Mo.', {
            file: 'Fichier trop volumineux',
          })
        );
        return;
      }
      suite(new ErreurValidation(`Televersement refuse : ${erreur.message}`, { file: erreur.code }));
      return;
    }

    suite(erreur);
  });
}

/* ==================================================================
   Medias de projet : la photo ou la video qui illustre un projet
   ================================================================== */

/** backend/uploads/medias */
export const DOSSIER_MEDIAS = path.resolve(dossierCourant, '..', '..', 'uploads', 'medias');

/** Chemin public sous lequel les medias sont servis. */
export const PREFIXE_MEDIAS = '/media';

/** Types acceptes : type MIME -> extension et nature du media. */
const MEDIAS_ACCEPTES = new Map([
  ['image/jpeg', { extension: '.jpg', type: 'PHOTO' }],
  ['image/png', { extension: '.png', type: 'PHOTO' }],
  ['image/webp', { extension: '.webp', type: 'PHOTO' }],
  ['video/mp4', { extension: '.mp4', type: 'VIDEO' }],
  ['video/webm', { extension: '.webm', type: 'VIDEO' }],
]);

const EXTENSIONS_MEDIAS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm']);

/** 50 Mo : de quoi couvrir une photo haute definition ou une courte video. */
export const TAILLE_MAXIMALE_MEDIA = 50 * 1024 * 1024;

fs.mkdirSync(DOSSIER_MEDIAS, { recursive: true });

/** Nature du media a partir de son type MIME. */
export function natureDuMedia(typeMime) {
  return MEDIAS_ACCEPTES.get(typeMime)?.type ?? null;
}

const stockageMedia = multer.diskStorage({
  destination(_req, _fichier, suite) {
    suite(null, DOSSIER_MEDIAS);
  },
  filename(_req, fichier, suite) {
    // Nom genere : jamais celui fourni par le client.
    const extension = MEDIAS_ACCEPTES.get(fichier.mimetype)?.extension ?? '.bin';
    const identifiant = crypto.randomBytes(16).toString('hex');
    suite(null, `projet-${Date.now()}-${identifiant}${extension}`);
  },
});

function filtrerMedia(_req, fichier, suite) {
  const extension = path.extname(fichier.originalname ?? '').toLowerCase();

  if (!MEDIAS_ACCEPTES.has(fichier.mimetype) || !EXTENSIONS_MEDIAS.has(extension)) {
    suite(
      new ErreurValidation(
        'Format non accepté. Photos : JPG, PNG, WEBP. Vidéos : MP4, WEBM.',
        { file: 'Format non accepté' }
      )
    );
    return;
  }
  suite(null, true);
}

const televerseurMedia = multer({
  storage: stockageMedia,
  fileFilter: filtrerMedia,
  limits: { fileSize: TAILLE_MAXIMALE_MEDIA, files: 1 },
});

/**
 * Middleware acceptant une photo ou une video sous le champ "file".
 * Traduit les erreurs multer en erreurs applicatives HOPE.
 */
export function televerserMedia(req, res, suite) {
  televerseurMedia.single('file')(req, res, (erreur) => {
    if (!erreur) {
      suite();
      return;
    }

    if (erreur instanceof multer.MulterError) {
      if (erreur.code === 'LIMIT_FILE_SIZE') {
        suite(
          new ErreurValidation('Le fichier dépasse la taille maximale de 50 Mo.', {
            file: 'Fichier trop volumineux',
          })
        );
        return;
      }
      suite(new ErreurValidation(`Téléversement refusé : ${erreur.message}`, { file: erreur.code }));
      return;
    }

    suite(erreur);
  });
}

/** Supprime un fichier du disque sans faire echouer l'appel s'il a disparu. */
export async function supprimerFichier(cheminAbsolu) {
  try {
    await fs.promises.unlink(cheminAbsolu);
  } catch (erreur) {
    if (erreur.code !== 'ENOENT') {
      console.error('[HOPE] Suppression du fichier impossible :', erreur.message);
    }
  }
}
