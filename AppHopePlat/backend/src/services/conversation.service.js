/**
 * Service de la messagerie.
 *
 * Il ne raisonne que sur un "acteur" -- { type: 'utilisateur' | 'admin',
 * id } -- etabli par le verrou de l'espace d'ou vient la demande, jamais
 * par le corps de la requete.
 *
 * Une regle domine toutes les autres : la participation seule donne
 * acces a un fil, a ses messages et a ses pieces. Un fil auquel on ne
 * participe pas repond "introuvable", et non "interdit" -- repondre
 * "interdit" confirmerait qu'il existe.
 */
import { transaction } from '../config/database.js';
import { config } from '../config/env.js';
import * as conversationRepository from '../repositories/conversation.repository.js';
import * as pieceJointe from './pieceJointe.service.js';
import { ErreurIntrouvable, ErreurRegleMetier, ErreurValidation } from '../shared/errors.js';

/** Longueur maximale d'un message. */
export const CORPS_MAX = 4000;

/** Libelles des roles de l'equipe, comme ailleurs dans l'administration. */
const ROLES_EQUIPE = { ADMIN: 'Administrateur', COORDINATOR: 'Coordinateur', VIEWER: 'Lecture seule' };

/** Libelles des roles d'utilisateur. */
const ROLES = { bailleur: 'Bailleur', benevole: 'Bénévole', donateur: 'Donateur' };

/** Le nom sous lequel l'equipe apparait a un utilisateur. */
export const NOM_EQUIPE = 'Équipe HOPE';

/* ================================================================
   Outils
   ================================================================ */

/** Deux acteurs designent-ils la meme personne ? */
export function memeActeur(a, b) {
  return Boolean(a && b) && a.type === b.type && String(a.id) === String(b.id);
}

/**
 * Un identifiant de base rendu en nombre.
 *
 * Les colonnes BIGSERIAL arrivent de pg sous forme de texte ("27") : le
 * client, qui les compare a Number(?t=), ne retrouverait jamais le fil.
 * Nos volumes restent tres loin de la limite des entiers surs.
 */
const nombre = (valeur) => (valeur === null || valeur === undefined ? null : Number(valeur));

/**
 * Les pieces d'un message, telles qu'un acteur les recoit.
 *
 * Chacune porte son adresse de lecture, signee pour cet acteur : une
 * adresse copiee et ouverte par quelqu'un d'autre ne mene nulle part.
 */
const pieces = (liste, acteur) =>
  (liste ?? []).map((piece) => ({
    id: nombre(piece.id),
    nom: piece.nom,
    type: piece.type,
    typeMime: piece.typeMime,
    taille: piece.taille,
    url: acteur ? pieceJointe.adresseSignee('piece', piece.id, acteur) : null,
  }));

/** Un identifiant de fil ou de message : entier positif, sinon introuvable. */
function identifiant(valeur, quoi) {
  const nombre = Number(valeur);
  if (!Number.isSafeInteger(nombre) || nombre <= 0) throw new ErreurIntrouvable(quoi, valeur);
  return nombre;
}

/** Un UUID bien forme -- sans quoi PostgreSQL leverait une erreur de syntaxe. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lit la designation d'une personne venue du client.
 *
 * @returns {{type: string, id: string|number}}
 */
export function acteurValide(valeur, champ = 'cible') {
  const type = String(valeur?.type ?? '').trim();
  const id = String(valeur?.id ?? '').trim();

  if (type === 'admin' && /^\d+$/.test(id)) return { type, id: Number(id) };
  if (type === 'utilisateur' && UUID.test(id)) return { type, id };
  if (type === 'equipe') return { type, id: 'equipe' };

  throw new ErreurValidation('Destinataire invalide.', { [champ]: 'Valeur non acceptée' });
}

/** Verifie un texte de message. Vide accepte : les pieces peuvent suffire. */
export function corpsValide(valeur) {
  const corps = String(valeur ?? '').replace(/\r\n/g, '\n').trim();
  if (corps.length > CORPS_MAX) {
    throw new ErreurValidation('Le message est trop long.', {
      corps: `${CORPS_MAX} caractères au maximum`,
    });
  }
  return corps;
}

/** Le sous-titre d'une personne : organisation · fonction, ou son role. */
export function sousTitre(personne) {
  if (!personne) return '';
  if (personne.role === 'equipe') {
    return [NOM_EQUIPE, ROLES_EQUIPE[personne.roleEquipe]].filter(Boolean).join(' · ');
  }
  if (personne.role === 'bailleur') {
    const morceaux = [personne.entreprise, personne.fonction].filter(Boolean);
    return morceaux.length > 0 ? morceaux.join(' · ') : ROLES.bailleur;
  }
  if (personne.role === 'benevole') {
    return [ROLES.benevole, personne.fonction].filter(Boolean).join(' · ');
  }
  return ROLES[personne.role] ?? 'Membre';
}

