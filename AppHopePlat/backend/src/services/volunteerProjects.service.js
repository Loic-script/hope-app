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
import * as taskRepository from '../repositories/task.repository.js';
import { ErreurIntrouvable } from '../shared/errors.js';

/** Tous les projets ouverts, avec ce qu'il y a a y faire. */
export async function lister() {
  const items = await projectRepository.listerPourBenevole();
  return { items };
}

/**
 * Un projet et ses taches.
 *
 * @param {number|string} id
 */
export async function recupererParId(id) {
  const projet = await projectRepository.trouverPourBenevole(id);
  if (!projet) throw new ErreurIntrouvable('Le projet', id);

  const taches = await taskRepository.lister({ projetId: projet.id });
  return { project: projet, tasks: taches };
}
