import * as fieldProofRepository from '../repositories/fieldProof.repository.js';
import * as projectRepository from '../repositories/project.repository.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import * as volunteerProfileRepository from '../repositories/volunteerProfile.repository.js';

import { plafondPreuve } from '../middleware/upload.middleware.js';
import { signalerPreuveTerrain } from './notification.service.js';
import { ErreurIntrouvable, ErreurRegleMetier, ErreurValidation } from '../shared/errors.js';
import {
  dateFacultative,
  identifiantFacultatif,
  identifiantRequis,
  texteFacultatif,
  texteRequis,
  valeurParmi,
} from '../shared/validation.js';

export const TYPES = ['PHOTO', 'VIDEO', 'DOCUMENT', 'TESTIMONY'];

const TYPES_AVEC_FICHIER = new Set(['PHOTO', 'VIDEO', 'DOCUMENT']);

const PREFIXE_ATTENDU = { PHOTO: 'image/', VIDEO: 'video/' };

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

function versFichiers(liste) {
  return liste.map((fichier) => ({
    fileName: fichier.originalname,
    filePath: fichier.filename,
    mimeType: fichier.mimetype,
    fileSize: fichier.size,
  }));
}

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

    const plafond = plafondPreuve(fichier.mimetype);
    if (fichier.size > plafond) {
      throw new ErreurValidation(
        `« ${fichier.originalname} » dépasse la taille maximale de ${Math.round(plafond / (1024 * 1024))} Mo.`,
        { files: 'Fichier trop volumineux' }
      );
    }
  }

  if (dateAction !== null && dateAction > new Date().toISOString().slice(0, 10)) {
    throw new ErreurValidation('La date de l’action ne peut pas être dans le futur.', {
      occurredOn: 'Date future',
    });
  }

  return { type, description, dateAction, liste };
}

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

  await signalerPreuveTerrain({ qui: nom, projet: projet.name, projetId: projet.id });

  return { id: preuve.id };
}

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

export async function recupererFichier(preuveId, fichierId) {
  const preuve = await recupererParId(preuveId);
  const fichier = await fieldProofRepository.trouverFichier(
    preuve.id,
    identifiantRequis(fichierId, 'fileId')
  );
  if (!fichier) throw new ErreurIntrouvable('Le fichier de la preuve', fichierId);
  return fichier;
}

export async function supprimer(id) {
  const preuve = await recupererParId(id);
  const chemins = await fieldProofRepository.supprimer(preuve.id);
  return { id: preuve.id, deleted: true, filePaths: chemins };
}