/** Ce qu'une personne montre d'elle dans une liste. */
function resume(personne) {
  return {
    type: personne.type,
    id: String(personne.id),
    nom: personne.nom,
    prenom: personne.prenom,
    photoUrl: personne.photoUrl ?? null,
    role: personne.role,
    sousTitre: sousTitre(personne),
    entreprise: personne.entreprise ?? null,
    entrepriseId: personne.entrepriseId ?? null,
  };
}

/**
 * Comment un fil se presente a celui qui le regarde.
 *
 * - individuel : chacun voit l'autre personne ;
 * - assistance : l'utilisateur voit l'equipe, l'equipe voit l'utilisateur ;
 * - groupe : son nom et le nombre de participants.
 */
export function presenter(fil, acteur) {
  const participants = fil.participants ?? [];
  const autres = participants.filter((p) => !memeActeur(p, acteur));

  if (fil.type === 'groupe') {
    return {
      nom: fil.nom,
      sousTitre: `${participants.length} participant${participants.length > 1 ? 's' : ''}`,
      photoUrl: null,
      // Une photo privee, comme les pieces : son adresse est signee.
      photoSrc: fil.photoFichier ? pieceJointe.adresseSignee('groupe', fil.id, acteur) : null,
      interlocuteur: null,
    };
  }

  if (fil.assistance) {
    if (acteur.type === 'utilisateur') {
      return { nom: NOM_EQUIPE, sousTitre: 'Assistance', photoUrl: null, interlocuteur: null, equipe: true };
    }
    const utilisateur = participants.find((p) => p.type === 'utilisateur');
    if (!utilisateur) {
      return { nom: 'Compte supprimé', sousTitre: 'Assistance', photoUrl: null, interlocuteur: null };
    }
    return {
      nom: utilisateur.nom,
      sousTitre: [sousTitre(utilisateur), 'Assistance'].filter(Boolean).join(' · '),
      photoUrl: utilisateur.photoUrl ?? null,
      interlocuteur: resume(utilisateur),
    };
  }

  const autre = autres[0];
  if (!autre) {
    // L'autre personne a quitte ou son compte a disparu.
    return { nom: 'Compte supprimé', sousTitre: '', photoUrl: null, interlocuteur: null };
  }
  return {
    nom: autre.nom,
    sousTitre: sousTitre(autre),
    photoUrl: autre.photoUrl ?? null,
    interlocuteur: resume(autre),
  };
}

/** Un message, tel que le client le recoit. */
export function presenterMessage(message, acteur) {
  const supprime = Boolean(message.supprimeLe);
  return {
    id: nombre(message.id),
    texte: supprime ? '' : message.corps,
    creeLe: message.creeLe,
    modifieLe: message.modifieLe ?? null,
    supprime,
    transfere: Boolean(message.transfere),
    auteur: {
      type: message.auteurType,
      id: message.auteurId,
      nom: message.auteurNom,
      photoUrl: message.auteurPhoto ?? null,
    },
    estDeMoi: memeActeur({ type: message.auteurType, id: message.auteurId }, acteur),
    pieces: supprime ? [] : pieces(message.pieces, acteur),
  };
}

/**
 * Charge un fil et verifie que l'acteur y participe.
 *
 * La seule porte d'entree : toutes les actions sur un fil passent par
 * ici avant de toucher a quoi que ce soit.
 */
export async function filAccessible(acteur, id, client = null) {
  const conversationId = identifiant(id, 'La conversation');
  const participe = await conversationRepository.estParticipant(acteur, conversationId, client);
  if (!participe) throw new ErreurIntrouvable('La conversation', id);

  const fil = await conversationRepository.trouver(conversationId, client);
  if (!fil) throw new ErreurIntrouvable('La conversation', id);
  return fil;
}

/** Le nom qu'un acteur signe : copie dans chaque message qu'il ecrit. */
export async function nomDe(acteur, client = null) {
  const personne = await conversationRepository.personne(acteur, client);
  return personne?.nom ?? 'Compte supprimé';
}

/* ================================================================
   Lecture
   ================================================================ */

