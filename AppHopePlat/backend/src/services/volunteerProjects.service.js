/**
 * Les projets, vus depuis l'espace benevole.
 *
 * L'espace tournait autour des missions : une liste plate de creneaux,
 * sans dire a quoi ils servaient. Il tourne desormais autour des
 * projets, qui sont ce que HOPE mene reellement -- chacun portant ses
 * taches et ses missions.
 *
 * Rien de financier ne sort d'ici. Un benevole vient voir ou il peut
 * aider ; le budget d'un projet ne le regarde pas, et le repository ne
 * le lit meme pas.
 */
import * as missionRepository from '../repositories/mission.repository.js';
import * as projectRepository from '../repositories/project.repository.js';
import * as taskRepository from '../repositories/task.repository.js';
import { ErreurIntrouvable } from '../shared/errors.js';

/** Tous les projets ouverts, avec ce qu'il y a a y faire. */
export async function lister() {
  const items = await projectRepository.listerPourBenevole();
  return { items };
}

/**
 * Un projet et tout ce qui s'y rattache.
 *
 * Les taches et les missions arrivent ensemble : c'est la page qui les
 * reunit, et un aller-retour de moins vaut mieux que deux listes
 * chargees l'une apres l'autre.
 *
 * @param {number|string} id
 * @param {{ id: string }|null} fiche la fiche du benevole, pour savoir
 *        ou il est deja inscrit
 */
export async function recupererParId(id, fiche = null) {
  const projet = await projectRepository.trouverPourBenevole(id);
  if (!projet) throw new ErreurIntrouvable('Le projet', id);

  const [taches, missions] = await Promise.all([
    taskRepository.lister({ projetId: projet.id }),
    missionRepository.lister({ projetId: projet.id }, fiche?.id ?? null),
  ]);

  return { project: projet, tasks: taches, missions };
}
