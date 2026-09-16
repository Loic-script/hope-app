/**
 * Pose des visuels de demonstration.
 *
 * Les scripts de peuplement ont besoin d'illustrer ce qu'ils creent :
 * un projet, une publication, l'avatar de l'equipe. Le geste est le
 * meme a chaque fois, et il etait ecrit deux fois -- une copie par
 * script. Il vit ici desormais.
 *
 * Les fichiers sources sont dans medias-demo/. Ils viennent de la
 * banque d'images de la charte HOPE (frontend/src/assets), copiee ici
 * pour que le backend n'aille jamais lire dans les sources du
 * frontend : en production, ce dossier n'existe pas.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOSSIER_MEDIAS, PREFIXE_MEDIAS } from '../middleware/upload.middleware.js';

/** Dossier des visuels livres avec les scripts. */
export const DOSSIER_MEDIAS_DEMO = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'medias-demo'
);

/** Nature du media deduite de son extension. */
const NATURES = new Map([
  ['.jpg', 'PHOTO'],
  ['.jpeg', 'PHOTO'],
  ['.png', 'PHOTO'],
  ['.webp', 'PHOTO'],
  ['.mp4', 'VIDEO'],
  ['.webm', 'VIDEO'],
]);

/**
 * Copie un visuel dans le dossier des medias et renvoie de quoi
 * illustrer une fiche.
 *
 * On imite ce qu'aurait produit un televersement reel : le fichier
 * recoit un nom genere, jamais celui d'origine, et la fiche ne garde
 * qu'une adresse. Deux appels sur la meme source donnent deux
 * fichiers distincts -- c'est voulu : supprimer le media d'un projet
 * ne doit pas effacer l'illustration d'un autre.
 *
 * @param {string} nomSource fichier present dans medias-demo/
 * @param {string} prefixe debut du nom sur le disque, pour s'y retrouver
 * @returns {Promise<{ mediaUrl: string, mediaType: 'PHOTO'|'VIDEO' }>}
 */
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
