/**
 * Service des missions, cote espace benevole.
 *
 * Toute la regle d'inscription tient ici :
 *
 *   * une mission ne se remplit que si elle est ouverte, a venir, et
 *     qu'il reste une place ;
 *   * une mission de terrain exige un benevole valide par HOPE ;
 *   * on ne s'inscrit qu'une fois -- se reinscrire apres annulation
 *     reactive l'inscription existante plutot que d'en creer une autre ;
 *   * un avis ne se laisse que sur une mission ou la presence a ete
 *     constatee.
 *
 * Chaque verification precedant une ecriture se fait dans une
 * transaction avec SELECT ... FOR UPDATE : deux inscriptions
 * simultanees sur la derniere place ne doivent pas passer toutes deux.
 */
import { transaction } from '../config/database.js';
import * as missionRepository from '../repositories/mission.repository.js';
import * as profileRepository from '../repositories/volunteerProfile.repository.js';
import { ErreurIntrouvable, ErreurRegleMetier, ErreurValidation } from '../shared/errors.js';

const FORMATS = ['presentiel', 'terrain', 'distance'];
const STATUTS_MISSION = ['brouillon', 'ouverte', 'complete', 'terminee', 'annulee'];

/** Verifie qu'une valeur en minuscules fait partie d'une liste. */
function parmi(valeur, champ, autorises) {
  const texte = String(valeur ?? '').trim().toLowerCase();
  if (!autorises.includes(texte)) {
    throw new ErreurValidation(`Le champ "${champ}" doit valoir : ${autorises.join(', ')}.`, {
      [champ]: 'Valeur non autorisée',
    });
  }
  return texte;
}

/**
 * Liste des missions proposees.
 *
 * @param {{ statut?, format?, projetId?, aVenir?, search? }} requete
 * @param {string|null} benevoleId marque celles ou il est deja inscrit
 */
export async function lister(requete = {}, benevoleId = null) {
  const filtres = {
    statut: requete.statut ? parmi(requete.statut, 'statut', STATUTS_MISSION) : null,
    format: requete.format ? parmi(requete.format, 'format', FORMATS) : null,
    projetId: requete.projetId ? Number.parseInt(requete.projetId, 10) : null,
    // "aVenir" arrive en chaine depuis l'URL : "false" doit rester faux.
    aVenir: requete.aVenir === undefined ? false : requete.aVenir !== 'false',
    recherche: typeof requete.search === 'string' ? requete.search.trim() : '',
  };

  const items = await missionRepository.lister(filtres, benevoleId);
  return { items };
}

/** Vue d'ensemble : les chiffres du haut de l'espace benevole. */
export async function apercu() {
  return missionRepository.apercu();
}

/** Detail d'une mission, avis publies compris. */
export async function recupererParId(id, benevoleId = null) {
  const mission = await missionRepository.trouverParId(id, benevoleId);
  if (!mission || mission.statut === 'brouillon') {
    throw new ErreurIntrouvable('La mission', id);
  }

  const avis = await missionRepository.listerAvis(id);

  // L'ecran a besoin de savoir si le benevole a deja donne son avis :
  // sans cela il proposerait un formulaire que l'API refuserait.
  const monAvisDonne = benevoleId
    ? await missionRepository.avisExiste(id, benevoleId)
    : false;

  return { ...mission, avis, monAvisDonne };
}

/** Les missions du benevole connecte. */
export async function mesMissions(benevoleId) {
  const items = await missionRepository.listerMesMissions(benevoleId);
  return { items };
}

/**
 * Inscrit un benevole a une mission.
 *
 * @param {string} missionId
 * @param {string} utilisateurId compte connecte
 */