/** Les fils de l'acteur, et le total de ses non-lus. */
export async function lister(acteur) {
  // L'equipe voit tous les fils d'assistance : elle y est inscrite ici si
  // un compte d'administrateur a ete cree depuis.
  if (acteur.type === 'admin') await conversationRepository.rattacherEquipeAuxAssistances();

  const fils = await conversationRepository.lister(acteur);
  const items = fils.map((fil) => ({
    id: nombre(fil.id),
    type: fil.type,
    assistance: fil.assistance,
    ...presenter(fil, acteur),
    creeLe: fil.creeLe,
    derniereActivite: fil.derniereActivite,
    nonLus: fil.nonLus,
    dernier: fil.dernier
      ? {
          ...fil.dernier,
          id: nombre(fil.dernier.id),
          estDeMoi: memeActeur({ type: fil.dernier.auteurType, id: fil.dernier.auteurId }, acteur),
          corps: fil.dernier.supprime ? '' : fil.dernier.corps,
          pieces: fil.dernier.supprime ? [] : pieces(fil.dernier.pieces, null),
        }
      : null,
  }));

  return { items, nonLus: items.reduce((total, fil) => total + fil.nonLus, 0) };
}

/**
 * Un fil et ses messages.
 *
 * L'ouvrir ne le marque PAS lu : c'est le navigateur qui le dit, une
 * fois le fil affiche. Un prechargement, ou un telephone qui choisit un
 * fil par defaut sans le montrer, ne doit rien marquer.
 */
export async function recuperer(acteur, id) {
  const fil = await filAccessible(acteur, id);
  const [liste, luLe] = await Promise.all([
    conversationRepository.messages(fil.id),
    conversationRepository.luLe(acteur, fil.id),
  ]);

  return {
    conversation: {
      id: nombre(fil.id),
      type: fil.type,
      assistance: fil.assistance,
      creeLe: fil.creeLe,
      luLe,
      ...presenter(fil, acteur),
      participants: (fil.participants ?? []).map((p) => ({
        ...resume(p),
        fonction: p.fonction ?? null,
        email: p.email ?? null,
        telephone: p.telephone ?? null,
        siteWeb: p.siteWeb ?? null,
        ajouteLe: p.ajouteLe,
        estMoi: memeActeur(p, acteur),
      })),
    },
    messages: liste.map((message) => presenterMessage(message, acteur)),
    // Dans un fil d'assistance, l'utilisateur voit l'equipe : ses
    // coordonnees sont celles de la configuration, si elle en donne.
    equipe:
      fil.assistance && acteur.type === 'utilisateur'
        ? {
            nom: NOM_EQUIPE,
            email: config.equipe.email || null,
            telephone: config.equipe.telephone || null,
            siteWeb: config.equipe.siteWeb || null,
          }
        : null,
  };
}

/**
 * Les fichiers partages d'un fil, du plus recent au plus ancien.
 *
 * Les pieces d'un message supprime n'existent plus : la table ne les
 * rend pas. Chaque piece porte son adresse signee pour cet acteur.
 */
export async function fichiersPartages(acteur, id) {
  const fil = await filAccessible(acteur, id);
  const liste = await conversationRepository.piecesDuFil(fil.id);
  return {
    items: liste.map((piece) => ({
      id: nombre(piece.id),
      nom: piece.nom,
      type: piece.type,
      taille: piece.taille,
      messageId: nombre(piece.messageId),
      creeLe: piece.creeLe,
      auteurNom: piece.auteurNom,
      url: pieceJointe.adresseSignee('piece', piece.id, acteur),
    })),
  };
}

/**
 * Marque un fil lu, jusqu'au dernier message affiche.
 *
 * Le message designe doit appartenir au fil : le depot l'impose, et un
 * identifiant etranger revient a "maintenant".
 */
export async function marquerLu(acteur, id, corps = {}) {
  const fil = await filAccessible(acteur, id);

  let messageId = null;
  if (corps.jusquAuMessage !== undefined && corps.jusquAuMessage !== null) {
    messageId = Number(corps.jusquAuMessage);
    if (!Number.isSafeInteger(messageId) || messageId <= 0) {
      throw new ErreurValidation('Message invalide.', { jusquAuMessage: 'Identifiant attendu' });
    }
  }

  await conversationRepository.marquerLu(acteur, fil.id, messageId);
  const reste = await conversationRepository.nonLus(acteur);
  return { id: nombre(fil.id), total: reste.total, dernierFil: nombre(reste.dernierFil) };
}

/** Le total des non-lus et le fil du plus recent : la pastille et la notification. */
export async function nonLus(acteur) {
  const { total, dernierFil } = await conversationRepository.nonLus(acteur);
  return { total, dernierFil: nombre(dernierFil) };
}

