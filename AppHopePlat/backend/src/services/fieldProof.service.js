/**
 * Service des preuves terrain.
 *
 * Une preuve montre qu'une action a eu lieu. Le cahier des maquettes le
 * resume : "une photo et deux lignes suffisent". La regle est donc de
 * demander le minimum -- un projet, une description, une date -- pour
 * qu'une preuve soit publiee en quelques secondes depuis le terrain.
 *
 * Regles du module :
 *   * on documente un projet en cours comme un projet termine : un
 *     resultat se constate apres coup, exactement comme pour les impacts ;
 *   * un projet archive est fige, plus aucune preuve ne s'y ajoute ;
 *   * une photo ou un document portent un fichier, un temoignage non.
 */
import * as fieldProofRepository from '../repositories/fieldProof.repository.js';
import * as projectRepository from '../repositories/project.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';

import { plafondPreuve } from '../middleware/upload.middleware.js';
import { ErreurIntrouvable, ErreurRegleMetier, ErreurValidation } from '../shared/errors.js';
import {
  dateFacultative,
  identifiantFacultatif,
  identifiantRequis,
  texteFacultatif,
  texteRequis,
  valeurParmi,
} from '../shared/validation.js';

/** Les quatre natures de preuve. */
export const TYPES = ['PHOTO', 'VIDEO', 'DOCUMENT', 'TESTIMONY'];

/** Un temoignage se suffit de son texte ; les trois autres non. */
const TYPES_AVEC_FICHIER = new Set(['PHOTO', 'VIDEO', 'DOCUMENT']);

/**
 * Familles de type MIME attendues par nature de preuve.
 *
 * Le format seul ne suffit pas : le middleware accepte JPG comme MP4
 * pour toute preuve, si bien qu'une video deposee sous le type "Photo"
 * passerait, et s'afficherait ensuite dans une balise <img> vide. On
 * verifie donc que le fichier correspond a ce qui est annonce.
 */
const PREFIXE_ATTENDU = { PHOTO: 'image/', VIDEO: 'video/' };

export async function lister(requete = {}) {
  const preuves = await fieldProofRepository.lister({
    projectId: identifiantFacultatif(requete.projectId, 'projectId'),
    type: requete.type ? valeurParmi(requete.type, 'type', TYPES) : null,
    recherche: texteFacultatif(requete.search, 'search', { max: 120 }),
  });

  const [stats, silencieux] = await Promise.all([
    fieldProofRepository.statistiques(),
    fieldProofRepository.projetsSilencieux(),
  ]);

  return {
    items: preuves,
    stats,
    // La liste, pas seulement le compte : un chiffre ne dit pas par ou
    // commencer.
    silentProjects: silencieux,
    silenceThresholdDays: fieldProofRepository.SEUIL_SILENCE_JOURS,
    types: TYPES,
  };
}

export async function recupererParId(id) {
  const preuve = await fieldProofRepository.trouverParId(identifiantRequis(id, 'id'));
  if (!preuve) throw new ErreurIntrouvable('La preuve', id);
  return preuve;
}

/**
 * Publie une preuve terrain.
 *
 * @param {object} corps champs du formulaire
 * @param {{ id: number }} admin administrateur connecte, depose par le
 *        middleware d'authentification ; c'est lui l'auteur de la preuve
 * @param {Express.Multer.File|null} fichier fichier televerse, s'il y en a un
 */
export async function creer(corps = {}, admin = null, fichier = null) {
  const projectId = identifiantRequis(corps.projectId, 'projectId');
  const type = valeurParmi(corps.proofType, 'proofType', TYPES, { defaut: 'PHOTO' });
  const description = texteRequis(corps.description, 'description', { max: 2000 });
  const dateAction = dateFacultative(corps.occurredOn, 'occurredOn');

  if (TYPES_AVEC_FICHIER.has(type) && !fichier) {
    throw new ErreurValidation(
      {
        PHOTO: 'Une preuve photo doit porter une image.',
        VIDEO: 'Une preuve vidéo doit porter une vidéo.',
      }[type] ?? 'Une preuve de type document doit porter un fichier.',
      { file: 'Champ obligatoire' }
    );
  }

  if (fichier) {
    const attendu = PREFIXE_ATTENDU[type];
    if (attendu && !String(fichier.mimetype ?? '').startsWith(attendu)) {
      throw new ErreurValidation(
        type === 'PHOTO'
          ? 'Ce fichier n’est pas une image : choisissez le type Vidéo ou Document.'
          : 'Ce fichier n’est pas une vidéo : choisissez le type Photo ou Document.',
        { file: 'Format incohérent avec le type' }
      );
    }

    // multer plafonne a la plus haute des deux limites : c'est ici que
    // celle du type s'applique.
    const plafond = plafondPreuve(fichier.mimetype);
    if (fichier.size > plafond) {
      throw new ErreurValidation(
        `Le fichier dépasse la taille maximale de ${Math.round(plafond / (1024 * 1024))} Mo.`,
        { file: 'Fichier trop volumineux' }
      );
    }
  }

  // Une preuve constate le passe : elle ne peut pas etre datee de demain.
  if (dateAction !== null && dateAction > new Date().toISOString().slice(0, 10)) {
    throw new ErreurValidation('La date de l’action ne peut pas être dans le futur.', {
      occurredOn: 'Date future',
    });
  }

  const projet = await projectRepository.trouverParId(projectId);
  if (!projet) throw new ErreurIntrouvable('Le projet', projectId);

  if (projet.status === 'ARCHIVED') {
    throw new ErreurRegleMetier(
      'Ce projet est archivé : il n’accepte plus de nouvelle preuve.',
      'PROJET_ARCHIVE'
    );
  }

  const preuve = await fieldProofRepository.creer({
    projectId,
    adminId: admin?.id ?? null,
    proofType: type,
    description,
    occurredOn: dateAction,
    fileName: fichier?.originalname ?? null,
    filePath: fichier?.filename ?? null,
    mimeType: fichier?.mimetype ?? null,
    fileSize: fichier?.size ?? null,
  });

  await activityLogRepository.deposer(admin, {
    action: 'CREATE',
    entityType: 'FIELD_PROOF',
    entityId: preuve.id,
    label: `a ajouté une preuve pour « ${projet.name} »`,
  });

  return preuve;
}

/**
 * Supprime une preuve et rend le nom du fichier a effacer du disque.
 * Le controleur s'occupe du disque : le service ne connait pas les chemins.
 */
export async function supprimer(id) {
  const preuve = await recupererParId(id);
  await fieldProofRepository.supprimer(preuve.id);
  return { id: preuve.id, deleted: true, filePath: preuve.filePath };
}
