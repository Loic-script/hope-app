import { config } from '../config/env.js';
import * as donorProfileRepository from '../repositories/donorProfile.repository.js';
import * as donorSpaceRepository from '../repositories/donorSpace.repository.js';
import * as publicationRepository from '../repositories/publication.repository.js';
import { ErreurIntrouvable, ErreurValidation } from '../shared/errors.js';
import { centimesVersTexte, depuisBase } from '../shared/money.js';
import { identifiantRequis } from '../shared/validation.js';
import { projetsProposes } from './donorProfile.service.js';
import * as ficheProjetService from './ficheProjet.service.js';
import {
  declarerJustificatif,
  nomDuPays,
  origineDuPays,
  presenter,
  promettreUnDon,
} from './promesseDon.service.js';

function synthese(dons) {
  const parDevise = new Map();
  for (const don of dons) {
    const ligne = parDevise.get(don.devise) ?? { devise: don.devise, recu: 0, enAttente: 0 };
    if (don.statut === 'RECEIVED') ligne.recu += depuisBase(don.montant);
    if (don.statut === 'PENDING') ligne.enAttente += depuisBase(don.montant);
    parDevise.set(don.devise, ligne);
  }

  const recus = dons.filter((d) => d.statut === 'RECEIVED');
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

export async function mesDons(utilisateurId) {
  const dons = (await donorSpaceRepository.mesDons(utilisateurId)).map(presenter);
  return { items: dons, synthese: synthese(dons) };
}

export function identiteDonateur(compte) {
  return {
    utilisateurId: compte.id,
    qui: [compte.prenom, compte.nom].filter(Boolean).join(' ') || compte.email,
    email: compte.email,
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

export function compteMvola() {
  return compteOperateur(config.mvola);
}

export function compteOrangeMoney() {
  return compteOperateur(config.orangeMoney);
}

export function coordonneesDePaiement() {
  const { banque, bureau, plateformes, equipe } = config;
  const rib = String(banque.rib ?? '').replace(/\D/g, '');
  const iban = String(banque.iban ?? '').replace(/\s/g, '').toUpperCase();
  return {
    banque: {
      disponible: rib.length === 23,
      internationalDisponible: /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban) && /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(banque.bic),
      nom: banque.nom,
      agence: banque.agence,
      titulaire: banque.titulaire,
      rib,
      iban,
      bic: String(banque.bic ?? '').toUpperCase(),
      adresse: banque.adresse,
    },
    bureau: {
      disponible: Boolean(bureau.adresse),
      adresse: bureau.adresse,
      horaires: bureau.horaires,
      telephone: equipe.telephone,
    },
    plateformes: {
      retrait: plateformes.retraitNom
        ? { nom: plateformes.retraitNom, ville: plateformes.retraitVille }
        : null,
      mvola: compteMvola(),
      orangeMoney: compteOrangeMoney(),
    },
  };
}

export async function declarerPaiement(compte, donId, corps = {}) {
  const id = identifiantRequis(donId, 'id');
  const don = await donorSpaceRepository.unDeMesDons(compte.id, id);
  if (!don) throw new ErreurIntrouvable('Le don', donId);
  if (don.statut !== 'PENDING') {
    throw new ErreurValidation('Ce don n’est plus en attente : il a déjà été traité par l’équipe.', {
      statut: 'Don déjà traité',
    });
  }
  return declarerJustificatif(compte, don, corps);
}

function compteOperateur({ numero, titulaire }) {
  const chiffres = String(numero ?? '').replace(/\D/g, '');
  return {
    disponible: /^03[2-9]\d{7}$/.test(chiffres),
    numero: chiffres,
    titulaire,
  };
}

export async function faireUnDon(compte, corps = {}) {
  return promettreUnDon(identiteDonateur(compte), corps);
}

export async function actualites() {
  return { items: await publicationRepository.listerPourBenevole() };
}

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
    vosDons: synthese(auProjet.map(presenter)),
    ouvertAuxDons: Boolean(propose && !propose.atteint),
  };
}

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
