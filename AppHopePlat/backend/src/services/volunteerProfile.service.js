/**
 * Service du profil benevole et du journal d'heures.
 *
 * Le profil est a cheval sur deux tables : "utilisateur" pour l'etat
 * civil, "benevole" pour ce qui ne sert qu'au terrain. Le benevole
 * modifie les deux depuis un seul formulaire, mais pas tout : son
 * statut de compte et sa validation par HOPE ne lui appartiennent pas.
 */
import { transaction } from '../config/database.js';
import * as profileRepository from '../repositories/volunteerProfile.repository.js';
import * as volunteerRepository from '../repositories/volunteer.repository.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';
import { calculerAge } from './volunteerAuth.service.js';

/** Jours acceptes dans les disponibilites. */
const JOURS = [
  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
];

/** Moments de la journee acceptes. */
const MOMENTS = ['matin', 'apres-midi', 'soir', 'journee'];

/**
 * Paliers de reconnaissance du journal d'heures.
 *
 * Ils ne sont pas stockes : un badge se deduit du total, et une table
 * de badges se desynchroniserait a la premiere correction d'heures.
 */
const BADGES = [
  { cle: 'premiere-mission', libelle: 'Première mission', missions: 1 },
  { cle: 'dix-heures', libelle: '10 heures données', heures: 10 },
  { cle: 'cinq-missions', libelle: '5 missions', missions: 5 },
  { cle: 'cinquante-heures', libelle: '50 heures données', heures: 50 },
  { cle: 'pilier', libelle: 'Pilier HOPE', missions: 20, heures: 100 },
];

/** Retire de la fiche ce qui ne doit pas sortir vers le benevole. */
function versProfilPublic(fiche) {
  return {
    id: fiche.id,
    utilisateurId: fiche.utilisateurId,
    nom: fiche.nom,
    prenom: fiche.prenom,
    email: fiche.email,
    telephone: fiche.telephone,
    adresse: fiche.adresse,
    photoUrl: fiche.photoUrl,
    dateDeNaissance: fiche.dateDeNaissance,
    age: calculerAge(fiche.dateDeNaissance),
    profession: fiche.profession,
    competences: fiche.competences ?? [],
    langues: fiche.langues ?? [],
    disponibilites: fiche.disponibilites ?? {},
    rayonKm: fiche.rayonKm,
    accepteTerrain: fiche.accepteTerrain,
    accepteDistance: fiche.accepteDistance,
    contactUrgenceNom: fiche.contactUrgenceNom,
    contactUrgenceTel: fiche.contactUrgenceTel,
    valideParHope: fiche.valideParHope,
    valideLe: fiche.valideLe,
    benevoleDepuis: fiche.benevoleDepuis,
    // notes_internes n'est volontairement pas reprise : elle est
    // reservee a l'equipe HOPE.
  };
}

export async function recuperer(utilisateurId) {
  const fiche = await profileRepository.garantir(utilisateurId);
  if (!fiche) throw new ErreurIntrouvable('Le profil bénévole', utilisateurId);
  return versProfilPublic(fiche);
}

/** Liste de textes courts, nettoyee et dedoublonnee. */
function listeDeTextes(valeur, champ, { max = 60 } = {}) {
  if (valeur === undefined) return undefined;
  if (valeur === null || valeur === '') return [];

  const brut = Array.isArray(valeur) ? valeur : String(valeur).split(',');
  const nettoyes = brut
    .map((element) => String(element).trim())
    .filter((element) => element !== '');

  for (const element of nettoyes) {
    if (element.length > max) {
      throw new ErreurValidation(`Chaque entrée de "${champ}" fait au plus ${max} caractères.`, {
        [champ]: `Au plus ${max} caractères par entrée`,
      });
    }
  }
  return [...new Set(nettoyes)];
}

/**
 * Valide les disponibilites.
 *
 * Forme attendue : { "mercredi": ["matin"], "samedi": ["journee"] }.
 * On refuse le reste plutot que de stocker un JSON quelconque : la
 * colonne est libre, mais l'ecran qui la lit ne l'est pas.
 */
function disponibilitesValides(valeur, champ = 'disponibilites') {
  if (valeur === undefined) return undefined;
  if (valeur === null || valeur === '') return {};

  if (typeof valeur !== 'object' || Array.isArray(valeur)) {
    throw new ErreurValidation('Les disponibilités doivent être un objet jour → moments.', {
      [champ]: 'Format invalide',
    });
  }

  const resultat = {};
  for (const [jour, moments] of Object.entries(valeur)) {
    const cle = jour.trim().toLowerCase();
    if (!JOURS.includes(cle)) {
      throw new ErreurValidation(`Jour inconnu : « ${jour} ».`, {
        [champ]: `Jours acceptés : ${JOURS.join(', ')}`,
      });
    }

    const liste = (Array.isArray(moments) ? moments : [moments])
      .map((moment) => String(moment).trim().toLowerCase())
      .filter((moment) => moment !== '');

    for (const moment of liste) {
      if (!MOMENTS.includes(moment)) {
        throw new ErreurValidation(`Moment inconnu : « ${moment} ».`, {
          [champ]: `Moments acceptés : ${MOMENTS.join(', ')}`,
        });
      }
    }

    if (liste.length > 0) resultat[cle] = [...new Set(liste)];
  }
  return resultat;
}

