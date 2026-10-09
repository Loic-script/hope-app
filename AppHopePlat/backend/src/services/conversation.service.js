import { transaction } from '../config/database.js';
import { config } from '../config/env.js';
import * as conversationRepository from '../repositories/conversation.repository.js';
import * as pieceJointe from './pieceJointe.service.js';
import { ErreurIntrouvable, ErreurRegleMetier, ErreurValidation } from '../shared/errors.js';

export const CORPS_MAX = 4000;

const ROLES_EQUIPE = { ADMIN: 'Administrateur', COORDINATOR: 'Coordinateur', VIEWER: 'Lecture seule' };

const ROLES = { bailleur: 'Bailleur', benevole: 'Bénévole', donateur: 'Donateur' };

export const NOM_EQUIPE = 'Équipe HOPE';

export function memeActeur(a, b) {
  return Boolean(a && b) && a.type === b.type && String(a.id) === String(b.id);
}

const nombre = (valeur) => (valeur === null || valeur === undefined ? null : Number(valeur));

const pieces = (liste, acteur) =>
  (liste ?? []).map((piece) => ({
    id: nombre(piece.id),
    nom: piece.nom,
    type: piece.type,
    typeMime: piece.typeMime,
    taille: piece.taille,
    url: acteur ? pieceJointe.adresseSignee('piece', piece.id, acteur) : null,
  }));

