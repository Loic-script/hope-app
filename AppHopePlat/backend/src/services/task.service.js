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

/* ================================================================
   Cote administration : creer et retirer les taches d'un projet
   ================================================================ */

/** Les taches d'un projet, pour la fiche projet du back-office. */
export async function listerParProjet(projetId) {
  return taskRepository.lister({ projetId });
}

/**
 * Cree une tache sur un projet.
 *
 * Elle nait libre : c'est ce qui la rend visible a tous les benevoles.
 * L'echeance est facultative -- toutes les taches n'en ont pas -- mais
 * si elle est donnee, elle doit etre une date.
 */
export async function creerPourProjet(projetId, corps = {}) {
  const titre = String(corps.titre ?? '').trim();
  const description = String(corps.description ?? '').trim();
  const echeance = String(corps.echeance ?? '').trim();

  const details = {};
  if (titre === '') details.titre = 'Champ obligatoire';
  else if (titre.length > 160) details.titre = '160 caractères au maximum';
  if (echeance !== '' && Number.isNaN(new Date(echeance).getTime())) {
    details.echeance = 'Date invalide';
  }
  if (Object.keys(details).length > 0) {
    throw new ErreurValidation('La tâche est incomplète.', details);
  }

  return taskRepository.creer({
    projetId,
    titre,
    description: description === '' ? null : description,
    echeance: echeance === '' ? null : echeance,
  });
}

/**
 * Retire une tache.
 *
 * Seulement si personne ne l'a prise : effacer sous les pieds d'un
 * benevole qui travaille dessus lui ferait perdre son travail sans un
 * mot. Il faut alors attendre qu'il la relache.
 */
export async function supprimer(id) {
  const tache = await taskRepository.trouverParId(id);
  if (!tache) throw new ErreurIntrouvable('La tâche', id);

  if (tache.benevoleId) {
    throw new ErreurRegleMetier(
      'Cette tâche est prise par un bénévole : elle ne peut pas être supprimée.',
      'TACHE_PRISE'
    );
  }

  await taskRepository.supprimer(id);
  return { id };
}

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
