import { ProjectStatus } from '@prisma/client';
import { createContainer } from '../container.js';
import { disconnectPrisma, prisma } from '../database/prisma.js';
import { isMainModule, line, note, runScript, title } from '../shared/run-script.js';

/**
 * RETIRE DU SITE LES PROJETS CREES PAR LES SCRIPTS DE DEMONSTRATION.
 *
 *   npm run db:unpublish-demo
 *
 * POURQUOI CE SCRIPT PLUTOT QU'UNE SUPPRESSION
 *   Ces projets ont recu de vraies affectations, issues de vraies transactions
 *   encaissees. Les supprimer effacerait des ecritures financieres, ce que les
 *   regles metier interdisent explicitement (regle n.8). On les fait donc
 *   passer en CANCELLED : la transition est autorisee, l'operation est
 *   journalisee, l'historique comptable reste intact, et l'API publique — qui
 *   ne montre que les projets ACTIVE et COMPLETED — cesse de les afficher.
 *
 *   Le geste est reversible et tracable, contrairement a un DELETE.
 *
 * A NOTER : depuis leur correction, les scripts de demonstration laissent
 * leurs projets en DRAFT et n'encombrent donc plus le site. Ce script ne sert
 * qu'a nettoyer ceux crees avant ce changement.
 */

/** Prefixes employes par les scripts de demonstration. */
const DEMO_NAME_PREFIXES = ['Demo ', 'Démo ', 'Projet de demonstration'];

export async function unpublishDemoProjects(): Promise<number> {
  const { services } = createContainer();

  const candidates = await prisma.project.findMany({
    where: {
      status: ProjectStatus.ACTIVE,
      OR: DEMO_NAME_PREFIXES.map((prefix) => ({ name: { startsWith: prefix } })),
    },
    select: { id: true, code: true, name: true },
  });

  for (const project of candidates) {
    await services.projectService.changeProjectStatus(project.id, ProjectStatus.CANCELLED);
    line(project.code, project.name);
  }

  return candidates.length;
}

if (isMainModule(import.meta.url)) {
  await runScript(
    'db:unpublish-demo',
    async () => {
      title('Retrait des projets de demonstration du site public');

      const count = await unpublishDemoProjects();

      if (count === 0) {
        note('Aucun projet de demonstration publie : rien a faire.');
      } else {
        note(`${count} projet(s) retire(s) du site. Aucune donnee financiere supprimee.`);
      }

      const remaining = await prisma.project.count({ where: { status: ProjectStatus.ACTIVE } });
      line('Projets encore publies', remaining);
    },
    disconnectPrisma,
  );
}
