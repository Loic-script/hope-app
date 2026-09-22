/**
 * L'espace donateur : ses dons, un nouveau don, le fil d'actualite, les
 * projets, et sa photo de profil.
 *
 * Le parcours d'accueil (donorProfile.service) tient la fiche et les
 * preferences ; ce fichier tient ce que le donateur fait une fois chez lui.
 *
 * Un don fait ici est une PROMESSE : il part en statut PENDING, et
 * l'equipe le passe a RECEIVED quand l'argent arrive -- par le circuit
 * deja en place cote administration. Seuls les dons recus comptent dans
 * les totaux ; une promesse se lit a part, "en attente".
 */
import { transaction } from '../config/database.js';
import * as donationRepository from '../repositories/donation.repository.js';
import * as donorProfileRepository from '../repositories/donorProfile.repository.js';
import * as donorSpaceRepository from '../repositories/donorSpace.repository.js';
import * as notificationRepository from '../repositories/notification.repository.js';
import * as publicationRepository from '../repositories/publication.repository.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';
import { centimesVersTexte, depuisBase, enCentimes, normaliserDevise } from '../shared/money.js';
import { identifiantRequis, texteFacultatif, valeurParmi } from '../shared/validation.js';
import { FREQUENCES, MODES_PAIEMENT, projetsProposes } from './donorProfile.service.js';
import * as ficheProjetService from './ficheProjet.service.js';

/** Les statuts d'un don, tels que le donateur les lit. */
export const STATUTS_DON = {
  PENDING: 'En attente',
  RECEIVED: 'Reçu',
  FAILED: 'Non abouti',
  REFUNDED: 'Remboursé',
};

/** Le nom d'un pays, en francais, depuis son code ISO ("FR" -> "France"). */
const NOMS_DE_PAYS = new Intl.DisplayNames(['fr'], { type: 'region' });

function nomDuPays(code) {
  if (!code) return 'Madagascar';
  try {
    return NOMS_DE_PAYS.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Un don tel que l'espace le lit. */
function presenter(don) {
  return {
    ...don,
    statutLibelle: STATUTS_DON[don.statut] ?? don.statut,
  };
}

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
 * La fiche de don du compte, creee au premier don.
 *
 * Elle reprend l'identite du parcours d'accueil : nom, pays, structure --
 * la raison sociale d'une entreprise ou d'une association figurera sur
 * ses recus.
 */
async function ficheDeDon(compte, client) {
  const existante = await donorSpaceRepository.ficheDuCompte(compte.id, client);
  if (existante) return existante.id;

  const fiche = (await donorProfileRepository.trouver(compte.id, client)) ?? {};
  const cree = await donorSpaceRepository.creerFicheDuCompte(
    {
      utilisateurId: compte.id,
      prenom: fiche.prenom || compte.prenom || null,
      nom: fiche.nom || compte.nom || null,
      organisation: fiche.nomStructure || null,
      email: compte.email,
      telephone: fiche.telephone || compte.telephone || null,
      pays: nomDuPays(fiche.pays),
      ville: fiche.ville || null,
      origine: !fiche.pays || fiche.pays === 'MG' ? 'LOCAL' : 'INTERNATIONAL',
    },
    client
  );
  return cree.id;
}

/**
 * POST /api/donateur/dons : promettre un don.
 *
 * Affecte a un projet que l'on peut encore soutenir -- en cours, et dont
 * l'objectif n'est pas atteint --, ou laisse a HOPE, qui l'emploiera la
 * ou le besoin est le plus grand. Le don part en attente ; l'equipe est
 * prevenue dans sa cloche, et le confirme a reception.
 *
 * @param {object} compte  req.donateur
 * @param {{ affectation, projetId?, montant, devise?, mode, frequence, message? }} corps
 */
export async function faireUnDon(compte, corps = {}) {
  const affectation = valeurParmi(corps.affectation, 'affectation', ['PROJECT', 'HOPE']);

  let projet = null;
  if (affectation === 'PROJECT') {
    const projetId = identifiantRequis(corps.projetId, 'projetId');
    projet = (await projetsProposes()).find((p) => Number(p.id) === projetId);
    if (!projet) {
      throw new ErreurValidation('Ce projet ne reçoit pas de dons pour le moment.', {
        projetId: 'Projet indisponible',
      });
    }
    if (projet.atteint) {
      throw new ErreurValidation('L’objectif de ce projet est déjà atteint : choisissez-en un autre.', {
        projetId: 'Objectif atteint',
      });
    }
  }

  const montant = enCentimes(corps.montant, 'montant', { minimum: 100 });
  const devise = normaliserDevise(corps.devise || 'MGA', 'devise');
  const mode = MODES_PAIEMENT.find((m) => m.cle === corps.mode);
  if (!mode) {
    throw new ErreurValidation('Choisissez un mode de paiement.', { mode: 'Choix obligatoire' });
  }
  const frequence = valeurParmi(
    corps.frequence,
    'frequence',
    FREQUENCES.map((f) => f.cle)
  );
  const message = texteFacultatif(corps.message, 'message', { max: 500 });

  const don = await transaction(async (client) => {
    const donorId = await ficheDeDon(compte, client);
    const reference = await donationRepository.genererReference(client);

    const cree = await donationRepository.creer(
      {
        reference,
        donorId,
        donorAccountId: null,
        amount: centimesVersTexte(montant),
        currency: devise,
        allocation: affectation,
        projectId: projet ? Number(projet.id) : null,
        frequency: frequence,
        paymentMethod: mode.libelle,
        paymentReference: null,
        status: 'PENDING',
        receivedAt: null,
        message: message || null,
      },
      client
    );

    // L'equipe l'apprend dans sa cloche : c'est elle qui confirme la
    // reception, et le donateur attend ce retour.
    const qui = [compte.prenom, compte.nom].filter(Boolean).join(' ') || compte.email;
    await notificationRepository.creer(
      {
        type: 'DONATION',
        label:
          `Promesse de don : ${centimesVersTexte(montant)} ${devise} de ${qui} ` +
          `(${mode.libelle})${projet ? ` pour « ${projet.nom} »` : ''} — à confirmer à réception.`,
        donationId: cree.id,
        donorId,
        projectId: projet ? Number(projet.id) : null,
      },
      client
    );

    return cree;
  });

  const miens = await donorSpaceRepository.unDeMesDons(compte.id, don.id);
  return {
    don: presenter(miens),
    message:
      'Merci ! Votre promesse de don est enregistrée. L’équipe HOPE la confirme dès réception ' +
      'de votre paiement.',
  };
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
