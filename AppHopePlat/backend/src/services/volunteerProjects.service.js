import * as fieldProofRepository from '../repositories/fieldProof.repository.js';
import * as impactRepository from '../repositories/impact.repository.js';
import * as projectRepository from '../repositories/project.repository.js';
import { ErreurIntrouvable } from '../shared/errors.js';
import { identifiantRequis } from '../shared/validation.js';
import { INDICATEURS_SUGGERES } from './impact.service.js';
import { listerPourBenevoleParProjet } from './task.service.js';

export async function lister() {
  const items = await projectRepository.listerPourBenevole();
  return { items };
}

async function projetVisible(id) {
  const projet = await projectRepository.trouverPourBenevole(identifiantRequis(id, 'id'));
  if (!projet) throw new ErreurIntrouvable('Le projet', id);
  return projet;
}

export async function recupererParId(id, utilisateurId) {
  const projet = await projetVisible(id);

  const [taches, impacts, synthese, preuves] = await Promise.all([
    listerPourBenevoleParProjet(projet.id, utilisateurId),
    impactRepository.listerPourBenevole(projet.id),
    impactRepository.syntheseParProjet(projet.id),
    fieldProofRepository.listerPourBenevole(projet.id, utilisateurId),
  ]);

  return {
    project: projet,
    tasks: taches,
    impacts,
    impactSummary: synthese,
    proofs: preuves,
    indicators: INDICATEURS_SUGGERES,
  };
}

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
