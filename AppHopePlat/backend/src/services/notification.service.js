import * as conversationRepository from '../repositories/conversation.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import * as messageRepository from '../repositories/message.repository.js';
import * as taskRepository from '../repositories/task.repository.js';

import { ErreurIntrouvable } from '../shared/errors.js';
import { identifiantRequis, valeurParmi } from '../shared/validation.js';

export const TYPES = [
  'DONATION',
  'MESSAGE',
  'PROJECT_COMPLETED',
  'INVESTMENT',
  'ACCOUNT_CREATED',
  'TASK_REQUEST',
  'TASK_DELIVERED',
  'FUNDER_INTEREST',
  'FIELD_PROOF',
  'CONTACT',
];

export function signalerDemandeDeTache({ qui, tache, projet, tacheId }, client = null) {
  return notificationRepository.creer(
    {
      type: 'TASK_REQUEST',
      label: `Demande de tâche : ${qui} veut « ${tache} »${
        projet ? ` (${projet})` : ''
      } — à valider.`,
      tacheId,
    },
    client
  );
}

export function signalerTacheLivree({ qui, tache, projet, tacheId }, client = null) {
  return notificationRepository.creer(
    {
      type: 'TASK_DELIVERED',
      label: `Tâche livrée : ${qui} a terminé « ${tache} »${
        projet ? ` (${projet})` : ''
      } — preuve à vérifier.`,
      tacheId,
    },
    client
  );
}

export function signalerInteretBailleur({ organisation, projet, projetId }, client = null) {
  return notificationRepository.creer(
    {
      type: 'FUNDER_INTEREST',
      label: `${organisation} souhaite financer${
        projet ? ` « ${projet} »` : ' un projet'
      } — à recontacter.`,
      projectId: projetId ?? null,
    },
    client
  );
}

export function signalerPreuveTerrain({ qui, projet, projetId }, client = null) {
  return notificationRepository.creer(
    {
      type: 'FIELD_PROOF',
      label: `Preuve terrain : ${qui} a déposé une preuve sur « ${projet} » — à relire.`,
      projectId: projetId ?? null,
    },
    client
  );
}

const SUITE_A_DONNER = {
  donateur: 'le compte est ouvert, il peut donner dès maintenant.',
  benevole: 'à valider avant qu’il puisse prendre une tâche.',
  bailleur: 'à valider, puis prendre contact.',
};

const NOM_DU_TYPE = {
  donateur: 'Nouveau donateur',
  benevole: 'Nouveau bénévole',
  bailleur: 'Nouveau partenaire',
};

export function signalerNouveauCompte(compte, client = null) {
  const qui = (compte.nom ?? '').trim() || compte.email;
  const ou = compte.organisation ? ` (${compte.organisation})` : '';

  return notificationRepository.creer(
    {
      type: 'ACCOUNT_CREATED',
      label: `${NOM_DU_TYPE[compte.type] ?? 'Nouveau compte'} : ${qui}${ou} — ${
        SUITE_A_DONNER[compte.type] ?? 'compte ouvert.'
      }`,
      utilisateurId: compte.utilisateurId,
    },
    client
  );
}

export async function lister(requete = {}) {
  const [notifications, nonLues] = await Promise.all([
    notificationRepository.lister({
      type: requete.type ? valeurParmi(requete.type, 'type', TYPES) : null,
      nonLues: requete.unread === 'true' || requete.unread === true,
      limite: 150,
    }),
    notificationRepository.compterNonLues(),
  ]);

  return { items: notifications, unreadCount: nonLues };
}

export async function marquerLue(id) {
  const notification = await notificationRepository.marquerLue(identifiantRequis(id, 'id'));
  if (!notification) throw new ErreurIntrouvable('La notification', id);
  return notification;
}

export async function toutMarquerLu() {
  const nombre = await notificationRepository.toutMarquerLu();
  return { updated: nombre, unreadCount: 0 };
}

export function compterNonLues() {
  return notificationRepository.compterNonLues();
}

export async function compteurs(admin = null) {
  const [notifications, messages, conversations, taches] = await Promise.all([
    notificationRepository.compterNonLues(),
    messageRepository.compterNonLus(),
    admin?.id
      ? conversationRepository.compterNonLues({ type: 'admin', id: admin.id })
      : Promise.resolve(0),
    taskRepository.compterDemandesEnAttente(),
  ]);
  return { notifications, messages, conversations, taches };
}
