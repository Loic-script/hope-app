/**
 * Le parcours d'accueil du donateur.
 *
 * Cinq etapes s'ouvrent des l'inscription : informations personnelles,
 * profil du donateur, affectation du don, mode de paiement, frequence.
 * Ce fichier porte la premiere ; les suivantes s'y ajouteront.
 */
import { transaction } from '../config/database.js';
import * as donorProfileRepository from '../repositories/donorProfile.repository.js';
import { ErreurValidation } from '../shared/errors.js';

/**
 * Comment on a connu HOPE.
 *
 * La liste vit ici, et la contrainte de la table la recopie : le
 * formulaire la recoit du serveur, et ne peut donc pas proposer un choix
 * que la base refuserait.
 */
export const SOURCES_CONNAISSANCE = [
  { cle: 'reseaux_sociaux', libelle: 'Réseaux sociaux (Facebook, Instagram…)' },
  { cle: 'bouche_a_oreille', libelle: 'Un proche, le bouche-à-oreille' },
  { cle: 'recherche_internet', libelle: 'Une recherche sur internet' },
  { cle: 'evenement', libelle: 'Un événement HOPE' },
  { cle: 'medias', libelle: 'La presse, la radio ou la télévision' },
  { cle: 'membre_hope', libelle: 'Un bénévole ou un membre de HOPE' },
  { cle: 'partenaire', libelle: 'Une entreprise ou un partenaire' },
  { cle: 'autre', libelle: 'Autre' },
];

/** Le numero au format international : "+261341234567". */
const TELEPHONE_E164 = /^\+[1-9]\d{6,14}$/;

/** La fiche, et ce qu'il faut au formulaire pour l'afficher. */
export async function recuperer(utilisateurId) {
  await donorProfileRepository.garantir(utilisateurId);
  const fiche = await donorProfileRepository.trouver(utilisateurId);

  return {
    etapeSuivante: fiche.etapeSuivante,
    informations: {
      nom: fiche.nom ?? '',
      prenom: fiche.prenom ?? '',
      adresse: fiche.adresse ?? '',
      ville: fiche.ville ?? '',
      pays: fiche.pays ?? '',
      telephone: fiche.telephone ?? '',
      profession: fiche.profession ?? '',
      source: fiche.sourceConnaissance ?? '',
    },
    options: { sources: SOURCES_CONNAISSANCE },
  };
}

/** Un texte obligatoire, borne. L'erreur va dans details. */
function requis(valeur, champ, max, details) {
  const propre = String(valeur ?? '').trim();
  if (propre === '') details[champ] = 'Champ obligatoire';
  else if (propre.length > max) details[champ] = `Au plus ${max} caractères`;
  return propre;
}

/**
 * Enregistre l'etape 1.
 *
 * Obligatoires : nom, prenom, adresse, ville, pays, telephone.
 * Facultatifs : profession, et la facon dont on a connu HOPE.
 */
export async function enregistrerEtape1(utilisateurId, corps = {}) {
  const details = {};

  const nom = requis(corps.nom, 'nom', 80, details);
  const prenom = requis(corps.prenom, 'prenom', 80, details);
  const adresse = requis(corps.adresse, 'adresse', 255, details);
  const ville = requis(corps.ville, 'ville', 120, details);

  const pays = String(corps.pays ?? '').trim().toUpperCase();
  if (pays === '') details.pays = 'Champ obligatoire';
  else if (!/^[A-Z]{2}$/.test(pays)) details.pays = 'Pays inconnu';

  // Le formulaire envoie le numero deja mis au format international.
  const telephone = String(corps.telephone ?? '').replace(/[\s.-]/g, '');
  if (telephone === '') details.telephone = 'Champ obligatoire';
  else if (!TELEPHONE_E164.test(telephone)) details.telephone = 'Numéro invalide';

  const profession = String(corps.profession ?? '').trim();
  if (profession.length > 120) details.profession = 'Au plus 120 caractères';

  const source = String(corps.source ?? '').trim();
  if (source !== '' && !SOURCES_CONNAISSANCE.some((s) => s.cle === source)) {
    details.source = 'Choix inconnu';
  }

  if (Object.keys(details).length > 0) {
    throw new ErreurValidation('Le formulaire comporte des erreurs.', details);
  }

  try {
    await transaction(async (client) => {
      await donorProfileRepository.garantir(utilisateurId, client);
      await donorProfileRepository.enregistrerEtape1(
        utilisateurId,
        {
          nom,
          prenom,
          adresse,
          ville,
          pays,
          telephone,
          profession: profession || null,
          source: source || null,
        },
        client
      );
    });
  } catch (erreur) {
    // Le telephone est UNIQUE sur le compte : un numero deja porte par
    // un autre revient comme une erreur de champ, pas une erreur interne.
    if (erreur?.code === '23505' && String(erreur.constraint ?? '').includes('telephone')) {
      throw new ErreurValidation('Ce numéro est déjà utilisé par un autre compte.', {
        telephone: 'Numéro déjà utilisé',
      });
    }
    throw erreur;
  }

  return recuperer(utilisateurId);
}
