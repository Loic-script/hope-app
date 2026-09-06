/**
 * Service de la messagerie.
 *
 * Seul un donateur disposant d'un compte peut ecrire a HOPE : c'est l'un
 * des avantages du compte donateur. L'espace donateur n'existant pas
 * encore, l'administrateur peut saisir un message recu par un autre canal
 * pour ne pas perdre l'echange.
 */
import { transaction } from '../config/database.js';
import * as messageRepository from '../repositories/message.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';

import { ErreurIntrouvable, ErreurRegleMetier } from '../shared/errors.js';
import { identifiantRequis, texteFacultatif, texteRequis, valeurParmi } from '../shared/validation.js';

export const STATUTS = ['NEW', 'READ', 'ANSWERED'];

export async function lister(requete = {}) {
  const [messages, nonLus] = await Promise.all([
    messageRepository.lister({
      statut: requete.status ? valeurParmi(requete.status, 'status', STATUTS) : null,
      recherche: texteFacultatif(requete.search, 'search', { max: 120 }),
    }),
    messageRepository.compterNonLus(),
  ]);

  return { items: messages, unreadCount: nonLus };
}

export async function recupererParId(id) {
  const message = await messageRepository.trouverParId(identifiantRequis(id, 'id'));
  if (!message) throw new ErreurIntrouvable('Le message', id);
  return message;
}

/** Enregistre un message venant d'un donateur avec compte. */
export async function creer(corps = {}) {
  const donorAccountId = identifiantRequis(corps.donorAccountId, 'donorAccountId');
  const sujet = texteRequis(corps.subject, 'subject', { max: 200 });
  const contenu = texteRequis(corps.body, 'body', { max: 5000 });

  return transaction(async (client) => {
    const message = await messageRepository.creer(
      { donorAccountId, subject: sujet, body: contenu },
      client
    );

    await notificationRepository.creer(
      {
        type: 'MESSAGE',
        messageId: message.id,
        donorId: message.donorId,
        label: `${message.donorName} a envoyé un message : « ${sujet} »`,
      },
      client
    );

    return message;
  });
}

/** Ouvre un message : il passe de "nouveau" a "lu". */
export async function marquerLu(id) {
  const messageId = identifiantRequis(id, 'id');
  const message = await messageRepository.marquerLu(messageId);
  if (!message) throw new ErreurIntrouvable('Le message', messageId);
  return message;
}

/** Repond a un message. La reponse remplace la precedente s'il y en a une. */
export async function repondre(id, corps = {}) {
  const messageId = identifiantRequis(id, 'id');
  const existant = await messageRepository.trouverParId(messageId);
  if (!existant) throw new ErreurIntrouvable('Le message', messageId);

  const reponse = texteRequis(corps.reply, 'reply', { max: 5000 });

  if (existant.status === 'ANSWERED' && corps.force !== true) {
    throw new ErreurRegleMetier(
      'Ce message a déjà reçu une réponse.',
      'MESSAGE_DEJA_REPONDU'
    );
  }

  return messageRepository.repondre(messageId, reponse);
}