/**
 * Les personnes joignables.
 *
 * Chacune dit si un echange individuel existe deja avec elle : la
 * recherche ne propose sous "Nouvelle conversation" que celles avec qui
 * rien n'existe encore.
 */
export async function joignables(acteur) {
  const [personnes, fils] = await Promise.all([
    conversationRepository.joignables(acteur),
    conversationRepository.lister(acteur),
  ]);

  // Qui a deja un fil a deux avec moi : l'autre d'un individuel, ou
  // l'utilisateur d'un fil d'assistance vu depuis l'equipe.
  const dejaJoints = new Map();
  let filEquipe = null;
  for (const fil of fils) {
    if (fil.type !== 'individuel') continue;
    if (fil.assistance && acteur.type === 'utilisateur') {
      // La liste est triee par activite : le premier est le plus recent.
      filEquipe ??= fil.id;
      continue;
    }
    const autre = fil.assistance
      ? fil.participants.find((p) => p.type === 'utilisateur')
      : fil.participants.find((p) => !memeActeur(p, acteur));
    if (autre) dejaJoints.set(`${autre.type}:${autre.id}`, fil.id);
  }

  const items = personnes.map((personne) => ({
    ...resume(personne),
    filId: nombre(dejaJoints.get(`${personne.type}:${personne.id}`) ?? null),
  }));

  if (acteur.type === 'utilisateur') {
    items.unshift({
      type: 'equipe',
      id: 'equipe',
      nom: NOM_EQUIPE,
      prenom: NOM_EQUIPE,
      photoUrl: null,
      role: 'equipe',
      sousTitre: 'Assistance',
      entreprise: null,
      entrepriseId: null,
      filId: nombre(filEquipe),
    });
  }

  return { items };
}

/* ================================================================
   Retrouver ou creer
   ================================================================ */

/**
 * Le fil avec une personne : retrouve, ou cree.
 *
 * - un utilisateur qui vise l'equipe, ou l'equipe qui vise un
 *   utilisateur : le fil d'assistance de cet utilisateur ;
 * - deux utilisateurs, ou deux membres de l'equipe : un fil individuel.
 *
 * Un verrou par paire met en file deux demandes simultanees : la seconde
 * trouve ce que la premiere a cree, au lieu d'en creer un double.
 *
 * @returns {Promise<{id: number, cree: boolean}>}
 */
export async function filAvec(acteur, cible, client) {
  if (memeActeur(acteur, cible)) {
    throw new ErreurValidation('On ne s’écrit pas à soi-même.', { cible: 'Choisissez quelqu’un d’autre' });
  }

  // L'assistance : un utilisateur face a l'equipe.
  const utilisateurDAssistance =
    acteur.type === 'utilisateur' && cible.type === 'equipe'
      ? acteur
      : acteur.type === 'admin' && cible.type === 'utilisateur'
        ? cible
        : null;

  if (cible.type === 'equipe' && acteur.type !== 'utilisateur') {
    throw new ErreurValidation('Destinataire invalide.', { cible: 'Valeur non acceptée' });
  }

  if (utilisateurDAssistance) {
    await conversationRepository.verrouiller(`assistance:${utilisateurDAssistance.id}`, client);
    const existant = await conversationRepository.trouverAssistance(utilisateurDAssistance.id, client);
    if (existant) {
      if (acteur.type === 'admin') await conversationRepository.ajouterParticipants(existant, [acteur], null, client);
      return { id: nombre(existant), cree: false };
    }

    const id = await conversationRepository.creerFil({ assistance: true }, client);
    const equipe = await conversationRepository.equipeActive(client);
    await conversationRepository.ajouterParticipants(id, [utilisateurDAssistance, ...equipe], null, client);
    // Celui qui ouvre le fil depuis l'equipe y figure, meme s'il n'est pas
    // compte parmi les actifs au moment precis de la creation.
    if (acteur.type === 'admin') await conversationRepository.ajouterParticipants(id, [acteur], null, client);
    return { id: nombre(id), cree: true };
  }

  // Deux personnes du meme cote : un fil individuel.
  const cle = [`${acteur.type}:${acteur.id}`, `${cible.type}:${cible.id}`].sort().join('|');
  await conversationRepository.verrouiller(`individuel:${cle}`, client);

  const existant = await conversationRepository.trouverIndividuel(acteur, cible, client);
  if (existant) return { id: nombre(existant), cree: false };

  const id = await conversationRepository.creerFil({}, client);
  await conversationRepository.ajouterParticipants(id, [acteur, cible], null, client);
  return { id: nombre(id), cree: true };
}

