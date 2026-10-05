/**
 * Le don sans compte : "Faire un don" depuis le site vitrine.
 *
 * Le visiteur dit qui il est (nom, prenom, courriel, telephone, pays,
 * ville), a quoi va son don et comment il paie ; rien ne lui demande de
 * creer un compte. Sa fiche "donors" est celle d'un donateur SANS compte
 * (utilisateur_id vide) : s'il revient donner avec la meme adresse, la
 * fiche est reprise et mise a jour plutot que doublee.
 *
 * Le don est une PROMESSE comme dans les espaces (promesseDon.service) :
 * PENDING, l'equipe prevenue, confirmee a reception. Un don sans compte
 * est toujours ponctuel : le mensuel suppose un espace ou le suivre.
 *
 * Sans session, le donateur recoit un JETON signe avec son don : c'est
 * lui qui l'autorise, pendant douze heures, a signaler son paiement
 * (reference MVola, de virement...) ou a lire l'etat de son paiement par
 * carte -- et rien d'autre, sur ce don et aucun autre.
 */
import jwt from 'jsonwebtoken';

import { config } from '../config/env.js';
import * as donorRepository from '../repositories/donor.repository.js';
import * as donorSpaceRepository from '../repositories/donorSpace.repository.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';
import { DEVISES, MODES_PAIEMENT, projetsProposes } from './donorProfile.service.js';
import { coordonneesDePaiement } from './donorSpace.service.js';
import { creerSession, etatSession, reglages } from './paiementCarte.service.js';
import { declarerJustificatif, nomDuPays, origineDuPays, promettreUnDon } from './promesseDon.service.js';

/** Le jeton vaut le temps de payer et de revenir signaler le paiement. */
const DUREE_JETON = '12h';

const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEPHONE_E164 = /^\+[1-9]\d{6,14}$/;
const CODE_PAYS = /^[A-Z]{2}$/;

/** GET /api/public/dons/options : ce que le formulaire propose. */
export async function options() {
  return { modesPaiement: MODES_PAIEMENT, devises: DEVISES, projets: await projetsProposes() };
}

/** GET /api/public/dons/coordonnees : ou envoyer un don hors ligne. */
export function coordonnees() {
  return coordonneesDePaiement();
}

/** Un texte obligatoire, borne ; l'erreur s'ajoute aux details. */
function requis(valeur, champ, max, details) {
  const texte = String(valeur ?? '').trim();
  if (texte === '') details[champ] = 'Champ obligatoire';
  else if (texte.length > max) details[champ] = `Au plus ${max} caractères`;
  return texte;
}

/**
 * Qui donne, tel que le formulaire l'envoie (corps.donateur).
 *
 * @returns {{ prenom, nom, email, telephone, pays, ville }}
 */
export function validerDonateur(corps = {}) {
  const details = {};
  const nom = requis(corps.nom, 'nom', 80, details);
  const prenom = requis(corps.prenom, 'prenom', 80, details);

  const email = String(corps.email ?? corps.courriel ?? '').trim().toLowerCase();
  if (email === '') details.courriel = 'Champ obligatoire';
  else if (email.length > 255 || !COURRIEL.test(email)) details.courriel = 'Adresse invalide';

  const telephone = String(corps.telephone ?? '').replace(/[\s.-]/g, '');
  if (telephone === '') details.telephone = 'Champ obligatoire';
  else if (!TELEPHONE_E164.test(telephone)) details.telephone = 'Numéro invalide';

  const pays = String(corps.pays ?? '').trim().toUpperCase();
  if (pays === '') details.pays = 'Champ obligatoire';
  else if (!CODE_PAYS.test(pays)) details.pays = 'Pays invalide';

  const ville = String(corps.ville ?? '').trim();
  if (ville.length > 120) details.ville = 'Au plus 120 caractères';

  if (Object.keys(details).length > 0) {
    throw new ErreurValidation('Vérifiez vos informations.', details);
  }
  return { prenom, nom, email, telephone, pays, ville: ville || null };
}

/**
 * L'identite d'un donateur sans compte, au sens de promesseDon.service :
 * pas de compte, une fiche retrouvee par le courriel ou creee, et ses
 * dons relus par la fiche plutot que par le compte.
 */
