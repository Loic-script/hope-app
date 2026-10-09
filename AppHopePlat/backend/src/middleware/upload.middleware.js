import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import multer from 'multer';

import { ErreurValidation } from '../shared/errors.js';

const dossierCourant = path.dirname(fileURLToPath(import.meta.url));

export const DOSSIER_JUSTIFICATIFS = path.resolve(
  dossierCourant,
  '..',
  '..',
  'uploads',
  'justificatifs'
);

const TYPES_ACCEPTES = new Map([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
]);

const EXTENSIONS_ACCEPTEES = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

export const TAILLE_MAXIMALE = 10 * 1024 * 1024;

fs.mkdirSync(DOSSIER_JUSTIFICATIFS, { recursive: true });

const stockage = multer.diskStorage({
  destination(_req, _fichier, suite) {
    suite(null, DOSSIER_JUSTIFICATIFS);
  },
  filename(_req, fichier, suite) {
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

export const DOSSIER_MEDIAS = path.resolve(dossierCourant, '..', '..', 'uploads', 'medias');

export const PREFIXE_MEDIAS = '/media';

const MEDIAS_ACCEPTES = new Map([
  ['image/jpeg', { extension: '.jpg', type: 'PHOTO' }],
  ['image/png', { extension: '.png', type: 'PHOTO' }],
  ['image/webp', { extension: '.webp', type: 'PHOTO' }],
  ['video/mp4', { extension: '.mp4', type: 'VIDEO' }],
  ['video/webm', { extension: '.webm', type: 'VIDEO' }],
]);

const EXTENSIONS_MEDIAS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm']);

export const TAILLE_MAXIMALE_MEDIA = 50 * 1024 * 1024;

fs.mkdirSync(DOSSIER_MEDIAS, { recursive: true });

export function natureDuMedia(typeMime) {
  return MEDIAS_ACCEPTES.get(typeMime)?.type ?? null;
}

const stockageMedia = multer.diskStorage({
  destination(_req, _fichier, suite) {
    suite(null, DOSSIER_MEDIAS);
  },
  filename(_req, fichier, suite) {
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

export function televerserMedia(req, res, suite) {
  televerseurMedia.single('file')(req, res, (erreur) => {
    if (!erreur) {
      suite();
      return;
    }

    if (erreur instanceof multer.MulterError) {
      if (erreur.code === 'LIMIT_FILE_SIZE') {
        suite(
          new ErreurValidation('Un fichier dépasse la taille maximale de 50 Mo.', {
            files: 'Fichier trop volumineux',
          })
        );
        return;
      }
      if (erreur.code === 'LIMIT_FILE_COUNT') {
        suite(
          new ErreurValidation(
            `Une preuve ne peut pas porter plus de ${MAX_FICHIERS_PREUVE} fichiers.`,
            { files: 'Trop de fichiers' }
          )
        );
        return;
      }
      suite(new ErreurValidation(`Téléversement refusé : ${erreur.message}`, { file: erreur.code }));
      return;
    }

    suite(erreur);
  });
}

export const DOSSIER_PREUVES = path.resolve(dossierCourant, '..', '..', 'uploads', 'preuves');

const PREUVES_ACCEPTEES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['video/mp4', '.mp4'],
  ['video/quicktime', '.mov'],
  ['video/webm', '.webm'],
  ['application/pdf', '.pdf'],
]);

const EXTENSIONS_PREUVES = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.webm', '.pdf',
]);

export const TAILLE_MAXIMALE_PREUVE = 10 * 1024 * 1024;
export const TAILLE_MAXIMALE_VIDEO = 50 * 1024 * 1024;

export const MAX_FICHIERS_PREUVE = 12;

export function plafondPreuve(mimeType) {
  return String(mimeType ?? '').startsWith('video/')
    ? TAILLE_MAXIMALE_VIDEO
    : TAILLE_MAXIMALE_PREUVE;
}

fs.mkdirSync(DOSSIER_PREUVES, { recursive: true });

const stockagePreuve = multer.diskStorage({
  destination(_req, _fichier, suite) {
    suite(null, DOSSIER_PREUVES);
  },
  filename(_req, fichier, suite) {
    const extension = PREUVES_ACCEPTEES.get(fichier.mimetype) ?? '.bin';
    const identifiant = crypto.randomBytes(16).toString('hex');
    suite(null, `preuve-${Date.now()}-${identifiant}${extension}`);
  },
});

function filtrerPreuve(_req, fichier, suite) {
  const extension = path.extname(fichier.originalname ?? '').toLowerCase();

  if (!PREUVES_ACCEPTEES.has(fichier.mimetype) || !EXTENSIONS_PREUVES.has(extension)) {
    suite(
      new ErreurValidation(
        'Format non accepté. Photos : JPG, PNG, WEBP. Vidéos : MP4, MOV, WEBM. Document : PDF.',
        { file: 'Format non accepté' }
      )
    );
    return;
  }
  suite(null, true);
}

const televerseurPreuve = multer({
  storage: stockagePreuve,
  fileFilter: filtrerPreuve,
  limits: { fileSize: TAILLE_MAXIMALE_VIDEO, files: MAX_FICHIERS_PREUVE },
});

export function televerserPreuve(req, res, suite) {
  televerseurPreuve.array('files', MAX_FICHIERS_PREUVE)(req, res, (erreur) => {
    if (!erreur) {
      suite();
      return;
    }

    if (erreur instanceof multer.MulterError) {
      if (erreur.code === 'LIMIT_FILE_SIZE') {
        suite(
          new ErreurValidation('Un fichier dépasse la taille maximale de 50 Mo.', {
            files: 'Fichier trop volumineux',
          })
        );
        return;
      }
      if (erreur.code === 'LIMIT_FILE_COUNT') {
        suite(
          new ErreurValidation(
            `Une preuve ne peut pas porter plus de ${MAX_FICHIERS_PREUVE} fichiers.`,
            { files: 'Trop de fichiers' }
          )
        );
        return;
      }
      suite(new ErreurValidation(`Téléversement refusé : ${erreur.message}`, { file: erreur.code }));
      return;
    }

    suite(erreur);
  });
}

export async function supprimerFichier(cheminAbsolu) {
  try {
    await fs.promises.unlink(cheminAbsolu);
  } catch (erreur) {
    if (erreur.code !== 'ENOENT') {
      console.error('[HOPE] Suppression du fichier impossible :', erreur.message);
    }
  }
}

const televerseurMessage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 5,
    fieldSize: 64 * 1024,
    fields: 10,
  },
});