/**
 * La cible est-elle joignable par cet acteur ?
 *
 * Proposer une personne dans l'annuaire ne suffit pas : la requete peut
 * viser n'importe quel identifiant. On revérifie donc ici.
 */
export async function verifierJoignable(acteur, cible, client = null) {
  if (cible.type === 'equipe') {
    if (acteur.type !== 'utilisateur') {
      throw new ErreurValidation('Destinataire invalide.', { cible: 'Valeur non acceptée' });
    }
    return;
  }

  const personnes = await conversationRepository.joignables(acteur, client);
  const trouve = personnes.some((p) => p.type === cible.type && String(p.id) === String(cible.id));
  if (!trouve) throw new ErreurIntrouvable('La personne', cible.id);
}

/** Ouvre le fil avec une personne, ou retrouve celui qui existe. */
export async function ouvrir(acteur, corps = {}) {
  const cible = acteurValide(corps.cible);
  await verifierJoignable(acteur, cible);

  return transaction((client) => filAvec(acteur, cible, client));
}

/* ================================================================
   Ecriture
   ================================================================ */

/**
 * Envoie un message dans un fil dont on fait partie, pieces comprises.
 *
 * L'ordre compte :
 * 1. l'acces et le texte sont verifies ;
 * 2. toutes les pieces sont analysees et preparees, sans rien ecrire ;
 * 3. les fichiers sont ecrits ;
 * 4. le message et ses pieces entrent en base, d'un seul tenant.
 * Un refus aux etapes 1 et 2 ne laisse aucune trace ; un echec a l'etape
 * 4 efface les fichiers de l'etape 3.
 *
 * Ecrire vaut lecture : ce qu'on vient de dire, et tout ce qui precedait,
 * est lu par son auteur.
 */
export async function envoyer(acteur, id, corps = {}, fichiers = []) {
  const fil = await filAccessible(acteur, id);
  const texte = corpsValide(corps.corps);
  if (texte === '' && fichiers.length === 0) {
    throw new ErreurValidation('Le message est vide.', { corps: 'Écrivez un message ou joignez un fichier' });
  }

  const prets = await pieceJointe.preparer(fichiers);
  const ecrites = await pieceJointe.ecrire(prets);

  let message;
  try {
    message = await transaction(async (client) => {
      const cree = await conversationRepository.ajouterMessage(
        { conversationId: fil.id, acteur, auteurNom: await nomDe(acteur, client), corps: texte },
        client
      );
      await conversationRepository.ajouterPieces(cree.id, ecrites, client);
      await conversationRepository.marquerLu(acteur, fil.id, cree.id, client);
      return cree;
    });
  } catch (erreur) {
    await pieceJointe.effacer(ecrites.map((piece) => piece.fichier));
    throw erreur;
  }

  const complet = await conversationRepository.trouverMessage(message.id);
  return presenterMessage(complet, acteur);
}

/**
 * Une piece jointe, pour la servir a un acteur.
 *
 * Tout refus -- piece inconnue, message supprime, acteur absent du fil --
 * repond "introuvable" : la reponse ne doit pas dire si le fichier existe.
 */
export async function pieceLisible(acteur, pieceId) {
  const numero = Number(pieceId);
  if (!Number.isSafeInteger(numero) || numero <= 0) throw new ErreurIntrouvable('Le fichier', pieceId);

  const piece = await conversationRepository.trouverPiece(numero);
  if (!piece || piece.supprimeLe) throw new ErreurIntrouvable('Le fichier', pieceId);

  const participe = await conversationRepository.estParticipant(acteur, piece.conversationId);
  if (!participe) throw new ErreurIntrouvable('Le fichier', pieceId);

  return piece;
}

/* ================================================================
   Modifier, supprimer, transferer
   ================================================================ */

/** Nombre de destinations d'un transfert. */
export const MAX_CIBLES_TRANSFERT = 10;

/**
 * Charge un message d'un fil dont on fait partie.
 *
 * Le message doit appartenir au fil de l'adresse : sans ce controle, un
 * identifiant de message pris ailleurs passerait par un fil ou l'on est.
 */
async function messageAccessible(acteur, filId, messageId) {
  const fil = await filAccessible(acteur, filId);
  const numero = Number(messageId);
  if (!Number.isSafeInteger(numero) || numero <= 0) throw new ErreurIntrouvable('Le message', messageId);

  const message = await conversationRepository.trouverMessage(numero);
  if (!message || Number(message.conversationId) !== Number(fil.id)) {
    throw new ErreurIntrouvable('Le message', messageId);
  }
  return { fil, message };
}

