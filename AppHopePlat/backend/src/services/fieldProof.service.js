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
import * as volunteerProfileRepository from '../repositories/volunteerProfile.repository.js';

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

/**
 * Nombre de fichiers acceptes par preuve.
 *
 * Douze : une action de terrain se raconte en quelques images, pas en
 * reportage. La galerie n'en montre que six, le reste passe derriere le
 * "+N" du carrousel.
 */
export const MAX_FICHIERS = 12;

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
export async function creer(corps = {}, admin = null, fichiers = []) {
  const projectId = identifiantRequis(corps.projectId, 'projectId');
  const { type, description, dateAction, liste } = verifierContenu(corps, fichiers);

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
    files: versFichiers(liste),
  });

  await activityLogRepository.deposer(admin, {
    action: 'CREATE',
    entityType: 'FIELD_PROOF',
    entityId: preuve.id,
    label: `a ajouté une preuve pour « ${projet.name} »`,
  });

  return preuve;
}

/** Les fichiers televerses, tels que la base les range. */
function versFichiers(liste) {
  return liste.map((fichier) => ({
    fileName: fichier.originalname,
    filePath: fichier.filename,
    mimeType: fichier.mimetype,
    fileSize: fichier.size,
  }));
}

/**
 * Verifie le contenu d'une preuve : sa nature, sa description, sa date et
 * ses fichiers. Les memes regles pour l'equipe et pour les benevoles.
 *
 * @returns {{ type: string, description: string, dateAction: string|null,
 *             liste: Express.Multer.File[] }}
 */
function verifierContenu(corps = {}, fichiers = []) {
  const type = valeurParmi(corps.proofType, 'proofType', TYPES, { defaut: 'PHOTO' });
  const description = texteRequis(corps.description, 'description', { max: 2000 });
  const dateAction = dateFacultative(corps.occurredOn, 'occurredOn');

  const liste = Array.isArray(fichiers) ? fichiers : [fichiers].filter(Boolean);

  if (TYPES_AVEC_FICHIER.has(type) && liste.length === 0) {
    throw new ErreurValidation(
      {
        PHOTO: 'Une preuve photo doit porter au moins une image.',
        VIDEO: 'Une preuve vidéo doit porter au moins une vidéo.',
      }[type] ?? 'Une preuve de type document doit porter au moins un fichier.',
      { files: 'Champ obligatoire' }
    );
  }

  if (liste.length > MAX_FICHIERS) {
    throw new ErreurValidation(`Une preuve ne peut pas porter plus de ${MAX_FICHIERS} fichiers.`, {
      files: 'Trop de fichiers',
    });
  }

  // Chaque fichier est verifie separement : un lot ou la troisieme image
  // est en fait un PDF doit etre refuse en entier, pas a moitie accepte.
  for (const fichier of liste) {
    const attendu = PREFIXE_ATTENDU[type];
    if (attendu && !String(fichier.mimetype ?? '').startsWith(attendu)) {
      throw new ErreurValidation(
        type === 'PHOTO'
          ? `« ${fichier.originalname} » n’est pas une image : choisissez le type Vidéo ou Document.`
          : `« ${fichier.originalname} » n’est pas une vidéo : choisissez le type Photo ou Document.`,
        { files: 'Format incohérent avec le type' }
      );
    }

    // multer plafonne a la plus haute des deux limites : c'est ici que
    // celle du type s'applique.
    const plafond = plafondPreuve(fichier.mimetype);
    if (fichier.size > plafond) {
      throw new ErreurValidation(
        `« ${fichier.originalname} » dépasse la taille maximale de ${Math.round(plafond / (1024 * 1024))} Mo.`,
        { files: 'Fichier trop volumineux' }
      );
    }
  }

  // Une preuve constate le passe : elle ne peut pas etre datee de demain.
  if (dateAction !== null && dateAction > new Date().toISOString().slice(0, 10)) {
    throw new ErreurValidation('La date de l’action ne peut pas être dans le futur.', {
      occurredOn: 'Date future',
    });
  }

  return { type, description, dateAction, liste };
}

