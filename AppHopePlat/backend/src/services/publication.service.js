import { transaction } from '../config/database.js';
import * as activityLogRepository from '../repositories/activityLog.repository.js';
import * as espaceRepository from '../repositories/espace.repository.js';
import * as projectRepository from '../repositories/project.repository.js';
import * as publicationRepository from '../repositories/publication.repository.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';
import { depuisBase, pourcentage } from '../shared/money.js';
import { identifiantFacultatif, texteFacultatif, texteRequis } from '../shared/validation.js';
import * as mediaService from './media.service.js';
import * as reactions from './reactionsActualite.service.js';

export const TYPES = {
  actualite: 'Actualité',
  appel_financement: 'Appel à financement',
};

export const STATUTS_INTERET = ['nouvelle', 'contactee', 'convertie', 'classee'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PHOTO_TELEVERSEE = /^\/media\/[A-Za-z0-9][A-Za-z0-9._-]*$/;

function uuidRequis(valeur, quoi) {
  const texte = String(valeur ?? '');
  if (!UUID.test(texte)) throw new ErreurIntrouvable(quoi, valeur);
  return texte;
}

function presenter(publication) {
  const appel = publication.type === 'appel_financement';
  const budget = depuisBase(publication.budgetProjet);
  const finance = depuisBase(publication.montantFinance);
  const avecBarre = appel && publication.projetId !== null && budget > 0;

  return {
    ...publication,
    avancement: avecBarre ? pourcentage(finance, budget) : null,
    objectifAtteint: avecBarre && finance >= budget,
    projetTermine: avecBarre && publication.projetStatut !== 'IN_PROGRESS',
    interets: Array.isArray(publication.interets) ? publication.interets : [],
  };
}

async function valider(corps, existant = null) {
  const type = String(corps.type ?? '').trim();
  if (!Object.keys(TYPES).includes(type)) {
    throw new ErreurValidation('Choisissez le type : actualité ou appel à financement.', {
      type: 'Valeur non autorisée',
    });
  }
  const appel = type === 'appel_financement';

  const donnees = {
    type,
    titre: texteRequis(corps.titre, 'titre', { max: 200 }),
    corps: texteFacultatif(corps.corps, 'corps', { max: 5000 }),
    projetId: identifiantFacultatif(corps.projetId, 'projetId'),
    mediaUrl: null,
  };

  let projet = null;
  if (donnees.projetId) {
    projet = await projectRepository.trouverParId(donnees.projetId);
    if (!projet) {
      throw new ErreurValidation('Ce projet n’existe pas.', { projetId: 'Projet introuvable' });
    }
  }

  if (appel) {
    if (!projet) {
      throw new ErreurValidation(
        'Un appel à financement se rattache à un projet : sa barre suit le budget du projet.',
        { projetId: 'Projet obligatoire pour un appel' }
      );
    }
    const nouveauRattachement =
      !existant || existant.type !== type || existant.projetId !== donnees.projetId;
    if (nouveauRattachement && projet.status !== 'IN_PROGRESS') {
      throw new ErreurValidation('Un appel à financement ne vise qu’un projet en cours.', {
        projetId: 'Projet terminé ou archivé',
      });
    }
  }

  const photo = typeof corps.mediaUrl === 'string' ? corps.mediaUrl.trim() : '';
  if (photo) {
    if (!PHOTO_TELEVERSEE.test(photo)) {
      throw new ErreurValidation('La photo doit être importée depuis votre poste.', {
        mediaUrl: 'Adresse non acceptée',
      });
    }
    donnees.mediaUrl = projet && photo === projet.mediaUrl ? null : photo;
  }

  return donnees;
}

async function effacerPhoto(adresse) {
  if (!adresse) return;
  if (await publicationRepository.mediaEncoreUtilise(adresse)) return;
  await mediaService.supprimer(adresse);
}

export async function lister() {
  const chiffres = await reactions.chiffresParPublication();
  const items = (await publicationRepository.lister())
    .map(presenter)
    .map((p) => ({ ...p, ...(chiffres.get(p.id) ?? { jaimes: 0, commentaires: 0, commentairesNonLus: 0 }) }));
  return {
    items,
    counts: {
      tous: items.length,
      actualite: items.filter((p) => p.type === 'actualite').length,
      appel_financement: items.filter((p) => p.type === 'appel_financement').length,
    },
  };
}

export async function filBenevole() {
  return { items: await publicationRepository.listerPourBenevole() };
}

export async function creer(corps = {}, admin = null) {
  const donnees = await valider(corps);
  const appel = donnees.type === 'appel_financement';

  return transaction(async (client) => {
    const { id } = await publicationRepository.creer(
      { ...donnees, publiePar: admin?.id ?? null },
      client
    );

    const notifies = await espaceRepository.notifierBailleurs(
      {
        type: 'actualite',
        titre: appel ? 'Nouvel appel à financement' : 'Nouvelle actualité',
        corps: donnees.titre,
        lien: '/bailleur',
      },
      client
    );

    await activityLogRepository.deposer(
      admin,
      {
        action: 'PUBLISH',
        entityType: 'PUBLICATION',
        label: `a publié ${appel ? 'l’appel à financement' : 'l’actualité'} « ${donnees.titre} » (${id})`,
      },
      client
    );

    return { id, notifies };
  });
}

export async function modifier(id, corps = {}, admin = null) {
  const identifiant = uuidRequis(id, 'La publication');
  const existant = await publicationRepository.trouver(identifiant);
  if (!existant) throw new ErreurIntrouvable('La publication', id);

  const donnees = await valider(corps, existant);

  await transaction(async (client) => {
    await publicationRepository.modifier(identifiant, donnees, client);
    await activityLogRepository.deposer(
      admin,
      {
        action: 'UPDATE',
        entityType: 'PUBLICATION',
        label: `a modifié la publication « ${donnees.titre} » (${identifiant})`,
      },
      client
    );
  });

  if (existant.mediaUrl && existant.mediaUrl !== donnees.mediaUrl) {
    await effacerPhoto(existant.mediaUrl);
  }

  return { id: identifiant };
}

export async function supprimer(id, admin = null) {
  const identifiant = uuidRequis(id, 'La publication');
  const existant = await publicationRepository.trouver(identifiant);
  if (!existant) throw new ErreurIntrouvable('La publication', id);

  await transaction(async (client) => {
    await publicationRepository.supprimer(identifiant, client);
    await activityLogRepository.deposer(
      admin,
      {
        action: 'DELETE',
        entityType: 'PUBLICATION',
        label: `a supprimé la publication « ${existant.titre} » (${identifiant})`,
      },
      client
    );
  });

  await effacerPhoto(existant.mediaUrl);
  return { id: identifiant, interets: existant.interets };
}

export async function televerserPhoto(fichier) {
  const media = mediaService.enregistrer(fichier);
  if (media.type !== 'PHOTO') {
    await mediaService.supprimer(media.url);
    throw new ErreurValidation('Une actualité s’illustre d’une photo : JPG, PNG ou WEBP.', {
      file: 'Photo attendue',
    });
  }
  return media;
}

export async function changerStatutInteret(id, corps = {}) {
  const identifiant = uuidRequis(id, 'L’intérêt');
  const statut = String(corps.statut ?? '').trim();
  if (!STATUTS_INTERET.includes(statut)) {
    throw new ErreurValidation(`Le statut doit valoir : ${STATUTS_INTERET.join(', ')}.`, {
      statut: 'Valeur non autorisée',
    });
  }
  const interet = await publicationRepository.changerStatutInteret(identifiant, statut);
  if (!interet) throw new ErreurIntrouvable('L’intérêt', id);
  return interet;
}