function identifiant(valeur, quoi) {
  const nombre = Number(valeur);
  if (!Number.isSafeInteger(nombre) || nombre <= 0) throw new ErreurIntrouvable(quoi, valeur);
  return nombre;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function acteurValide(valeur, champ = 'cible') {
  const type = String(valeur?.type ?? '').trim();
  const id = String(valeur?.id ?? '').trim();

  if (type === 'admin' && /^\d+$/.test(id)) return { type, id: Number(id) };
  if (type === 'utilisateur' && UUID.test(id)) return { type, id };
  if (type === 'equipe') return { type, id: 'equipe' };

  throw new ErreurValidation('Destinataire invalide.', { [champ]: 'Valeur non acceptée' });
}

export function corpsValide(valeur) {
  const corps = String(valeur ?? '').replace(/\r\n/g, '\n').trim();
  if (corps.length > CORPS_MAX) {
    throw new ErreurValidation('Le message est trop long.', {
      corps: `${CORPS_MAX} caractères au maximum`,
    });
  }
  return corps;
}

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

export function presenter(fil, acteur) {
  const participants = fil.participants ?? [];
  const autres = participants.filter((p) => !memeActeur(p, acteur));

  if (fil.type === 'groupe') {
    return {
      nom: fil.nom,
      sousTitre: `${participants.length} participant${participants.length > 1 ? 's' : ''}`,
      photoUrl: null,
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
    return { nom: 'Compte supprimé', sousTitre: '', photoUrl: null, interlocuteur: null };
  }
  return {
    nom: autre.nom,
    sousTitre: sousTitre(autre),
    photoUrl: autre.photoUrl ?? null,
    interlocuteur: resume(autre),
  };
}

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

async function clesJoignables(acteur, client = null) {
  const personnes = await conversationRepository.joignables(acteur, client);
  return new Set(personnes.map((p) => `${p.type}:${p.id}`));
}

function horsRegle(acteur, fil, cles) {
  if (acteur.type !== 'utilisateur' || fil.type !== 'individuel' || fil.assistance) return false;
  const autre = (fil.participants ?? []).find((p) => !memeActeur(p, acteur));
  return Boolean(autre) && !cles.has(`${autre.type}:${autre.id}`);
}

export async function filAccessible(acteur, id, client = null) {
  const conversationId = identifiant(id, 'La conversation');
  const participe = await conversationRepository.estParticipant(acteur, conversationId, client);
  if (!participe) throw new ErreurIntrouvable('La conversation', id);

  const fil = await conversationRepository.trouver(conversationId, client);
  if (!fil) throw new ErreurIntrouvable('La conversation', id);
  if (acteur.type === 'utilisateur' && horsRegle(acteur, fil, await clesJoignables(acteur, client))) {
    throw new ErreurIntrouvable('La conversation', id);
  }
  return fil;
}

export async function nomDe(acteur, client = null) {
  const personne = await conversationRepository.personne(acteur, client);
  return personne?.nom ?? 'Compte supprimé';
}

export async function lister(acteur) {
  if (acteur.type === 'admin') await conversationRepository.rattacherEquipeAuxAssistances();

  const cles = acteur.type === 'utilisateur' ? await clesJoignables(acteur) : null;
  const fils = (await conversationRepository.lister(acteur)).filter((fil) => !horsRegle(acteur, fil, cles));
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

export async function nonLus(acteur) {
  const { total, dernierFil } = await conversationRepository.nonLus(acteur, null, await filsHorsRegle(acteur));
  return { total, dernierFil: nombre(dernierFil) };
}

export async function filsHorsRegle(acteur) {
  if (acteur.type !== 'utilisateur') return [];
  const cles = await clesJoignables(acteur);
  const fils = await conversationRepository.lister(acteur);
  return fils.filter((fil) => horsRegle(acteur, fil, cles)).map((fil) => fil.id);
}

export async function joignables(acteur) {
  const [personnes, fils] = await Promise.all([
    conversationRepository.joignables(acteur),
    conversationRepository.lister(acteur),
  ]);

  const dejaJoints = new Map();
  let filEquipe = null;
  for (const fil of fils) {
    if (fil.type !== 'individuel') continue;
    if (fil.assistance && acteur.type === 'utilisateur') {
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

export async function filAvec(acteur, cible, client) {
  if (memeActeur(acteur, cible)) {
    throw new ErreurValidation('On ne s’écrit pas à soi-même.', { cible: 'Choisissez quelqu’un d’autre' });
  }

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
    if (acteur.type === 'admin') await conversationRepository.ajouterParticipants(id, [acteur], null, client);
    return { id: nombre(id), cree: true };
  }

  const cle = [`${acteur.type}:${acteur.id}`, `${cible.type}:${cible.id}`].sort().join('|');
  await conversationRepository.verrouiller(`individuel:${cle}`, client);

  const existant = await conversationRepository.trouverIndividuel(acteur, cible, client);
  if (existant) return { id: nombre(existant), cree: false };

  const id = await conversationRepository.creerFil({}, client);
  await conversationRepository.ajouterParticipants(id, [acteur, cible], null, client);
  return { id: nombre(id), cree: true };
}

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

export async function ouvrir(acteur, corps = {}) {
  const cible = acteurValide(corps.cible);
  await verifierJoignable(acteur, cible);

  return transaction((client) => filAvec(acteur, cible, client));
}

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

export async function pieceLisible(acteur, pieceId) {
  const numero = Number(pieceId);
  if (!Number.isSafeInteger(numero) || numero <= 0) throw new ErreurIntrouvable('Le fichier', pieceId);

  const piece = await conversationRepository.trouverPiece(numero);
  if (!piece || piece.supprimeLe) throw new ErreurIntrouvable('Le fichier', pieceId);

  try {
    await filAccessible(acteur, piece.conversationId);
  } catch {
    throw new ErreurIntrouvable('Le fichier', pieceId);
  }

  return piece;
}

export const MAX_CIBLES_TRANSFERT = 10;

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

function exigerAuteur(acteur, message) {
  if (!memeActeur({ type: message.auteurType, id: message.auteurId }, acteur)) {
    throw new ErreurRegleMetier('Seul l’auteur peut modifier ou supprimer ce message.', 'PAS_AUTEUR');
  }
}

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

export async function transferer(acteur, filId, messageId, corps = {}) {
  const { message } = await messageAccessible(acteur, filId, messageId);
  if (message.supprimeLe) {
    throw new ErreurRegleMetier('Un message supprimé ne peut pas être transféré.', 'MESSAGE_SUPPRIME');
  }
  const cibles = ciblesValides(corps.cibles);

  for (const cible of cibles) {
    if (cible.type === 'fil') {
      await filAccessible(acteur, cible.id);
    } else {
      await verifierJoignable(acteur, cible);
    }
  }

  const pieces = await conversationRepository.piecesAvecFichiers(message.id);
  const auteurNom = await nomDe(acteur);
  const copiesEcrites = [];

  try {
    const fils = await transaction(async (client) => {
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

export const NOM_GROUPE_MAX = 80;

export const MAX_PARTICIPANTS = 50;

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

async function verifierTousJoignables(acteur, personnes) {
  const joignables = await conversationRepository.joignables(acteur);
  const cles = new Set(joignables.map((p) => `${p.type}:${p.id}`));
  for (const personne of personnes) {
    if (!cles.has(`${personne.type}:${personne.id}`)) throw new ErreurIntrouvable('La personne', personne.id);
  }
}

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

async function groupeAccessible(acteur, id) {
  const fil = await filAccessible(acteur, id);
  if (fil.type !== 'groupe') {
    throw new ErreurRegleMetier('Cette action ne concerne que les groupes.', 'PAS_UN_GROUPE');
  }
  return fil;
}

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

export async function photoDeGroupe(acteur, id) {
  const fil = await filAccessible(acteur, id);
  if (fil.type !== 'groupe' || !fil.photoFichier) throw new ErreurIntrouvable('La photo', id);
  return fil.photoFichier;
}

export async function depuisFiche(acteur, corps = {}) {
  if (corps.personne) {
    const cible = acteurValide(corps.personne, 'personne');
    await verifierJoignable(acteur, cible);
    return transaction((client) => filAvec(acteur, cible, client));
  }

  const bailleurId = String(corps.entreprise ?? '').trim();
  if (!UUID.test(bailleurId)) {
    throw new ErreurValidation('Organisation invalide.', { entreprise: 'Identifiant attendu' });
  }

  const joignables = new Set((await conversationRepository.joignables(acteur)).map((p) => `${p.type}:${p.id}`));
  const contacts = (await conversationRepository.contactsDeBailleur(bailleurId)).filter((contact) =>
    joignables.has(`${contact.acteur.type}:${contact.acteur.id}`)
  );
  if (contacts.length === 0) throw new ErreurIntrouvable('Un contact joignable pour cette organisation', bailleurId);

  return transaction(async (client) => {
    await conversationRepository.verrouiller(`fiche:${acteur.type}:${acteur.id}:${bailleurId}`, client);

    for (const contact of contacts) {
      const existant = acteur.type === 'admin'
        ? await conversationRepository.trouverAssistance(contact.acteur.id, client)
        : await conversationRepository.trouverIndividuel(acteur, contact.acteur, client);
      if (existant) {
        if (acteur.type === 'admin') await conversationRepository.ajouterParticipants(existant, [acteur], null, client);
        return { id: nombre(existant), cree: false };
      }
    }

    return filAvec(acteur, contacts[0].acteur, client);
  });
}