/** Seul l'auteur modifie ou supprime son message. */
function exigerAuteur(acteur, message) {
  if (!memeActeur({ type: message.auteurType, id: message.auteurId }, acteur)) {
    throw new ErreurRegleMetier('Seul l’auteur peut modifier ou supprimer ce message.', 'PAS_AUTEUR');
  }
}

/**
 * Modifie le texte d'un message.
 *
 * - auteur seulement, et jamais un message supprime ;
 * - un message sans piece jointe ne peut pas etre vide : c'est une
 *   suppression, qui a son propre geste ;
 * - un texte inchange n'enregistre rien -- sans quoi "modifie"
 *   s'afficherait sur un message que personne n'a change.
 */
export async function modifier(acteur, filId, messageId, corps = {}) {
  const { message } = await messageAccessible(acteur, filId, messageId);
  exigerAuteur(acteur, message);
  if (message.supprimeLe) {
    throw new ErreurRegleMetier('Ce message a été supprimé.', 'MESSAGE_SUPPRIME');
  }

  const texte = corpsValide(corps.corps);
  if (texte === '' && (message.pieces ?? []).length === 0) {
    throw new ErreurValidation('Un message sans pièce jointe ne peut pas être vide : supprimez-le plutôt.', {
      corps: 'Texte obligatoire',
    });
  }

  if (texte !== message.corps) {
    await conversationRepository.modifierMessage(message.id, texte);
  }
  const complet = await conversationRepository.trouverMessage(message.id);
  return presenterMessage(complet, acteur);
}

/**
 * Supprime un message, pour tous les participants.
 *
 * Suppression logique dans une transaction -- texte vide, date posee,
 * lignes de pieces retirees -- puis effacement des fichiers, une fois la
 * base a jour : un echec en cours de route ne laisse jamais une ligne
 * pointer vers un fichier deja efface.
 */
export async function supprimer(acteur, filId, messageId) {
  const { message } = await messageAccessible(acteur, filId, messageId);
  exigerAuteur(acteur, message);
  if (message.supprimeLe) {
    const deja = await conversationRepository.trouverMessage(message.id);
    return presenterMessage(deja, acteur);
  }

  const fichiers = await transaction((client) => conversationRepository.supprimerMessage(message.id, client));
  await pieceJointe.effacer(fichiers);

  const complet = await conversationRepository.trouverMessage(message.id);
  return presenterMessage(complet, acteur);
}

/**
 * Lit la liste des destinations d'un transfert.
 *
 * Deux formes : { type: 'fil', id } pour un fil existant, ou une personne
 * -- { type: 'utilisateur' | 'admin' | 'equipe', id }. Les doublons sont
 * retires ici ; ceux qui ne se revelent qu'une fois les fils resolus --
 * une personne et le fil qu'on a deja avec elle -- le seront plus loin.
 */
function ciblesValides(valeur) {
  if (!Array.isArray(valeur) || valeur.length === 0) {
    throw new ErreurValidation('Choisissez au moins une destination.', { cibles: 'Au moins une' });
  }

  const vues = new Set();
  const cibles = [];
  for (const brute of valeur) {
    const cible = brute?.type === 'fil'
      ? { type: 'fil', id: Number(brute.id) }
      : acteurValide(brute, 'cibles');
    if (cible.type === 'fil' && (!Number.isSafeInteger(cible.id) || cible.id <= 0)) {
      throw new ErreurValidation('Destination invalide.', { cibles: 'Valeur non acceptée' });
    }
    const cle = `${cible.type}:${cible.id}`;
    if (!vues.has(cle)) {
      vues.add(cle);
      cibles.push(cible);
    }
  }

  if (cibles.length > MAX_CIBLES_TRANSFERT) {
    throw new ErreurValidation(`${MAX_CIBLES_TRANSFERT} destinations au plus.`, { cibles: 'Trop de destinations' });
  }
  return cibles;
}

/**
 * Transfere un message vers des fils ou des personnes.
 *
 * Tout est reverifie : la participation au fil source, un message non
 * supprime, la participation a chaque fil vise, et que chaque personne
 * visee soit joignable -- son fil individuel est retrouve, ou cree.
 *
 * Le message est recopie sous le nom de celui qui transfere, marque
 * "transfere", et ses pieces sont dupliquees sur le disque : supprimer
 * l'original ne doit pas vider la copie.
 *
 * @returns {Promise<{fils: number[]}>} les fils ou le message est arrive
 */
