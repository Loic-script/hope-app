/**
 * Les projets, vus depuis l'espace benevole.
 *
 * L'espace s'organise autour des projets, qui sont ce que HOPE mene
 * reellement -- chacun portant les taches qu'un benevole peut prendre.
 *
 * Rien de financier ne sort d'ici. Un benevole vient voir ou il peut
 * aider ; le budget d'un projet ne le regarde pas, et le repository ne
 * le lit meme pas. Les beneficiaires non plus : leurs fiches restent dans
 * l'espace administrateur, le benevole n'en voit que le nombre.
 */
import * as fieldProofRepository from '../repositories/fieldProof.repository.js';
import * as impactRepository from '../repositories/impact.repository.js';
import * as projectRepository from '../repositories/project.repository.js';
import { ErreurIntrouvable } from '../shared/errors.js';
import { identifiantRequis } from '../shared/validation.js';
import { INDICATEURS_SUGGERES } from './impact.service.js';
import { listerPourBenevoleParProjet } from './task.service.js';

/** Tous les projets ouverts, avec ce qu'il y a a y faire. */
export async function lister() {
  const items = await projectRepository.listerPourBenevole();
  return { items };
}

/** Le projet, s'il est visible depuis l'espace benevole. */
async function projetVisible(id) {
  const projet = await projectRepository.trouverPourBenevole(identifiantRequis(id, 'id'));
  if (!projet) throw new ErreurIntrouvable('Le projet', id);
  return projet;
}

/**
 * Un projet, en trois volets : sa vue generale, ses taches -- chacune
 * avec la place du benevole : dans l'equipe, demande en attente, refusee,
 * ou rien encore --, et son impact : les totaux mesures, les mesures, et
 * les preuves terrain.
 *
 * @param {number|string} id
 * @param {string} utilisateurId
 */
export async function recupererParId(id, utilisateurId) {
  const projet = await projetVisible(id);

  const [taches, impacts, synthese, preuves] = await Promise.all([
    listerPourBenevoleParProjet(projet.id, utilisateurId),
    impactRepository.listerPourBenevole(projet.id),
    impactRepository.syntheseParProjet(projet.id),
    fieldProofRepository.listerPourBenevole(projet.id),
  ]);

  return {
    project: projet,
    tasks: taches,
    impacts,
    impactSummary: synthese,
    proofs: preuves,
    // Les libelles des indicateurs courants : une mesure porte un code.
    indicators: INDICATEURS_SUGGERES,
  };
}

/** Un fichier d'une preuve terrain du projet, pour le servir. */
export async function fichierDePreuve(projetId, preuveId, fichierId) {
  const projet = await projetVisible(projetId);
  const fichier = await fieldProofRepository.trouverFichierDuProjet(
    projet.id,
    identifiantRequis(preuveId, 'preuveId'),
    identifiantRequis(fichierId, 'fileId')
  );
  if (!fichier) throw new ErreurIntrouvable('Le fichier de la preuve', fichierId);
  return fichier;
}
