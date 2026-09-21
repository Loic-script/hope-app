/**
 * Les projets, vus depuis l'espace benevole.
 *
 * L'espace s'organise autour des projets, qui sont ce que HOPE mene
 * reellement -- chacun portant les taches qu'un benevole peut prendre.
 *
 * Rien de financier ne sort d'ici. Un benevole vient voir ou il peut
 * aider ; le budget d'un projet ne le regarde pas, et le repository ne
 * le lit meme pas.
 */
import * as projectRepository from '../repositories/project.repository.js';
import { ErreurIntrouvable } from '../shared/errors.js';
import { listerPourBenevoleParProjet } from './task.service.js';

/** Tous les projets ouverts, avec ce qu'il y a a y faire. */
export async function lister() {
  const items = await projectRepository.listerPourBenevole();
  return { items };
}

/**
 * Un projet et ses taches, chacune avec la place du benevole : dans
 * l'equipe, demande en attente, refusee, ou rien encore.
 *
 * @param {number|string} id
 * @param {string} utilisateurId
 */
export async function recupererParId(id, utilisateurId) {
  const projet = await projectRepository.trouverPourBenevole(id);
  if (!projet) throw new ErreurIntrouvable('Le projet', id);

  const taches = await listerPourBenevoleParProjet(projet.id, utilisateurId);
  return { project: projet, tasks: taches };
}