export async function sInscrire(missionId, utilisateurId) {
  return transaction(async (client) => {
    const fiche = await profileRepository.garantir(utilisateurId, client);
    if (!fiche) {
      throw new ErreurIntrouvable('La fiche bénévole', utilisateurId);
    }

    // Le verrou tient jusqu'au bout de la transaction : le comptage des
    // places qui suit ne peut plus etre double par une autre requete.
    const mission = await missionRepository.verrouiller(missionId, client);
    if (!mission || mission.statut === 'brouillon') {
      throw new ErreurIntrouvable('La mission', missionId);
    }

    if (mission.statut === 'annulee') {
      throw new ErreurRegleMetier('Cette mission a été annulée.', 'MISSION_ANNULEE');
    }
    if (mission.statut === 'terminee' || new Date(mission.dateDebut) < new Date()) {
      throw new ErreurRegleMetier(
        'Cette mission a déjà commencé : les inscriptions sont closes.',
        'MISSION_PASSEE'
      );
    }

    // Une mission de terrain expose le benevole et l'association : elle
    // demande une validation prealable de HOPE.
    if (mission.format === 'terrain' && !fiche.valideParHope) {
      throw new ErreurRegleMetier(
        'Les missions de terrain demandent une validation de votre profil par HOPE. Complétez votre profil, l’équipe vous validera.',
        'PROFIL_NON_VALIDE'
      );
    }
    if (mission.format === 'terrain' && !fiche.accepteTerrain) {
      throw new ErreurRegleMetier(
        'Votre profil indique que vous n’acceptez pas les missions de terrain.',
        'TERRAIN_REFUSE'
      );
    }

    const existante = await missionRepository.trouverInscription(missionId, fiche.id, client);

    if (existante && existante.statut !== 'annule') {
      throw new ErreurRegleMetier(
        'Vous êtes déjà inscrit à cette mission.',
        'DEJA_INSCRIT'
      );
    }

    if (mission.placesPrises >= mission.placesTotal) {
      throw new ErreurRegleMetier('Cette mission est complète.', 'MISSION_COMPLETE');
    }

    // Se reinscrire apres annulation : on reveille l'inscription
    // existante, la contrainte d'unicite interdisant d'en creer une
    // seconde sur le meme couple.
    if (existante) {
      await missionRepository.reactiverInscription(existante.id, client);
    } else {
      await missionRepository.creerInscription(missionId, fiche.id, client);
    }

    await missionRepository.ajusterCompletude(missionId, client);
    return missionRepository.trouverParId(missionId, fiche.id, client);
  });
}

/** Annule sa propre inscription. */
export async function seDesinscrire(missionId, utilisateurId, corps = {}) {
  const motif = typeof corps.motif === 'string' ? corps.motif.trim() : '';

  return transaction(async (client) => {
    const fiche = await profileRepository.garantir(utilisateurId, client);
    const mission = await missionRepository.verrouiller(missionId, client);
    if (!mission) throw new ErreurIntrouvable('La mission', missionId);

    const inscription = await missionRepository.trouverInscription(missionId, fiche.id, client);
    if (!inscription || inscription.statut === 'annule') {
      throw new ErreurRegleMetier('Vous n’êtes pas inscrit à cette mission.', 'PAS_INSCRIT');
    }
    if (inscription.statut === 'present') {
      throw new ErreurRegleMetier(
        'Cette mission est déjà effectuée : elle ne peut plus être annulée.',
        'MISSION_EFFECTUEE'
      );
    }

    await missionRepository.annulerInscription(inscription.id, motif || null, client);
    await missionRepository.ajusterCompletude(missionId, client);
    return missionRepository.trouverParId(missionId, fiche.id, client);
  });
}

/**
 * Laisse un avis sur une mission.
 *
 * Seule une presence constatee y donne droit : sans cela n'importe qui
 * pourrait noter une mission a laquelle il n'est jamais venu.
 */
export async function laisserUnAvis(missionId, utilisateurId, corps = {}) {
  const note = Number.parseInt(corps.note, 10);
  const commentaire = typeof corps.commentaire === 'string' ? corps.commentaire.trim() : '';

  if (!Number.isInteger(note) || note < 1 || note > 5) {
    throw new ErreurValidation('La note doit être un entier de 1 à 5.', {
      note: 'Entre 1 et 5',
    });
  }

  return transaction(async (client) => {
    const fiche = await profileRepository.garantir(utilisateurId, client);

    const inscription = await missionRepository.trouverInscription(missionId, fiche.id, client);
    if (!inscription || inscription.statut !== 'present') {
      throw new ErreurRegleMetier(
        'Vous ne pouvez donner un avis que sur une mission à laquelle vous avez participé.',
        'PARTICIPATION_REQUISE'
      );
    }

    if (await missionRepository.avisExiste(missionId, fiche.id, client)) {
      throw new ErreurRegleMetier(
        'Vous avez déjà donné votre avis sur cette mission.',
        'AVIS_DEJA_DONNE'
      );
    }

    return missionRepository.creerAvis(
      missionId,
      fiche.id,
      { note, commentaire: commentaire || null },
      client
    );
  });
}
