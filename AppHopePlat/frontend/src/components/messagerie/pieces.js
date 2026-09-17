/**
 * Regles des pieces jointes, cote navigateur.
 *
 * Les memes que celles du serveur, qui les applique de toute facon : les
 * verifier ici evite d'envoyer vingt megaoctets pour apprendre qu'ils ne
 * passaient pas. Le serveur, lui, juge au contenu ; le navigateur ne peut
 * juger qu'au type annonce et a l'extension.
 */

export const MAX_PIECES = 5;

export const PLAFONDS = {
  image: 8 * 1024 * 1024,
  video: 25 * 1024 * 1024,
  pdf: 10 * 1024 * 1024,
};

/** Ce que le selecteur de fichiers propose. */
export const ACCEPTE = 'image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,application/pdf,.pdf';

const LIBELLES = { image: 'photo', video: 'vidéo', pdf: 'PDF' };

/** La nature d'un fichier choisi : image, video, pdf, ou null. */
export function natureDe(fichier) {
  const type = String(fichier.type ?? '').toLowerCase();
  const extension = String(fichier.name ?? '').toLowerCase().split('.').pop();
  if (type === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (['video/mp4', 'video/webm', 'video/quicktime'].includes(type) || ['mp4', 'webm', 'mov'].includes(extension)) {
    return 'video';
  }
  if (type.startsWith('image/')) return 'image';
  return null;
}

/**
 * Ajoute des fichiers a une selection, en respectant les regles.
 *
 * @returns {{ retenus: File[], erreurs: string[] }}
 */
export function ajouterFichiers(actuels, nouveaux) {
  const retenus = [...actuels];
  const erreurs = [];

  for (const fichier of nouveaux) {
    const nature = natureDe(fichier);
    if (!nature) {
      erreurs.push(`« ${fichier.name} » : seules les photos, les vidéos MP4, WebM ou MOV et les PDF sont acceptés.`);
      continue;
    }
    if (fichier.size > PLAFONDS[nature]) {
      erreurs.push(`« ${fichier.name} » dépasse ${PLAFONDS[nature] / (1024 * 1024)} Mo, le maximum pour une ${LIBELLES[nature]}.`);
      continue;
    }
    if (retenus.length >= MAX_PIECES) {
      erreurs.push(`${MAX_PIECES} pièces jointes au plus par message.`);
      break;
    }
    const doublon = retenus.some(
      (f) => f.name === fichier.name && f.size === fichier.size && f.lastModified === fichier.lastModified
    );
    if (!doublon) retenus.push(fichier);
  }

  return { retenus, erreurs };
}
