/**
 * Service de gestion des benevoles, cote administrateur.
 *
 * L'inscription d'un benevole ne lui ouvre rien : elle depose une demande.
 * C'est ici que l'administrateur l'accepte, la suspend ou la refuse.
 */
import * as volunteerRepository from '../repositories/volunteer.repository.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';
import { versBenevolePublic } from './volunteerAuth.service.js';

/** Statuts qu'un administrateur peut poser depuis son espace. */
const STATUTS_ADMIN = ['actif', 'suspendu', 'supprime'];

/** Tous les statuts d'un compte, celui de l'inscription compris. */
const STATUTS = ['en_attente', ...STATUTS_ADMIN];

/**
 * Verifie qu'une valeur fait partie d'une liste.
 *
 * On n'utilise pas valeurParmi() de shared/validation : elle passe la
 * valeur en majuscules, ce qui convient aux enums du reste du projet
 * (IN_PROGRESS, RECEIVED) mais pas aux statuts de cette table, ecrits
 * en minuscules.
 */
function statutParmi(valeur, autorises) {
  const texte = String(valeur ?? '').trim().toLowerCase();
  if (!autorises.includes(texte)) {
    throw new ErreurValidation(
      `Le champ "statut" doit valoir : ${autorises.join(', ')}.`,
      { statut: 'Valeur non autorisée' }
    );
  }
  return texte;
}

/**
 * Liste les benevoles, les demandes en attente d'abord.
 *
 * @param {{ statut?: string }} requete
 */
export async function lister(requete = {}) {
  const statut = requete.statut ? statutParmi(requete.statut, STATUTS) : null;

  const [comptes, compteurs] = await Promise.all([
    volunteerRepository.lister({ role: 'benevole', statut }),
    volunteerRepository.compterParStatut('benevole'),
  ]);

  return {
    items: comptes.map(versBenevolePublic),
    counts: compteurs,
  };
}

/**
 * Change le statut d'un benevole.
 *
 * @param {string} id identifiant UUID du compte
 * @param {{ statut: string }} corps
 * @param {{ id: number, adminLog: string }} admin auteur de la decision
 */
export async function changerStatut(id, corps = {}, admin = null) {
  const statut = statutParmi(corps.statut, STATUTS_ADMIN);

  const existant = await volunteerRepository.trouverParId(id);
  if (!existant) {
    throw new ErreurIntrouvable('Le bénévole', id);
  }

  if (existant.statut === statut) {
    throw new ErreurValidation(`Ce compte est déjà « ${statut} ».`, { statut: 'Sans effet' });
  }

  const compte = await volunteerRepository.changerStatut(id, statut, admin?.id ?? null);

  // La table notifications n'accepte que quatre types metier : pas de
  // trace ici. L'activation reste inscrite sur le compte lui-meme, par
  // active_le et active_par.
  return versBenevolePublic(compte);
}

/** Raccourci de l'action la plus courante. */
export async function activer(id, admin = null) {
  return changerStatut(id, { statut: 'actif' }, admin);
}

/** Nombre de demandes en attente, pour la pastille de l'espace admin. */
export async function compterEnAttente() {
  const compteurs = await volunteerRepository.compterParStatut('benevole');
  return compteurs.en_attente;
}