export async function transferer(acteur, filId, messageId, corps = {}) {
  const { message } = await messageAccessible(acteur, filId, messageId);
  if (message.supprimeLe) {
    throw new ErreurRegleMetier('Un message supprimé ne peut pas être transféré.', 'MESSAGE_SUPPRIME');
  }
  const cibles = ciblesValides(corps.cibles);

  // Verifications prealables, hors transaction : un refus ne cree rien.
  for (const cible of cibles) {
    if (cible.type === 'fil') {
      const participe = await conversationRepository.estParticipant(acteur, cible.id);
      if (!participe) throw new ErreurIntrouvable('La conversation', cible.id);
    } else {
      await verifierJoignable(acteur, cible);
    }
  }

  const pieces = await conversationRepository.piecesAvecFichiers(message.id);
  const auteurNom = await nomDe(acteur);
  const copiesEcrites = [];

  try {
    const fils = await transaction(async (client) => {
      // Les fils de destination, dedoublonnes une fois resolus.
      const destinations = [];
      for (const cible of cibles) {
        const id = cible.type === 'fil' ? cible.id : (await filAvec(acteur, cible, client)).id;
        if (!destinations.includes(Number(id))) destinations.push(Number(id));
      }

      for (const destination of destinations) {
        const copie = await conversationRepository.ajouterMessage(
          { conversationId: destination, acteur, auteurNom, corps: message.corps, transfere: true },
          client
        );
        if (pieces.length > 0) {
          const dupliquees = await pieceJointe.dupliquer(
            pieces.map((piece) => ({
              nomOrigine: piece.nomOrigine,
              type: piece.type,
              typeMime: piece.typeMime,
              fichier: piece.fichier,
              taille: piece.taille,
            }))
          );
          copiesEcrites.push(...dupliquees.map((piece) => piece.fichier));
          await conversationRepository.ajouterPieces(copie.id, dupliquees, client);
        }
        // Transferer vaut lecture, pour celui qui transfere.
        await conversationRepository.marquerLu(acteur, destination, copie.id, client);
      }
      return destinations;
    });
    return { fils };
  } catch (erreur) {
    await pieceJointe.effacer(copiesEcrites);
    throw erreur;
  }
}

/* ================================================================
   Groupes
   ================================================================ */

/** Longueur maximale du nom d'un groupe. */
export const NOM_GROUPE_MAX = 80;

/** Nombre de participants d'un groupe, createur compris. */
export const MAX_PARTICIPANTS = 50;

/**
 * Lit une liste de participants venue du client.
 *
 * Elle arrive en JSON dans un formulaire multipart -- la photo voyage avec
 * elle --, ou directement en tableau. L'equipe en bloc n'est pas une
 * personne : elle ne se met pas dans un groupe.
 */
function participantsValides(valeur) {
  let liste = valeur;
  if (typeof valeur === 'string') {
    try {
      liste = JSON.parse(valeur);
    } catch {
      liste = null;
    }
  }
  if (!Array.isArray(liste)) {
    throw new ErreurValidation('Participants invalides.', { participants: 'Liste attendue' });
  }

  const vus = new Set();
  const acteurs = [];
  for (const brut of liste) {
    const acteur = acteurValide(brut, 'participants');
    if (acteur.type === 'equipe') {
      throw new ErreurValidation('Ajoutez des personnes, pas l’équipe en bloc.', { participants: 'Valeur non acceptée' });
    }
    const cle = `${acteur.type}:${acteur.id}`;
    if (!vus.has(cle)) {
      vus.add(cle);
      acteurs.push(acteur);
    }
  }
  return acteurs;
}

/** Chaque personne doit etre joignable par l'acteur. */
async function verifierTousJoignables(acteur, personnes) {
  const joignables = await conversationRepository.joignables(acteur);
  const cles = new Set(joignables.map((p) => `${p.type}:${p.id}`));
  for (const personne of personnes) {
    if (!cles.has(`${personne.type}:${personne.id}`)) throw new ErreurIntrouvable('La personne', personne.id);
  }
}

/**
 * Cree un groupe.
 *
 * Un nom (80 caracteres au plus), une photo facultative, au moins une autre
 * personne et 50 participants au plus, createur compris. Le createur y
 * arrive a jour : son propre groupe n'a rien de non lu pour lui.
 *
 * @returns {Promise<{id: number}>}
 */
