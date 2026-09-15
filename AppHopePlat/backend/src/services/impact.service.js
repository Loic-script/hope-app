/**
 * Service des impacts mesures.
 *
 * Un impact relie un projet (et parfois un beneficiaire precis) a un
 * indicateur chiffre : "children_enrolled = 100 enfants".
 */
import * as impactRepository from '../repositories/impact.repository.js';
import * as projectRepository from '../repositories/project.repository.js';
import * as beneficiaryRepository from '../repositories/beneficiary.repository.js';

import { ErreurIntrouvable, ErreurRegleMetier, ErreurValidation } from '../shared/errors.js';
import {
  dateFacultative,
  identifiantFacultatif,
  identifiantRequis,
  nombreRequis,
  texteFacultatif,
  texteRequis,
} from '../shared/validation.js';

/** Indicateurs proposes par defaut dans le formulaire. */
export const INDICATEURS_SUGGERES = [
  { code: 'children_enrolled', label: 'Enfants scolarises', unit: 'enfants' },
  { code: 'children_supported', label: 'Enfants accompagnes', unit: 'enfants' },
  { code: 'women_trained', label: 'Femmes formees', unit: 'personnes' },
  { code: 'families_supported', label: 'Familles soutenues', unit: 'familles' },
  { code: 'meals_served', label: 'Repas servis', unit: 'repas' },
  { code: 'medical_consultations', label: 'Consultations medicales', unit: 'consultations' },
  { code: 'kits_distributed', label: 'Kits distribues', unit: 'kits' },
  { code: 'jobs_created', label: 'Emplois crees', unit: 'emplois' },
];

export async function lister(requete = {}) {
  const impacts = await impactRepository.lister({
    projectId: identifiantFacultatif(requete.projectId, 'projectId'),
    indicateur: texteFacultatif(requete.indicator, 'indicator', { max: 120 }),
    recherche: texteFacultatif(requete.search, 'search', { max: 120 }),
  });
  return { items: impacts, indicators: INDICATEURS_SUGGERES };
}

export async function listerParProjet(projectId) {
  const id = identifiantRequis(projectId, 'projectId');
  const projet = await projectRepository.trouverParId(id);
  if (!projet) throw new ErreurIntrouvable('Le projet', id);

  return {
    items: await impactRepository.lister({ projectId: id }),
    summary: await impactRepository.syntheseParProjet(id),
  };
}

export async function recupererParId(id) {
  const impact = await impactRepository.trouverParId(identifiantRequis(id, 'id'));
  if (!impact) throw new ErreurIntrouvable("L'impact", id);
  return impact;
}

/** Valide les references vers le projet et le beneficiaire. */
/**
 * Verifie qu'un objectif appartient bien au projet mesure.
 *
 * Sans cette verification, une mesure pourrait se rattacher a l'objectif
 * d'un autre projet : le tableau la rangerait sous un intitule qui n'a
 * rien a voir avec elle.
 *
 * @returns {Promise<{id: number, label: string}|null>} l'objectif retenu
 */
async function objectifDuProjet(projectId, valeur) {
  const objectiveId = identifiantFacultatif(valeur, 'objectiveId');
  if (objectiveId === null) return null;

  const projet = await projectRepository.trouverParId(projectId);
  const objectif = (projet?.objectives ?? []).find((element) => element.id === objectiveId);
  if (!objectif) {
    throw new ErreurValidation('Cet objectif n’appartient pas au projet.', {
      objectiveId: 'Objectif inconnu pour ce projet',
    });
  }
  return objectif;
}

/**
 * L'indicateur d'une mesure.
 *
 * Mesurer un objectif ne demande plus de code d'indicateur : l'objectif
 * dit deja ce qu'on compte, et le saisir une seconde fois n'apportait
 * rien. On reprend donc son intitule, tronque a la longueur de la
 * colonne. Une mesure generale, elle, garde son indicateur propre --
 * c'est lui qui la range dans les totaux du projet.
 */
function indicateurDeLaMesure(corps, objectif) {
  const saisi = String(corps.indicator ?? '').trim();
  if (saisi !== '') return texteRequis(corps.indicator, 'indicator', { max: 120 });
  if (objectif) return objectif.label.slice(0, 120);

  return texteRequis(corps.indicator, 'indicator', { max: 120 });
}

