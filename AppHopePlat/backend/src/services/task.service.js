/**
 * Service des taches, cote espace benevole.
 *
 * Une tache libre se prend, se rend, ou se declare livree. Le benevole
 * n'agit que sur les siennes -- sauf pour prendre une tache libre, ce
 * qui est justement l'exception.
 *
 * Prendre une tache se fait sous verrou : deux benevoles qui cliquent
 * en meme temps ne doivent pas se croire tous les deux dessus.
 */
import { transaction } from '../config/database.js';
import * as profileRepository from '../repositories/volunteerProfile.repository.js';
import * as taskRepository from '../repositories/task.repository.js';
import { ErreurIntrouvable, ErreurRegleMetier, ErreurValidation } from '../shared/errors.js';

const STATUTS = ['a_faire', 'en_cours', 'livree'];

/** Les taches libres, que n'importe quel benevole peut prendre. */
export async function listerLibres() {
  const items = await taskRepository.lister({ libres: true });
  return { items };
}

/**
 * "Mes taches" : les trois colonnes de l'ecran.
 *
 * @param {string} utilisateurId
 * @param {{ statut?: string }} requete
 */
export async function mesTaches(utilisateurId, requete = {}) {
  const fiche = await profileRepository.garantir(utilisateurId);

  const statut = requete.statut
    ? String(requete.statut).trim().toLowerCase()
    : null;
  if (statut && !STATUTS.includes(statut)) {
    throw new ErreurValidation(`Le champ "statut" doit valoir : ${STATUTS.join(', ')}.`, {
      statut: 'Valeur non autorisée',
    });
  }

  const [items, compteurs] = await Promise.all([
    taskRepository.lister({ benevoleId: fiche.id, statut }),
    taskRepository.compterParStatut(fiche.id),
  ]);

  return { items, counts: compteurs };
}

/** Le benevole prend une tache libre. */
export async function prendre(id, utilisateurId) {
  return transaction(async (client) => {
    const fiche = await profileRepository.garantir(utilisateurId, client);

    const tache = await taskRepository.verrouiller(id, client);
    if (!tache) throw new ErreurIntrouvable('La tâche', id);

    if (tache.benevoleId === fiche.id) {
      throw new ErreurRegleMetier('Cette tâche est déjà la vôtre.', 'DEJA_PRISE');
    }
    if (tache.benevoleId) {
      throw new ErreurRegleMetier(
        'Un autre bénévole a pris cette tâche.',
        'TACHE_DEJA_PRISE'
      );
    }

    return taskRepository.prendre(id, fiche.id, client);
  });
}

/** Le benevole rend une tache : elle repart au pot commun. */
export async function relacher(id, utilisateurId) {
  return transaction(async (client) => {
    const fiche = await profileRepository.garantir(utilisateurId, client);

    const tache = await taskRepository.verrouiller(id, client);
    if (!tache) throw new ErreurIntrouvable('La tâche', id);

    if (tache.benevoleId !== fiche.id) {
      throw new ErreurRegleMetier('Cette tâche n’est pas la vôtre.', 'TACHE_ETRANGERE');
    }
    if (tache.statut === 'livree') {
      throw new ErreurRegleMetier(
        'Une tâche livrée ne peut plus être rendue.',
        'TACHE_LIVREE'
      );
    }

    return taskRepository.relacher(id, client);
  });
}

/** Le benevole declare la tache livree. */
export async function livrer(id, utilisateurId) {
  return transaction(async (client) => {
    const fiche = await profileRepository.garantir(utilisateurId, client);

    const tache = await taskRepository.verrouiller(id, client);
    if (!tache) throw new ErreurIntrouvable('La tâche', id);

    if (tache.benevoleId !== fiche.id) {
      throw new ErreurRegleMetier('Cette tâche n’est pas la vôtre.', 'TACHE_ETRANGERE');
    }
    if (tache.statut === 'livree') {
      throw new ErreurRegleMetier('Cette tâche est déjà livrée.', 'TACHE_LIVREE');
    }

    return taskRepository.livrer(id, client);
  });
}
