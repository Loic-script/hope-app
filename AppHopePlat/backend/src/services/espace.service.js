/**
 * Service des notifications et des messages des espaces utilisateurs.
 *
 * Commun au benevole et au bailleur : ni les notifications ni le
 * courrier ne dependent du role. Le service ne sait d'ailleurs pas
 * lequel des deux l'appelle -- il ne recoit qu'un identifiant
 * d'utilisateur, deja verifie par le middleware.
 */
import * as espaceRepository from '../repositories/espace.repository.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';

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
 * Exportee pour que les autres services s'en servent : une mission
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

  return espaceRepository.creerMessage({ utilisateurId, sujet, corps });
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

export function compteurs(utilisateurId) {
  return espaceRepository.compteurs(utilisateurId);
}