export function televerserMessage(req, res, suite) {
  if (!req.is('multipart/form-data')) {
    suite();
    return;
  }

  televerseurMessage.array('files', 5)(req, res, (erreur) => {
    if (!erreur) {
      suite();
      return;
    }
    if (erreur instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: ['Un fichier dépasse 25 Mo, le maximum pour une vidéo.', 'Fichier trop volumineux'],
        LIMIT_FILE_COUNT: ['5 pièces jointes au plus par message.', 'Trop de fichiers'],
        LIMIT_UNEXPECTED_FILE: ['5 pièces jointes au plus par message.', 'Trop de fichiers'],
        LIMIT_FIELD_VALUE: ['Le message est trop long.', 'Texte trop long'],
      };
      const [message, detail] = messages[erreur.code] ?? [`Envoi refusé : ${erreur.message}`, erreur.code];
      suite(new ErreurValidation(message, { files: detail }));
      return;
    }
    suite(erreur);
  });
}

const televerseurGroupe = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fieldSize: 64 * 1024, fields: 10 },
});

export function televerserGroupe(req, res, suite) {
  if (!req.is('multipart/form-data')) {
    suite();
    return;
  }
  televerseurGroupe.single('photo')(req, res, (erreur) => {
    if (!erreur) {
      suite();
      return;
    }
    if (erreur instanceof multer.MulterError) {
      const message = erreur.code === 'LIMIT_FILE_SIZE'
        ? 'La photo dépasse 8 Mo.'
        : `Envoi refusé : ${erreur.message}`;
      suite(new ErreurValidation(message, { photo: erreur.code }));
      return;
    }
    suite(erreur);
  });
}
