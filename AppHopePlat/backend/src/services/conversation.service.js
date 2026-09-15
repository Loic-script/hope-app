/**
 * Service des conversations.
 *
 * Tout le monde ecrit a tout le monde : benevole, bailleur, donateur,
 * equipe. Le service ne raisonne que sur un "acteur" -- { type, id } --
 * deja etabli par le middleware de l'espace d'ou vient la demande.
 *
 * Il n'y a donc pas de regle de role ici, et c'est voulu : la seule
 * barriere est l'appartenance a la conversation.
 */
import { transaction } from '../config/database.js';
import * as conversationRepository from '../repositories/conversation.repository.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';

const CORPS_MAX = 4000;
const CORPS_MIN = 1;

/** Verifie le texte d'un message. */
function corpsValide(valeur) {
  const corps = String(valeur ?? '').trim();
  if (corps.length < CORPS_MIN) {
    throw new ErreurValidation('Le message est vide.', { corps: 'Champ obligatoire' });
  }
  if (corps.length > CORPS_MAX) {
    throw new ErreurValidation('Le message est trop long.', {
      corps: `${CORPS_MAX} caractères au maximum`,
    });
  }
  return corps;
}

/** Verifie la designation d'un destinataire. */
function acteurValide(valeur, champ = 'destinataire') {
  const type = String(valeur?.type ?? '').trim();
  const id = String(valeur?.id ?? '').trim();

  if (!['utilisateur', 'admin'].includes(type) || id === '') {
    throw new ErreurValidation('Destinataire invalide.', { [champ]: 'Valeur non acceptée' });
  }
  return { type, id: type === 'admin' ? Number(id) : id };
}

/** Les conversations de l'acteur. */
export function lister(acteur) {
  return conversationRepository.lister(acteur);
}

/** L'annuaire : qui peut-on joindre. */
export function annuaire(acteur) {
  return conversationRepository.annuaire(acteur);
}

/** Le nombre de conversations qui portent du non-lu. */
export function compterNonLues(acteur) {
  return conversationRepository.compterNonLues(acteur);
}

/**
 * Une conversation et ses messages.
 *
 * L'ouvrir vaut lecture : la pastille s'eteint ici, et non sur un bouton
 * que personne ne cliquerait.
 */
export async function recuperer(acteur, id) {
  const conversation = await conversationRepository.trouver(acteur, id);
  if (!conversation) throw new ErreurIntrouvable('La conversation', id);

  const liste = await conversationRepository.messages(conversation.id);
  await conversationRepository.marquerLue(acteur, conversation.id);

  return { conversation, messages: liste };
}

/**
 * Ouvre une conversation avec quelqu'un, ou retrouve celle qui existe.
 *
 * Ecrire deux fois a la meme personne doit continuer le meme fil : une
 * seconde conversation a deux avec les memes participants serait un
 * doublon que personne ne saurait departager.
 */
export async function ouvrir(acteur, corpsRequete = {}) {
  const destinataire = acteurValide(corpsRequete.destinataire);
  const corps = corpsRequete.corps === undefined ? null : corpsValide(corpsRequete.corps);

  if (destinataire.type === acteur.type && String(destinataire.id) === String(acteur.id)) {
    throw new ErreurValidation('On ne s’écrit pas à soi-même.', {
      destinataire: 'Choisissez quelqu’un d’autre',
    });
  }

  return transaction(async (client) => {
    let id = await conversationRepository.trouverEntre(acteur, destinataire, client);
    if (!id) {
      id = await conversationRepository.creer([acteur, destinataire], client);
    }
    if (corps) {
      await conversationRepository.ajouterMessage({ conversationId: id, acteur, corps }, client);
    }
    return { id };
  });
}

/** Ecrit dans une conversation dont on fait partie. */
export async function ecrire(acteur, id, corpsRequete = {}) {
  const conversation = await conversationRepository.trouver(acteur, id);
  if (!conversation) throw new ErreurIntrouvable('La conversation', id);

  const message = await conversationRepository.ajouterMessage({
    conversationId: conversation.id,
    acteur,
    corps: corpsValide(corpsRequete.corps),
  });
  await conversationRepository.marquerLue(acteur, conversation.id);
  return message;
}
