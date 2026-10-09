import { transaction } from '../config/database.js';
import * as profileRepository from '../repositories/volunteerProfile.repository.js';
import * as volunteerRepository from '../repositories/volunteer.repository.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';
import { calculerAge } from './volunteerAuth.service.js';

const JOURS = [
  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
];

const MOMENTS = ['matin', 'apres-midi', 'soir', 'journee'];

const BADGES = [
  { cle: 'premiere-tache', libelle: 'Première tâche livrée', taches: 1 },
  { cle: 'cinq-taches', libelle: '5 tâches livrées', taches: 5 },
  { cle: 'trois-projets', libelle: '3 projets soutenus', projets: 3 },
  { cle: 'quinze-taches', libelle: '15 tâches livrées', taches: 15 },
  { cle: 'pilier', libelle: 'Pilier HOPE', taches: 30, projets: 5 },
];

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
    pays: fiche.pays ?? null,
    competences: fiche.competences ?? [],
    langues: fiche.langues ?? [],
    disponibilites: fiche.disponibilites ?? {},
    accepteTerrain: fiche.accepteTerrain,
    accepteDistance: fiche.accepteDistance,
    masqueSite: fiche.masqueSite,
    contactUrgenceNom: fiche.contactUrgenceNom,
    contactUrgenceTel: fiche.contactUrgenceTel,
    valideParHope: fiche.valideParHope,
    valideLe: fiche.valideLe,
    benevoleDepuis: fiche.benevoleDepuis,
  };
}

export async function recuperer(utilisateurId) {
  const fiche = await profileRepository.garantir(utilisateurId);
  if (!fiche) throw new ErreurIntrouvable('Le profil bénévole', utilisateurId);
  return versProfilPublic(fiche);
}

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

function booleen(valeur) {
  if (valeur === undefined) return undefined;
  if (typeof valeur === 'boolean') return valeur;
  return String(valeur).trim().toLowerCase() === 'true';
}

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

function numeroDejaPris(erreur) {
  return erreur?.code === '23505' && String(erreur.constraint ?? '').includes('telephone');
}

function paysIso(valeur) {
  if (valeur === undefined) return undefined;
  const code = String(valeur ?? '').trim().toUpperCase();
  if (code === '') return null;
  if (!/^[A-Z]{2}$/.test(code)) {
    throw new ErreurValidation('Choisissez votre pays d’origine.', { pays: 'Pays inconnu' });
  }
  return code;
}

export async function mettreAJour(utilisateurId, corps = {}) {
  const fiche = await profileRepository.garantir(utilisateurId);
  if (!fiche) throw new ErreurIntrouvable('Le profil bénévole', utilisateurId);

  const colonnesFiche = {
    profession: texte(corps.profession, 'profession', 120),
    pays: paysIso(corps.pays),
    competences: listeDeTextes(corps.competences, 'competences'),
    langues: listeDeTextes(corps.langues, 'langues'),
    disponibilites: disponibilitesValides(corps.disponibilites),
    accepte_terrain: booleen(corps.accepteTerrain),
    accepte_distance: booleen(corps.accepteDistance),
    masque_site: booleen(corps.masqueSite),
    contact_urgence_nom: texte(corps.contactUrgenceNom, 'contactUrgenceNom', 120),
    contact_urgence_tel: texte(corps.contactUrgenceTel, 'contactUrgenceTel', 20),
  };

  if (colonnesFiche.disponibilites !== undefined) {
    colonnesFiche.disponibilites = JSON.stringify(colonnesFiche.disponibilites);
  }

  const colonnesCompte = {
    nom: nomPropre(corps.nom, 'nom'),
    prenom: nomPropre(corps.prenom, 'prenom'),
    adresse: texte(corps.adresse, 'adresse', 255),
    telephone: texte(corps.telephone, 'telephone', 20),
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

export async function journal(utilisateurId) {
  const fiche = await profileRepository.garantir(utilisateurId);
  if (!fiche) throw new ErreurIntrouvable('Le profil bénévole', utilisateurId);

  const [totaux, lignes] = await Promise.all([
    profileRepository.journal(fiche.id),
    profileRepository.lignesDuJournal(fiche.id),
  ]);

  const taches = Number(totaux.tachesLivrees ?? 0);
  const projets = Number(totaux.projetsAides ?? 0);

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

export async function completer(utilisateurId, corps = {}) {
  const manquants = {};
  if (String(corps.prenom ?? '').trim() === '') manquants.prenom = 'Champ obligatoire';
  if (String(corps.nom ?? '').trim() === '') manquants.nom = 'Champ obligatoire';
  if (Object.keys(manquants).length > 0) {
    throw new ErreurValidation('Indiquez votre prénom et votre nom.', manquants);
  }

  const profil = await mettreAJour(utilisateurId, corps);
  await volunteerRepository.marquerProfilComplete(utilisateurId);

  const compte = await volunteerRepository.trouverParId(utilisateurId);
  const enAttente = compte?.statut === 'en_attente';

  return {
    ...profil,
    profilComplete: true,
    statut: compte?.statut ?? 'en_attente',
    enAttente,
    message: enAttente
      ? 'Votre fiche est enregistrée. L’équipe HOPE l’examine et active votre compte.'
      : 'Votre profil est enregistré. Bienvenue dans l’espace bénévole.',
  };
}
