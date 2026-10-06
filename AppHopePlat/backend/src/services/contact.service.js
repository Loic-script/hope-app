/**
 * Le formulaire de contact du site vitrine.
 *
 * Un visiteur ecrit a HOPE sans compte : son nom, son courriel, un
 * telephone s'il veut, le sujet et le message. Le message est garde
 * (contact_messages), l'equipe le voit dans sa cloche (notification
 * CONTACT) et le recoit en entier par courriel ; le visiteur recoit un
 * accuse de reception.
 *
 * Un champ piege, invisible pour une personne, arrete les robots : s'il
 * est rempli, on repond "merci" sans rien garder.
 */
import { transaction } from '../config/database.js';
import * as contactRepository from '../repositories/contactMessage.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import { ErreurValidation } from '../shared/errors.js';
import * as courrielsAuto from './courrielsAutomatiques.service.js';

/** Les sujets proposes par le formulaire ; la base les connait (schema.sql). */
export const SUJETS = [
  { cle: 'don', libelle: 'Faire un don' },
  { cle: 'benevolat', libelle: 'Devenir bénévole' },
  { cle: 'partenariat', libelle: 'Partenariat' },
  { cle: 'presse', libelle: 'Presse et médias' },
  { cle: 'autre', libelle: 'Autre demande' },
];

const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEPHONE = /^\+?\d{6,15}$/;
const MESSAGE_MAX = 2000;

const MERCI = 'Merci ! Votre message est bien arrivé. L’équipe HOPE vous répond sous 48 h ouvrées.';

/** Un texte obligatoire, borne ; l'erreur s'ajoute aux details. */
function requis(valeur, champ, { min = 1, max }, details) {
  const texte = String(valeur ?? '').trim();
  if (texte === '') details[champ] = 'Champ obligatoire';
  else if (texte.length < min) details[champ] = `Au moins ${min} caractères`;
  else if (texte.length > max) details[champ] = `Au plus ${max} caractères`;
  return texte;
}

/** Les options du formulaire. */
export function options() {
  return { sujets: SUJETS };
}

/**
 * POST /api/public/contact
 *
 * @param {{ nom, courriel, telephone?, sujet, message, siteWeb? }} corps
 */
export async function envoyer(corps = {}) {
  // Le piege a robots : personne ne voit ce champ. Rempli, on fait comme si.
  if (String(corps.siteWeb ?? '').trim() !== '') return { message: MERCI };

  const details = {};
  const nom = requis(corps.nom, 'nom', { min: 2, max: 120 }, details);

  const email = String(corps.courriel ?? corps.email ?? '').trim().toLowerCase();
  if (email === '') details.courriel = 'Champ obligatoire';
  else if (email.length > 255 || !COURRIEL.test(email)) details.courriel = 'Adresse invalide';

  const telephoneBrut = String(corps.telephone ?? '').replace(/[\s.()-]/g, '');
  if (telephoneBrut !== '' && !TELEPHONE.test(telephoneBrut)) details.telephone = 'Numéro invalide';
  const telephone = telephoneBrut || null;

  const sujet = String(corps.sujet ?? '').trim();
  const sujetConnu = SUJETS.find((s) => s.cle === sujet);
  if (!sujetConnu) details.sujet = 'Choisissez un sujet';

  const message = requis(corps.message, 'message', { min: 10, max: MESSAGE_MAX }, details);

  if (Object.keys(details).length > 0) {
    throw new ErreurValidation('Vérifiez votre message.', details);
  }

  const extrait = message.length > 140 ? `${message.slice(0, 140)}…` : message;
  const cree = await transaction(async (client) => {
    const enregistre = await contactRepository.creer({ nom, email, telephone, sujet, message }, client);
    await notificationRepository.creer(
      {
        type: 'CONTACT',
        label:
          `Message du site (${sujetConnu.libelle}) : ${nom}, ${email}` +
          `${telephone ? `, ${telephone}` : ''} — « ${extrait} »`,
      },
      client
    );
    return enregistre;
  });

  const pourCourriel = { ...cree, sujetLibelle: sujetConnu.libelle };
  void courrielsAuto.messageDeContact(pourCourriel);
  void courrielsAuto.contactRecu(pourCourriel);

  return { id: cree.id, message: MERCI };
}
