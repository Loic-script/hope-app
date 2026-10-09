import * as conversationService from './conversation.service.js';
import * as espaceRepository from '../repositories/espace.repository.js';
import {
  ErreurIntrouvable,
  ErreurRegleMetier,
  ErreurValidation,
} from '../shared/errors.js';

const SUJET_MAX = 160;
const CORPS_MAX = 4000;
const CORPS_MIN = 10;

export function listerNotifications(utilisateurId) {
  return espaceRepository.listerNotifications(utilisateurId);
}

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

export function notifier({ utilisateurId, type, titre, corps, lien }) {
  return espaceRepository.creerNotification({ utilisateurId, type, titre, corps, lien });
}

export function listerMessages(utilisateurId) {
  return espaceRepository.listerMessages(utilisateurId);
}

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

export function listerTousLesFils() {
  return espaceRepository.listerTousLesFils();
}

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

export async function marquerFilLuParHope(filId) {
  return { marquees: await espaceRepository.marquerFilLuParHope(filId) };
}

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

export async function marquerReponsesLues(utilisateurId) {
  const nombre = await espaceRepository.marquerReponsesLues(utilisateurId);
  return { marquees: nombre };
}

export async function compteurs(utilisateurId, espace = null) {
  const acteur = { type: 'utilisateur', id: utilisateurId, espace };
  const [base, conversations] = await Promise.all([
    espaceRepository.compteurs(utilisateurId),
    conversationService.nonLus(acteur).then((r) => r.total),
  ]);
  return { ...base, messages: conversations };
}