async function verifierReferences(projectId, beneficiaryId) {
  const projet = await projectRepository.trouverParId(projectId);
  if (!projet) throw new ErreurIntrouvable('Le projet', projectId);
  // Un impact se mesure souvent APRES la cloture du projet : c'est meme le
  // cas normal. Seul l'archivage fige definitivement le dossier.
  if (projet.status === 'ARCHIVED') {
    throw new ErreurRegleMetier(
      'Ce projet est archivé : ses impacts ne sont plus modifiables.',
      'PROJET_ARCHIVE'
    );
  }

  if (beneficiaryId !== null) {
    const beneficiaire = await beneficiaryRepository.trouverParId(beneficiaryId);
    if (!beneficiaire) throw new ErreurIntrouvable('Le beneficiaire', beneficiaryId);
  }
}

export async function creer(corps = {}) {
  const projectId = identifiantRequis(corps.projectId, 'projectId');
  const beneficiaryId = identifiantFacultatif(corps.beneficiaryId, 'beneficiaryId');

  await verifierReferences(projectId, beneficiaryId);

  const objectif = await objectifDuProjet(projectId, corps.objectiveId);

  return impactRepository.creer({
    projectId,
    objectiveId: objectif?.id ?? null,
    beneficiaryId,
    title: texteRequis(corps.title, 'title', { max: 200 }),
    description: texteFacultatif(corps.description, 'description', { max: 5000 }),
    indicator: indicateurDeLaMesure(corps, objectif),
    value: nombreRequis(corps.value, 'value'),
    unit: texteFacultatif(corps.unit, 'unit', { max: 60 }),
    measuredAt: dateFacultative(corps.measuredAt, 'measuredAt'),
  });
}

export async function mettreAJour(id, corps = {}) {
  const impactId = identifiantRequis(id, 'id');
  const existant = await impactRepository.trouverParId(impactId);
  if (!existant) throw new ErreurIntrouvable("L'impact", impactId);

  const colonnes = {};
  if (corps.title !== undefined) colonnes.title = texteRequis(corps.title, 'title', { max: 200 });
  if (corps.description !== undefined) {
    colonnes.description = texteFacultatif(corps.description, 'description', { max: 5000 });
  }
  if (corps.indicator !== undefined) {
    colonnes.indicator = texteRequis(corps.indicator, 'indicator', { max: 120 });
  }
  if (corps.value !== undefined) colonnes.value = nombreRequis(corps.value, 'value');
  if (corps.unit !== undefined) colonnes.unit = texteFacultatif(corps.unit, 'unit', { max: 60 });
  if (corps.measuredAt !== undefined) {
    colonnes.measured_at = dateFacultative(corps.measuredAt, 'measuredAt');
  }
  if (corps.objectiveId !== undefined) {
    const objectif = await objectifDuProjet(existant.projectId, corps.objectiveId);
    colonnes.objective_id = objectif?.id ?? null;
    // Changer d'objectif change ce qu'on compte : l'intitule suit, sauf
    // si la mesure porte son propre indicateur.
    if (objectif && corps.indicator === undefined) {
      colonnes.indicator = objectif.label.slice(0, 120);
    }
  }
  if (corps.beneficiaryId !== undefined) {
    const beneficiaryId = identifiantFacultatif(corps.beneficiaryId, 'beneficiaryId');
    if (beneficiaryId !== null) {
      const beneficiaire = await beneficiaryRepository.trouverParId(beneficiaryId);
      if (!beneficiaire) throw new ErreurIntrouvable('Le beneficiaire', beneficiaryId);
    }
    colonnes.beneficiary_id = beneficiaryId;
  }

  return impactRepository.mettreAJour(impactId, colonnes);
}

/**
 * Supprime un impact.
 * Contrairement aux ecritures financieres, un indicateur mal saisi peut
 * etre retire : il ne fait pas partie de la piste d'audit comptable.
 */
export async function supprimer(id) {
  const impactId = identifiantRequis(id, 'id');
  const supprime = await impactRepository.supprimer(impactId);
  if (!supprime) throw new ErreurIntrouvable("L'impact", impactId);
  return { id: impactId, deleted: true };
}
