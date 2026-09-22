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
 * Paliers de reconnaissance du journal.
 *
 * Ils ne sont pas stockes : un badge se deduit des totaux, et une table
 * de badges se desynchroniserait a la premiere tache relachee.
 *
 * Deux mesures, et deux seulement : le nombre de taches livrees, et le
 * nombre de projets differents soutenus -- aider sur plusieurs fronts
 * compte autant que beaucoup aider au meme endroit.
 */
const BADGES = [
  { cle: 'premiere-tache', libelle: 'Première tâche livrée', taches: 1 },
  { cle: 'cinq-taches', libelle: '5 tâches livrées', taches: 5 },
  { cle: 'trois-projets', libelle: '3 projets soutenus', projets: 3 },
  { cle: 'quinze-taches', libelle: '15 tâches livrées', taches: 15 },
  { cle: 'pilier', libelle: 'Pilier HOPE', taches: 30, projets: 5 },
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
/**
 * Verifie l'adresse d'une photo de profil.
 *
 * Elle doit venir du dossier des medias de HOPE : c'est le televersement
 * de l'espace qui la produit. Une chaine vide efface la photo.
 */
function photoValide(valeur) {
  if (valeur === undefined) return undefined;
  if (valeur === null || String(valeur).trim() === '') return null;

  const adresse = String(valeur).trim();
  if (!adresse.startsWith('/media/')) {
    throw new ErreurValidation('La photo doit être téléversée depuis votre espace.', {
      photoUrl: 'Adresse non acceptée',
    });
  }
  return adresse;
}

/**
 * Un nom ou un prenom.
 *
 * L'inscription ne les demande plus : ils arrivent ici. Absent, le champ
 * ne change pas ; fourni, il ne peut pas etre vide -- on renseigne son
 * nom, on ne l'efface pas.
 */
function nomPropre(valeur, champ) {
  if (valeur === undefined) return undefined;
  const propre = String(valeur ?? '').trim();
  if (propre === '') {
    throw new ErreurValidation('Le nom et le prénom sont obligatoires.', {
      [champ]: 'Champ obligatoire',
    });
  }
  if (propre.length > 80) {
    throw new ErreurValidation('Le nom et le prénom font au plus 80 caractères.', {
      [champ]: 'Au plus 80 caractères',
    });
  }
  return propre;
}

/**
 * Le telephone est UNIQUE : un numero deja porte par un autre compte
 * doit revenir comme une erreur de champ, pas comme une erreur interne.
 */
function numeroDejaPris(erreur) {
  return erreur?.code === '23505' && String(erreur.constraint ?? '').includes('telephone');
}

export async function mettreAJour(utilisateurId, corps = {}) {
  const fiche = await profileRepository.garantir(utilisateurId);
  if (!fiche) throw new ErreurIntrouvable('Le profil bénévole', utilisateurId);

  const colonnesFiche = {
    profession: texte(corps.profession, 'profession', 120),
    competences: listeDeTextes(corps.competences, 'competences'),
    langues: listeDeTextes(corps.langues, 'langues'),
    disponibilites: disponibilitesValides(corps.disponibilites),
    // La distance acceptee depuis le quartier ne se demande plus : la
    // colonne rayon_km reste en base, mais n'est plus ni lue ni ecrite.
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
    nom: nomPropre(corps.nom, 'nom'),
    prenom: nomPropre(corps.prenom, 'prenom'),
    adresse: texte(corps.adresse, 'adresse', 255),
    telephone: texte(corps.telephone, 'telephone', 20),
    // La photo de profil. Seule une adresse servie par HOPE est acceptee :
    // une adresse exterieure ferait charger au navigateur une image dont
    // personne ici ne repond, et suivrait le benevole d'un site a l'autre.
    photo_url: photoValide(corps.photoUrl),
    date_de_naissance: corps.dateDeNaissance === undefined
      ? undefined
      : (corps.dateDeNaissance || null),
  };

  try {
    return await transaction(async (client) => {
      await profileRepository.mettreAJourCompte(utilisateurId, colonnesCompte, client);
      const misAJour = await profileRepository.mettreAJour(fiche.id, colonnesFiche, client);
      return versProfilPublic(misAJour);
    });
  } catch (erreur) {
    if (numeroDejaPris(erreur)) {
      throw new ErreurValidation('Ce numéro est déjà utilisé par un autre compte.', {
        telephone: 'Numéro déjà utilisé',
      });
    }
    throw erreur;
  }
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

  const taches = Number(totaux.tachesLivrees ?? 0);
  const projets = Number(totaux.projetsAides ?? 0);

  /*
   * Les paliers sortent avec le badge.
   *
   * Sans eux, l'ecran ne peut dire qu'une chose -- obtenu, ou pas -- la
   * ou le benevole veut savoir ce qui lui manque encore. Ce sont des
   * constantes publiques, rien de sensible.
   */
  const badges = BADGES.map((badge) => ({
    cle: badge.cle,
    libelle: badge.libelle,
    taches: badge.taches ?? null,
    projets: badge.projets ?? null,
    obtenu:
      (badge.taches === undefined || taches >= badge.taches) &&
      (badge.projets === undefined || projets >= badge.projets),
  }));

  return {
    tachesLivrees: taches,
    tachesEnCours: Number(totaux.tachesEnCours ?? 0),
    projetsAides: projets,
    premiereLivraison: totaux.premiereLivraison,
    derniereLivraison: totaux.derniereLivraison,
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
  // Le nom est demande ici, et non plus a l'inscription : la completion
  // est le seul passage oblige avant d'entrer dans l'espace, et l'equipe
  // ne confie pas une tache a une adresse electronique.
  const manquants = {};
  if (String(corps.prenom ?? '').trim() === '') manquants.prenom = 'Champ obligatoire';
  if (String(corps.nom ?? '').trim() === '') manquants.nom = 'Champ obligatoire';
  if (Object.keys(manquants).length > 0) {
    throw new ErreurValidation('Indiquez votre prénom et votre nom.', manquants);
  }

  const profil = await mettreAJour(utilisateurId, corps);
  await volunteerRepository.marquerProfilComplete(utilisateurId);

  return {
    ...profil,
    profilComplete: true,
    message: 'Votre profil est enregistré. Bienvenue dans l’espace bénévole.',
  };
}
