/**
 * Service des notifications et des messages des espaces utilisateurs.
 *
 * Commun au benevole et au bailleur : ni les notifications ni le
 * courrier ne dependent du role. Le service ne sait d'ailleurs pas
 * lequel des deux l'appelle -- il ne recoit qu'un identifiant
 * d'utilisateur, deja verifie par le middleware.
 */
import * as conversationService from './conversation.service.js';
import * as espaceRepository from '../repositories/espace.repository.js';
import {
  ErreurIntrouvable,
  ErreurRegleMetier,
  ErreurValidation,
} from '../shared/errors.js';

/** Longueurs acceptees, alignees sur les colonnes de la base. */
const SUJET_MAX = 160;
const CORPS_MAX = 4000;
const CORPS_MIN = 10;

/* ================================================================
   Notifications
   ================================================================ */

export function listerNotifications(utilisateurId) {
  return espaceRepository.listerNotifications(utilisateurId);
}

/**
 * Marque une notification comme lue.
 *
 * Un identifiant inconnu -- ou appartenant a quelqu'un d'autre -- donne
 * le meme resultat : introuvable. Distinguer les deux cas revelerait
 * l'existence de la notification voisine.
 */
export async function marquerLue(utilisateurId, id) {
  const numero = Number(id);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new ErreurValidation('Identifiant de notification invalide.', {
      id: 'Doit être un entier positif',
    });
  }

  const touchee = await espaceRepository.marquerLue(utilisateurId, numero);
  if (!touchee) throw new ErreurIntrouvable('La notification', id);
  return { id: numero, lu: true };
}

export async function marquerToutLu(utilisateurId) {
  const nombre = await espaceRepository.marquerToutLu(utilisateurId);
  return { marquees: nombre };
}

/**
 * Depose une notification.
 *
 * Exportee pour que les autres services s'en servent : une tache prise
 * annulee, une tache validee, un versement enregistre. Rien ne
 * l'appelle encore ailleurs, et c'est volontaire -- chaque evenement
 * demande sa propre decision de formulation.
 */
export function notifier({ utilisateurId, type, titre, corps, lien }) {
  return espaceRepository.creerNotification({ utilisateurId, type, titre, corps, lien });
}

/* ================================================================
   Messages
   ================================================================ */

export function listerMessages(utilisateurId) {
  return espaceRepository.listerMessages(utilisateurId);
}

/**
 * Verifie le texte d'une prise de parole.
 *
 * Meme regle a l'ouverture d'un fil et a la reponse : ce qui est trop
 * court pour etre compris ne doit pas partir.
 */
function corpsValide(valeur, champ = 'corps') {
  const corps = String(valeur ?? '').trim();
  if (corps === '') throw new ErreurValidation('Le message est vide.', { [champ]: 'Champ obligatoire' });
  if (corps.length < CORPS_MIN) {
    throw new ErreurValidation(`Le message est trop court.`, {
      [champ]: `${CORPS_MIN} caractères au minimum`,
    });
  }
  if (corps.length > CORPS_MAX) {
    throw new ErreurValidation('Le message est trop long.', {
      [champ]: `${CORPS_MAX} caractères au maximum`,
    });
  }
  return corps;
}

/**
 * Repond dans un fil existant.
 *
 * Le fil doit appartenir a celui qui parle : sans cette verification, un
 * identifiant devine suffirait a s'inviter dans la conversation d'un
 * autre. Un fil clos n'accepte plus rien.
 */
export async function repondre(utilisateurId, filId, corpsRequete = {}) {
  const fil = await espaceRepository.trouverFil(filId);
  if (!fil || fil.utilisateurId !== utilisateurId) {
    throw new ErreurIntrouvable('Le message', filId);
  }
  if (fil.statut === 'clos') {
    throw new ErreurRegleMetier(
      'Cette conversation est close. Ouvrez-en une nouvelle.',
      'FIL_CLOS'
    );
  }

  return espaceRepository.ajouterEntree({
    filId: fil.id,
    auteur: 'utilisateur',
    corps: corpsValide(corpsRequete.corps),
  });
}

/* ================================================================
   Cote equipe : lire et repondre a tous les fils
   ================================================================ */

/** Tous les fils des espaces, pour la messagerie de l'administration. */
export function listerTousLesFils() {
  return espaceRepository.listerTousLesFils();
}

/** Repond a un fil au nom de HOPE, et marque comme lu ce qu'il portait. */
export async function repondreDepuisHope(filId, corpsRequete = {}, adminId = null) {
  const fil = await espaceRepository.trouverFil(filId);
  if (!fil) throw new ErreurIntrouvable('Le message', filId);

  const entree = await espaceRepository.ajouterEntree({
    filId: fil.id,
    auteur: 'hope',
    corps: corpsValide(corpsRequete.corps),
    adminId,
  });
  await espaceRepository.marquerFilLuParHope(fil.id);
  return entree;
}

/** Ouvrir un fil cote equipe vaut lecture de ce que l'utilisateur y a dit. */
export async function marquerFilLuParHope(filId) {
  return { marquees: await espaceRepository.marquerFilLuParHope(filId) };
}

/** Envoie un message a l'equipe HOPE. */
export async function envoyerMessage(utilisateurId, corpsRequete = {}) {
  const sujet = String(corpsRequete.sujet ?? '').trim();
  const corps = String(corpsRequete.corps ?? '').trim();

  const details = {};
  if (sujet === '') details.sujet = 'Champ obligatoire';
  else if (sujet.length > SUJET_MAX) details.sujet = `${SUJET_MAX} caractères au maximum`;

  if (corps === '') details.corps = 'Champ obligatoire';
  else if (corps.length < CORPS_MIN) details.corps = `${CORPS_MIN} caractères au minimum`;
  else if (corps.length > CORPS_MAX) details.corps = `${CORPS_MAX} caractères au maximum`;

  if (Object.keys(details).length > 0) {
    throw new ErreurValidation('Le message est incomplet.', details);
  }

  return espaceRepository.creerFil({ utilisateurId, sujet, corps });
}

/**
 * Ouvre la boite : les reponses recues passent en lues.
 *
 * Appelee par l'ecran des messages lui-meme, et non par un bouton :
 * une reponse affichee est une reponse lue.
 */
export async function marquerReponsesLues(utilisateurId) {
  const nombre = await espaceRepository.marquerReponsesLues(utilisateurId);
  return { marquees: nombre };
}

/* ================================================================
   Pastilles
   ================================================================ */

export async function compteurs(utilisateurId, espace = null) {
  const acteur = { type: 'utilisateur', id: utilisateurId, espace };
  const [base, conversations] = await Promise.all([
    espaceRepository.compteurs(utilisateurId),
    conversationService.nonLus(acteur).then((r) => r.total),
  ]);
  // "messages" designe desormais les conversations non lues : c'est la
  // meme pastille, sur la meme entree de menu.
  return { ...base, messages: conversations };
}
