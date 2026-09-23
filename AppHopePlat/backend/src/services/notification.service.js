/**
 * Service des notifications de l'administrateur.
 *
 * Les notifications sont posees par les services, au moment de
 * l'evenement : un don encaisse, un projet termine, un investissement,
 * un message recu. Ce service les sert.
 *
 * Une exception : l'ouverture d'un compte. Elle se produit a deux
 * endroits -- l'inscription commune aux trois espaces, et celle du
 * bailleur qui remplit la fiche de son organisation. La phrase et le
 * lien doivent etre les memes, ils sont donc ecrits ici une seule fois.
 */
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
];

/** Ce que l'equipe a a faire, selon le type de compte qui vient de s'ouvrir. */
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

/**
 * Previent l'equipe qu'un compte vient de s'ouvrir.
 *
 * La phrase dit trois choses : qui, de quelle sorte, et ce qu'il y a a
 * faire -- un benevole attend une validation, un donateur non. Le compte
 * est rattache a la notification : l'ecran s'ouvre d'un clic.
 *
 * A appeler dans la transaction qui cree le compte : un compte cree sans
 * que personne ne le sache serait pire qu'une inscription refusee.
 *
 * @param {{ utilisateurId: string, type: string, email: string,
 *           nom?: string, organisation?: string|null }} compte
 */
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
