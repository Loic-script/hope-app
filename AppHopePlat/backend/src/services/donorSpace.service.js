/**
 * L'espace donateur : ses dons, un nouveau don, le fil d'actualite, les
 * projets, et sa photo de profil.
 *
 * Le parcours d'accueil (donorProfile.service) tient la fiche et les
 * preferences ; ce fichier tient ce que le donateur fait une fois chez lui.
 *
 * Un don fait ici est une PROMESSE (promesseDon.service, commun aux
 * espaces) : il part en statut PENDING, et l'equipe le passe a RECEIVED
 * quand l'argent arrive. Seuls les dons recus comptent dans les totaux ;
 * une promesse se lit a part, "en attente".
 */
import * as donorProfileRepository from '../repositories/donorProfile.repository.js';
import * as donorSpaceRepository from '../repositories/donorSpace.repository.js';
import * as publicationRepository from '../repositories/publication.repository.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';
import { centimesVersTexte, depuisBase } from '../shared/money.js';
import { identifiantRequis } from '../shared/validation.js';
import { projetsProposes } from './donorProfile.service.js';
import * as ficheProjetService from './ficheProjet.service.js';
import { nomDuPays, origineDuPays, presenter, promettreUnDon } from './promesseDon.service.js';

/**
 * Les totaux du donateur, par devise : un don en euros ne s'additionne
 * pas a un don en ariary. Seuls les dons recus comptent ; les promesses
 * se comptent a part.
 */
function synthese(dons) {
  const parDevise = new Map();
  for (const don of dons) {
    const ligne = parDevise.get(don.devise) ?? { devise: don.devise, recu: 0, enAttente: 0 };
    if (don.statut === 'RECEIVED') ligne.recu += depuisBase(don.montant);
    if (don.statut === 'PENDING') ligne.enAttente += depuisBase(don.montant);
    parDevise.set(don.devise, ligne);
  }

  const recus = dons.filter((d) => d.statut === 'RECEIVED');
  // Des dates ISO : triees comme du texte, elles le sont dans le temps.
  const dates = recus
    .map((d) => d.recuLe)
    .filter(Boolean)
    .map((d) => new Date(d).toISOString())
    .sort();

  return {
    totaux: [...parDevise.values()]
      .map((ligne) => ({
        devise: ligne.devise,
        recu: centimesVersTexte(ligne.recu),
        enAttente: centimesVersTexte(ligne.enAttente),
      }))
      .sort((a, b) => Number(b.recu) - Number(a.recu)),
    nombreRecus: recus.length,
    nombreEnAttente: dons.filter((d) => d.statut === 'PENDING').length,
    projetsSoutenus: new Set(recus.filter((d) => d.projetId).map((d) => d.projetId)).size,
    premierDon: dates[0] ?? null,
    dernierDon: dates[dates.length - 1] ?? null,
  };
}

/** GET /api/donateur/dons : ses dons, et ce qu'ils font ensemble. */
export async function mesDons(utilisateurId) {
  const dons = (await donorSpaceRepository.mesDons(utilisateurId)).map(presenter);
  return { items: dons, synthese: synthese(dons) };
}

/**
 * Qui donne, depuis l'espace donateur : l'identite de son parcours
 * d'accueil -- nom, pays, structure. La raison sociale d'une entreprise
 * ou d'une association figurera sur ses recus.
 */
function identiteDonateur(compte) {
  return {
    utilisateurId: compte.id,
    qui: [compte.prenom, compte.nom].filter(Boolean).join(' ') || compte.email,
    origine: 'donateur',
    nouvelleFiche: async (client) => {
      const fiche = (await donorProfileRepository.trouver(compte.id, client)) ?? {};
      return {
        prenom: fiche.prenom || compte.prenom || null,
        nom: fiche.nom || compte.nom || null,
        organisation: fiche.nomStructure || null,
        email: compte.email,
        telephone: fiche.telephone || compte.telephone || null,
        pays: nomDuPays(fiche.pays),
        ville: fiche.ville || null,
        origine: origineDuPays(fiche.pays),
      };
    },
  };
}

/**
 * POST /api/donateur/dons : promettre un don -- ponctuel ou mensuel.
 * Voir promesseDon.service.
 *
 * @param {object} compte  req.donateur
 */
export async function faireUnDon(compte, corps = {}) {
  return promettreUnDon(identiteDonateur(compte), corps);
}

/**
 * GET /api/donateur/actualites : les nouvelles de HOPE.
 *
 * Les actualites seules, comme chez le benevole : un appel a financement
 * s'adresse aux partenaires, et le donateur a son propre bouton de don.
 */
export async function actualites() {
  return { items: await publicationRepository.listerPourBenevole() };
}

/**
 * GET /api/donateur/projets/:id : la fiche d'un projet, et ce que le
 * donateur y a donne.
 */
export async function projet(utilisateurId, projetId) {
  const id = identifiantRequis(projetId, 'id');
  const lisible = await donorSpaceRepository.projetLisible(utilisateurId, id);
  if (!lisible) throw new ErreurIntrouvable('Le projet', projetId);

  const [fiche, dons, proposes] = await Promise.all([
    ficheProjetService.ficheHorsAdmin(lisible.id),
    donorSpaceRepository.mesDons(utilisateurId),
    projetsProposes(),
  ]);

  const auProjet = dons.filter((d) => Number(d.projetId) === Number(lisible.id));
  const propose = proposes.find((p) => Number(p.id) === Number(lisible.id));

  return {
    ...fiche,
    // Ce que le donateur y a mis : recu, et promis.
    vosDons: synthese(auProjet.map(presenter)),
    // Peut-on encore y donner ? En cours, objectif non atteint.
    ouvertAuxDons: Boolean(propose && !propose.atteint),
  };
}

/**
 * PATCH /api/donateur/profil/photo : poser ou retirer sa photo.
 *
 * Seule une adresse servie par HOPE est acceptee : la photo se televerse
 * d'abord (POST /profil/photo), puis se rattache ici.
 */
export async function changerPhoto(utilisateurId, corps = {}) {
  const valeur = corps.photoUrl;
  let photoUrl = null;
  if (valeur !== null && valeur !== undefined && String(valeur).trim() !== '') {
    photoUrl = String(valeur).trim();
    if (!/^\/media\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(photoUrl)) {
      throw new ErreurValidation('La photo doit être téléversée depuis votre espace.', {
        photoUrl: 'Adresse non acceptée',
      });
    }
  }
  await donorSpaceRepository.mettreAJourPhoto(utilisateurId, photoUrl);
  return { photoUrl };
}
