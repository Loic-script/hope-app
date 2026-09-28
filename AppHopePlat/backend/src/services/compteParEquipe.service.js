/**
 * Un compte benevole ou bailleur cree par l'equipe, depuis l'onglet
 * Benevoles ou Bailleurs des utilisateurs.
 *
 * Contrairement a l'inscription :
 *   - le compte est ouvert tout de suite (l'equipe le cree : pas de
 *     validation a attendre) ;
 *   - l'adresse est tenue pour confirmee -- la personne l'a donnee a
 *     l'equipe elle-meme ;
 *   - le mot de passe est genere, et part par courriel avec un lien vers
 *     la connexion. Il ne s'affiche que si le courriel n'a pas pu partir.
 *
 * Le benevole remplira sa fiche (competences, disponibilites) a sa
 * premiere connexion ; le bailleur arrive dans son espace, son
 * organisation deja creee.
 */
import bcrypt from 'bcrypt';

import { config } from '../config/env.js';
import { query, transaction } from '../config/database.js';
import * as funderRepository from '../repositories/funder.repository.js';
import * as volunteerRepository from '../repositories/volunteer.repository.js';
import { ErreurRegleMetier, ErreurValidation, estViolationUnicite } from '../shared/errors.js';
import { texteFacultatif, texteRequis, valeurParmi } from '../shared/validation.js';
import { motDePasseGenere } from './backoffice.service.js';
import * as courriel from './courriel.service.js';
import { LIBELLES_TYPE, TYPES_ORGANISATION } from './funderAuth.service.js';

const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOMS = { benevole: 'bénévole', bailleur: 'bailleur' };

function lienDeConnexion(email, type) {
  const site = config.siteUrl.replace(/\/$/, '');
  return `${site}/authentification?email=${encodeURIComponent(email)}&type=${type}`;
}

/**
 * @param {{ type: 'benevole'|'bailleur', prenom: string, nom: string, email: string,
 *           telephone?: string, organisation?: string, typeOrganisation?: string,
 *           fonction?: string }} corps
 * @param {{ id: number }} admin l'auteur
 */
export async function creer(corps = {}, admin = null) {
  const type = valeurParmi(corps.type, 'type', ['BENEVOLE', 'BAILLEUR']).toLowerCase();
  const prenom = texteRequis(corps.prenom, 'prenom', { max: 80 });
  const nom = texteRequis(corps.nom, 'nom', { max: 80 });
  const email = String(corps.email ?? '').trim().toLowerCase();
  if (!COURRIEL.test(email) || email.length > 160) {
    throw new ErreurValidation('Indiquez une adresse électronique valide.', { email: 'Adresse invalide' });
  }
  const telephone = texteFacultatif(corps.telephone, 'telephone', { max: 20 });

  let organisation = null;
  if (type === 'bailleur') {
    organisation = {
      raisonSociale: texteRequis(corps.organisation, 'organisation', { max: 200 }),
      typeOrganisation: corps.typeOrganisation
        ? valeurParmi(String(corps.typeOrganisation).toUpperCase(), 'typeOrganisation', TYPES_ORGANISATION.map((t) => t.toUpperCase())).toLowerCase()
        : 'autre',
      pays: 'Madagascar',
    };
  }

  if (await volunteerRepository.emailExiste(email)) {
    throw new ErreurRegleMetier('Un compte utilise déjà cette adresse.', 'ADRESSE_DEJA_PRISE');
  }

  const motDePasse = motDePasseGenere();
  const hash = await bcrypt.hash(motDePasse, config.admin.saltRounds);

  let compte;
  try {
    compte = await transaction(async (client) => {
      const cree = await volunteerRepository.creer({ nom, prenom, email, telephone, motDePasse: hash }, [type], client);
      await volunteerRepository.changerStatut(cree.id, 'actif', admin?.id ?? null, client);
      await query('UPDATE utilisateur SET email_verifie_le = NOW() WHERE id = $1', [cree.id], client);
      if (type === 'bailleur') {
        await funderRepository.creerAvecContact(organisation, cree.id, texteFacultatif(corps.fonction, 'fonction', { max: 120 }), client);
        await volunteerRepository.marquerProfilComplete(cree.id, client);
      }
      return volunteerRepository.trouverParId(cree.id, client);
    });
  } catch (erreur) {
    if (estViolationUnicite(erreur)) {
      throw new ErreurRegleMetier('Cette adresse ou ce téléphone est déjà utilisé par un compte.', 'DEJA_UTILISE');
    }
    throw erreur;
  }

  const envoye = await courriel.envoyer({
    a: email,
    sujet: `HOPE — votre compte ${NOMS[type]} est ouvert`,
    titre: `Bienvenue ${prenom} !`,
    paragraphes: [
      type === 'benevole'
        ? 'L’équipe HOPE vous a ouvert un compte bénévole. À votre première connexion, vous préciserez vos compétences et vos disponibilités.'
        : `L’équipe HOPE vous a ouvert un compte bailleur pour « ${organisation.raisonSociale} ». Vous y suivrez les projets que vous financez.`,
      `Identifiant : ${email} (type d’utilisateur : ${NOMS[type]})`,
      `Mot de passe : ${motDePasse}`,
      'Par sécurité, changez ce mot de passe dès votre première connexion, depuis votre profil.',
    ],
    bouton: { texte: 'Ouvrir mon espace', lien: lienDeConnexion(email, type) },
    note: 'Vous n’attendiez pas ce message ? Ignorez-le et prévenez l’équipe HOPE.',
  });

  return {
    compte: { id: compte.id, email, prenom, nom, type, statut: compte.statut },
    courrielEnvoye: envoye,
    ...(envoye ? {} : { motDePasseProvisoire: motDePasse }),
    message: envoye
      ? `Le compte ${NOMS[type]} est ouvert : ses accès viennent de partir à ${email}.`
      : `Le compte ${NOMS[type]} est ouvert, mais le courriel n’a pas pu partir : transmettez ce mot de passe à la personne.`,
  };
}

/** Les types d'organisation, pour le formulaire du bailleur. */
export function typesOrganisation() {
  return TYPES_ORGANISATION.map((cle) => ({ cle, libelle: LIBELLES_TYPE[cle] }));
}
