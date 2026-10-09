import * as volunteerRepository from '../repositories/volunteer.repository.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';
import { versBenevolePublic } from './volunteerAuth.service.js';
import * as courrielsAuto from './courrielsAutomatiques.service.js';

const STATUTS_ADMIN = ['actif', 'suspendu', 'supprime'];

const STATUTS = ['en_attente', ...STATUTS_ADMIN];

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
  if (statut === 'actif') void courrielsAuto.compteValide(id, 'benevole');

  return versBenevolePublic(compte);
}

export async function activer(id, admin = null) {
  return changerStatut(id, { statut: 'actif' }, admin);
}

export async function compterEnAttente() {
  const compteurs = await volunteerRepository.compterParStatut('benevole');
  return compteurs.en_attente;
}
