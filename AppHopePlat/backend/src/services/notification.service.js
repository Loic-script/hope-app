/**
 * Service des notifications de l'administrateur.
 *
 * Les notifications ne sont pas creees ici : chaque service depose la
 * sienne au moment de l'evenement (un don encaisse, un projet termine, un
 * investissement, un message recu). Ce service ne fait que les servir.
 */
import * as conversationRepository from '../repositories/conversation.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import * as messageRepository from '../repositories/message.repository.js';
import * as taskRepository from '../repositories/task.repository.js';

import { ErreurIntrouvable } from '../shared/errors.js';
import { identifiantRequis, valeurParmi } from '../shared/validation.js';

export const TYPES = ['DONATION', 'MESSAGE', 'PROJECT_COMPLETED', 'INVESTMENT'];

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

/**
 * Compteurs affiches en pastille dans la barre laterale.
 * Volontairement leger : appele a chaque changement de page.
 */
export async function compteurs(admin = null) {
  const [notifications, messages, conversations, taches] = await Promise.all([
    notificationRepository.compterNonLues(),
    messageRepository.compterNonLus(),
    // La messagerie commune : propre a l'administrateur connecte, la ou
    // les deux autres comptes sont ceux de l'equipe entiere.
    admin?.id
      ? conversationRepository.compterNonLues({ type: 'admin', id: admin.id })
      : Promise.resolve(0),
    // Les demandes de taches des benevoles, a valider.
    taskRepository.compterDemandesEnAttente(),
  ]);
  return { notifications, messages, conversations, taches };
}