function identiteInvite(donateur) {
  let ficheId = null;
  return {
    utilisateurId: null,
    qui: `${donateur.prenom} ${donateur.nom}`,
    email: donateur.email,
    origine: 'site',
    async ficheId(client) {
      const colonnes = {
        first_name: donateur.prenom,
        last_name: donateur.nom,
        phone: donateur.telephone,
        country: nomDuPays(donateur.pays),
        city: donateur.ville,
        origin: origineDuPays(donateur.pays),
      };
      const existante = await donorSpaceRepository.ficheSansCompte(donateur.email, client);
      if (existante) {
        await donorRepository.mettreAJour(existante.id, colonnes, client);
        ficheId = Number(existante.id);
      } else {
        const fiche = await donorRepository.creer(
          {
            firstName: donateur.prenom,
            lastName: donateur.nom,
            organizationName: null,
            email: donateur.email,
            phone: donateur.telephone,
            country: colonnes.country,
            city: donateur.ville,
            origin: colonnes.origin,
          },
          client
        );
        ficheId = Number(fiche.id);
      }
      return ficheId;
    },
    relire: (donId) => donorSpaceRepository.unDonDeLaFiche(ficheId, donId),
    get fiche() {
      return ficheId;
    },
  };
}

/** Le jeton remis avec le don : ce don, cette fiche, rien d'autre. */
function signer(don, ficheId) {
  return jwt.sign({ invite: true, don: Number(don.id), fiche: Number(ficheId) }, config.jwt.secret, {
    expiresIn: DUREE_JETON,
  });
}

/**
 * Lit le jeton d'un donateur sans compte. Un jeton absent, faux, perime,
 * ou d'un autre don : "don introuvable", sans en dire plus.
 */
function lireJeton(jeton, donId = null) {
  let charge;
  try {
    charge = jwt.verify(String(jeton ?? ''), config.jwt.secret);
  } catch {
    throw new ErreurIntrouvable('Le don', donId ?? '?');
  }
  if (!charge?.invite || !Number.isInteger(charge.don) || !Number.isInteger(charge.fiche)) {
    throw new ErreurIntrouvable('Le don', donId ?? '?');
  }
  if (donId !== null && Number(donId) !== charge.don) {
    throw new ErreurIntrouvable('Le don', donId);
  }
  return charge;
}

/**
 * POST /api/public/dons : la promesse d'un don sans compte.
 *
 * @param {{ donateur: object, affectation, projetId?, montant, devise?, mode,
 *           message?, referencePaiement?, numeroPayeur? }} corps
 */
export async function promettre(corps = {}) {
  const identite = identiteInvite(validerDonateur(corps.donateur));
  const resultat = await promettreUnDon(identite, corps, { mensuelPermis: false });
  return { ...resultat, jeton: signer(resultat.don, identite.fiche) };
}

/**
 * PATCH /api/public/dons/:id/justificatif : le donateur signale avoir
 * paye, avec la reference de sa banque ou de l'operateur.
 */
export async function declarer(donId, corps = {}, jeton) {
  const charge = lireJeton(jeton, donId);
  const don = await donorSpaceRepository.unDonDeLaFiche(charge.fiche, charge.don);
  if (!don) throw new ErreurIntrouvable('Le don', donId);
  if (don.statut !== 'PENDING') {
    throw new ErreurValidation('Ce don n’est plus en attente : il a déjà été traité par l’équipe.', {
      statut: 'Don déjà traité',
    });
  }
  const fiche = await donorRepository.trouverParId(charge.fiche);
  const personne = {
    id: null,
    prenom: fiche?.firstName ?? '',
    nom: fiche?.lastName ?? '',
    email: fiche?.email ?? '',
    relire: (id) => donorSpaceRepository.unDonDeLaFiche(charge.fiche, id),
  };
  return declarerJustificatif(personne, don, corps);
}

/** GET /api/public/dons/paiement/carte : la carte est-elle acceptee ici ? */
export function reglagesCarte() {
  return reglages();
}

/**
 * POST /api/public/dons/paiement/carte/session : le don, puis la session
 * de paiement chez Stripe.
 */
export async function ouvrirCarte(corps = {}, origine = '') {
  const identite = identiteInvite(validerDonateur(corps.donateur));
  const resultat = await creerSession(identite, corps, { origine, mensuelPermis: false });
  return { ...resultat, jeton: signer(resultat.don, identite.fiche) };
}

/** GET /api/public/dons/paiement/carte/session/:id : ou en est ce paiement. */
export function etatCarte(sessionId, jeton) {
  const charge = lireJeton(jeton);
  return etatSession(
    {
      utilisateurId: null,
      peutLire: (don) => Number(don.id) === charge.don,
      relire: (id) => donorSpaceRepository.unDonDeLaFiche(charge.fiche, id),
    },
    sessionId
  );
}