/** Texte court facultatif, ou null. */
function texte(valeur, champ, max) {
  if (valeur === undefined) return undefined;
  const propre = String(valeur ?? '').trim();
  if (propre === '') return null;
  if (propre.length > max) {
    throw new ErreurValidation(`Le champ "${champ}" fait au plus ${max} caractères.`, {
      [champ]: `Au plus ${max} caractères`,
    });
  }
  return propre;
}

/** Booleen tolerant aux chaines "true" / "false" des formulaires. */
function booleen(valeur) {
  if (valeur === undefined) return undefined;
  if (typeof valeur === 'boolean') return valeur;
  return String(valeur).trim().toLowerCase() === 'true';
}

/**
 * Met a jour son propre profil.
 *
 * Ni le statut du compte ni valide_par_hope ne sont modifiables ici :
 * ils relevent de l'equipe HOPE. Un benevole qui pourrait se valider
 * lui-meme rendrait la validation sans objet.
 */
export async function mettreAJour(utilisateurId, corps = {}) {
  const fiche = await profileRepository.garantir(utilisateurId);
  if (!fiche) throw new ErreurIntrouvable('Le profil bénévole', utilisateurId);

  let rayon;
  if (corps.rayonKm !== undefined) {
    if (corps.rayonKm === null || corps.rayonKm === '') {
      rayon = null;
    } else {
      const nombre = Number.parseInt(corps.rayonKm, 10);
      if (!Number.isInteger(nombre) || nombre < 0 || nombre > 500) {
        throw new ErreurValidation('Le rayon doit être un entier de 0 à 500 km.', {
          rayonKm: 'Entre 0 et 500',
        });
      }
      rayon = nombre;
    }
  }

  const colonnesFiche = {
    profession: texte(corps.profession, 'profession', 120),
    competences: listeDeTextes(corps.competences, 'competences'),
    langues: listeDeTextes(corps.langues, 'langues'),
    disponibilites: disponibilitesValides(corps.disponibilites),
    rayon_km: rayon,
    accepte_terrain: booleen(corps.accepteTerrain),
    accepte_distance: booleen(corps.accepteDistance),
    contact_urgence_nom: texte(corps.contactUrgenceNom, 'contactUrgenceNom', 120),
    contact_urgence_tel: texte(corps.contactUrgenceTel, 'contactUrgenceTel', 20),
  };

  // Les disponibilites sont une colonne JSONB : pg attend une chaine.
  if (colonnesFiche.disponibilites !== undefined) {
    colonnesFiche.disponibilites = JSON.stringify(colonnesFiche.disponibilites);
  }

  const colonnesCompte = {
    adresse: texte(corps.adresse, 'adresse', 255),
    telephone: texte(corps.telephone, 'telephone', 20),
    date_de_naissance: corps.dateDeNaissance === undefined
      ? undefined
      : (corps.dateDeNaissance || null),
  };

  return transaction(async (client) => {
    await profileRepository.mettreAJourCompte(utilisateurId, colonnesCompte, client);
    const misAJour = await profileRepository.mettreAJour(fiche.id, colonnesFiche, client);
    return versProfilPublic(misAJour);
  });
}

/**
 * Journal d'heures : les totaux, le detail, et les badges obtenus.
 */
export async function journal(utilisateurId) {
  const fiche = await profileRepository.garantir(utilisateurId);
  if (!fiche) throw new ErreurIntrouvable('Le profil bénévole', utilisateurId);

  const [totaux, lignes] = await Promise.all([
    profileRepository.journal(fiche.id),
    profileRepository.lignesDuJournal(fiche.id),
  ]);

  const heures = Number(totaux.heuresDonnees ?? 0);
  const missions = Number(totaux.missionsRealisees ?? 0);

  const badges = BADGES.map((badge) => ({
    cle: badge.cle,
    libelle: badge.libelle,
    obtenu:
      (badge.heures === undefined || heures >= badge.heures) &&
      (badge.missions === undefined || missions >= badge.missions),
  }));

  return {
    heuresDonnees: heures,
    missionsRealisees: missions,
    missionsAnnulees: Number(totaux.missionsAnnulees ?? 0),
    inscriptionsTotal: Number(totaux.inscriptionsTotal ?? 0),
    premiereMission: totaux.premiereMission,
    derniereMission: totaux.derniereMission,
    benevoleDepuis: fiche.benevoleDepuis,
    badges,
    lignes,
  };
}

/**
 * Completion du profil, apres la premiere connexion.
 *
 * Meme traitement que la mise a jour ordinaire, plus le marqueur qui
 * evite de redemander le formulaire a chaque visite. Un benevole peut
 * legitimement ne declarer aucune competence : c'est pour cela que le
 * marqueur est explicite et non deduit du contenu de la fiche.
 */
export async function completer(utilisateurId, corps = {}) {
  const profil = await mettreAJour(utilisateurId, corps);
  await volunteerRepository.marquerProfilComplete(utilisateurId);

  return {
    ...profil,
    profilComplete: true,
    message: 'Votre profil est enregistré. Bienvenue dans l’espace bénévole.',
  };
}