export async function creerGroupe(acteur, corps = {}, photo = null) {
  const nom = String(corps.nom ?? '').replace(/\s+/g, ' ').trim();
  if (nom === '') throw new ErreurValidation('Donnez un nom au groupe.', { nom: 'Champ obligatoire' });
  if (nom.length > NOM_GROUPE_MAX) {
    throw new ErreurValidation(`Le nom fait ${NOM_GROUPE_MAX} caractères au plus.`, { nom: 'Trop long' });
  }

  const autres = participantsValides(corps.participants).filter((p) => !memeActeur(p, acteur));
  if (autres.length === 0) {
    throw new ErreurValidation('Ajoutez au moins une autre personne.', { participants: 'Au moins une' });
  }
  if (autres.length + 1 > MAX_PARTICIPANTS) {
    throw new ErreurValidation(`Un groupe réunit ${MAX_PARTICIPANTS} participants au plus.`, { participants: 'Trop de participants' });
  }
  await verifierTousJoignables(acteur, autres);

  // La photo est preparee avant toute ecriture ; un refus ne cree rien.
  const photoPrete = photo ? await pieceJointe.preparerPhotoGroupe(photo) : null;
  const [photoEcrite] = photoPrete
    ? await pieceJointe.ecrire([{ nomOrigine: 'photo.jpg', type: 'image', typeMime: 'image/jpeg', extension: '.jpg', contenu: photoPrete.contenu }])
    : [null];

  try {
    const id = await transaction(async (client) => {
      const nouveau = await conversationRepository.creerFil(
        { type: 'groupe', nom, photoFichier: photoEcrite?.fichier ?? null },
        client
      );
      await conversationRepository.ajouterParticipants(nouveau, [acteur], new Date(), client);
      await conversationRepository.ajouterParticipants(nouveau, autres, null, client);
      return nouveau;
    });
    return { id: nombre(id) };
  } catch (erreur) {
    if (photoEcrite) await pieceJointe.effacer([photoEcrite.fichier]);
    throw erreur;
  }
}

/** Charge un groupe dont l'acteur fait partie. */
async function groupeAccessible(acteur, id) {
  const fil = await filAccessible(acteur, id);
  if (fil.type !== 'groupe') {
    throw new ErreurRegleMetier('Cette action ne concerne que les groupes.', 'PAS_UN_GROUPE');
  }
  return fil;
}

/**
 * Ajoute des participants a un groupe.
 *
 * Reserve aux participants du groupe. Ceux qui y sont deja sont ignores ;
 * le plafond compte ceux qui restent a ajouter.
 *
 * @returns {Promise<{ajoutes: number}>}
 */
export async function ajouterAuGroupe(acteur, id, corps = {}) {
  const fil = await groupeAccessible(acteur, id);
  const presents = new Set((fil.participants ?? []).map((p) => `${p.type}:${p.id}`));
  const nouveaux = participantsValides(corps.participants).filter((p) => !presents.has(`${p.type}:${p.id}`));

  if (nouveaux.length === 0) return { ajoutes: 0 };
  if (presents.size + nouveaux.length > MAX_PARTICIPANTS) {
    throw new ErreurValidation(
      `Un groupe réunit ${MAX_PARTICIPANTS} participants au plus : il reste ${Math.max(0, MAX_PARTICIPANTS - presents.size)} place(s).`,
      { participants: 'Trop de participants' }
    );
  }
  await verifierTousJoignables(acteur, nouveaux);

  const ajoutes = await transaction((client) =>
    conversationRepository.ajouterParticipants(fil.id, nouveaux, null, client)
  );
  return { ajoutes };
}

/**
 * Quitte un groupe.
 *
 * Les messages de la personne restent : ce qu'elle a dit fait partie de
 * la conversation des autres. Si plus personne ne participe, le groupe
 * disparait, avec ses messages et ses fichiers.
 *
 * @returns {Promise<{supprime: boolean}>}
 */
export async function quitterGroupe(acteur, id) {
  const fil = await groupeAccessible(acteur, id);

  const { reste, fichiers } = await transaction(async (client) => {
    const restants = await conversationRepository.retirerParticipant(acteur, fil.id, client);
    if (restants > 0) return { reste: restants, fichiers: [] };
    return { reste: 0, fichiers: await conversationRepository.supprimerFil(fil.id, client) };
  });

  if (fichiers.length > 0) await pieceJointe.effacer(fichiers);
  return { supprime: reste === 0 };
}

/** La photo d'un groupe, pour un acteur qui y participe. */
export async function photoDeGroupe(acteur, id) {
  const fil = await filAccessible(acteur, id);
  if (fil.type !== 'groupe' || !fil.photoFichier) throw new ErreurIntrouvable('La photo', id);
  return fil.photoFichier;
}