/* ================================================================
   Depuis l'espace benevole
   ================================================================ */

/**
 * Un benevole ajoute une preuve a un projet, depuis son onglet Impact.
 *
 * Les memes regles que pour l'equipe : un projet visible (en cours ou
 * termine, jamais archive), une description, des fichiers conformes a la
 * nature annoncee. La preuve porte son auteur, et l'equipe en est avertie
 * par le journal d'activite.
 *
 * Seuls l'equipe et les benevoles voient les preuves terrain : rien de
 * ce qu'un benevole depose n'est publie aupres des donateurs ou des
 * bailleurs.
 *
 * @param {number|string} projetId
 * @param {object} corps champs du formulaire
 * @param {{ id: string }} benevole le compte connecte (req.benevole)
 * @param {Express.Multer.File[]} fichiers
 * @returns {Promise<{ id: number }>} sans chemin de fichier : le benevole
 *          n'a pas a connaitre le disque
 */
export async function creerParBenevole(projetId, corps = {}, benevole = null, fichiers = []) {
  const projet = await projectRepository.trouverPourBenevole(identifiantRequis(projetId, 'id'));
  if (!projet) throw new ErreurIntrouvable('Le projet', projetId);

  const { type, description, dateAction, liste } = verifierContenu(corps, fichiers);
  const fiche = await volunteerProfileRepository.garantir(benevole.id);

  const preuve = await fieldProofRepository.creer({
    projectId: projet.id,
    benevoleId: fiche.id,
    proofType: type,
    description,
    occurredOn: dateAction,
    files: versFichiers(liste),
  });

  const nom = `${fiche.prenom ?? ''} ${fiche.nom ?? ''}`.trim() || 'Un bénévole';
  await activityLogRepository.deposer(
    { id: null, fullName: `${nom} (bénévole)` },
    {
      action: 'CREATE',
      entityType: 'FIELD_PROOF',
      entityId: preuve.id,
      label: `a ajouté une preuve pour « ${projet.name} »`,
    }
  );

  return { id: preuve.id };
}

/**
 * Un benevole retire une preuve qu'il a lui-meme deposee.
 *
 * Celle d'un autre, ou de l'equipe, lui reste introuvable : il n'a pas a
 * savoir qu'elle existe pour la supprimer. Rend les fichiers a effacer
 * du disque ; le controleur s'en charge.
 */
export async function supprimerParBenevole(projetId, preuveId, benevole = null) {
  const preuve = await fieldProofRepository.trouverParId(identifiantRequis(preuveId, 'preuveId'));
  const fiche = await volunteerProfileRepository.garantir(benevole.id);

  if (
    !preuve ||
    preuve.projectId !== identifiantRequis(projetId, 'id') ||
    !preuve.benevoleId ||
    preuve.benevoleId !== fiche.id
  ) {
    throw new ErreurIntrouvable('La preuve', preuveId);
  }

  const chemins = await fieldProofRepository.supprimer(preuve.id);
  return { id: preuve.id, deleted: true, filePaths: chemins };
}

/** Un fichier precis d'une preuve, pour le servir. */
export async function recupererFichier(preuveId, fichierId) {
  const preuve = await recupererParId(preuveId);
  const fichier = await fieldProofRepository.trouverFichier(
    preuve.id,
    identifiantRequis(fichierId, 'fileId')
  );
  if (!fichier) throw new ErreurIntrouvable('Le fichier de la preuve', fichierId);
  return fichier;
}

/**
 * Supprime une preuve et rend les fichiers a effacer du disque.
 * Le controleur s'occupe du disque : le service n'y touche pas.
 */
export async function supprimer(id) {
  const preuve = await recupererParId(id);
  const chemins = await fieldProofRepository.supprimer(preuve.id);
  return { id: preuve.id, deleted: true, filePaths: chemins };
}
