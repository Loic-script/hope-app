import { transaction } from '../config/database.js';
import * as funderRepository from '../repositories/funder.repository.js';
import * as taskRepository from '../repositories/task.repository.js';
import * as depot from '../repositories/utilisateurs.repository.js';
import * as volunteerRepository from '../repositories/volunteer.repository.js';
import { ErreurIntrouvable, ErreurRegleMetier, ErreurValidation } from '../shared/errors.js';
import { identifiantRequis, texteFacultatif } from '../shared/validation.js';
import {
  FREQUENCES,
  LANGUES,
  MODES_PAIEMENT,
  SOURCES_CONNAISSANCE,
  TYPES_DONATEUR,
} from './donorProfile.service.js';

const ROLES = { donateurs: 'donateur', benevoles: 'benevole', bailleurs: 'bailleur' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function idCompte(id) {
  const texte = String(id ?? '').trim();
  if (!UUID.test(texte)) throw new ErreurIntrouvable('Le compte', id);
  return texte;
}

function nomComplet(prenom, nom) {
  return `${prenom ?? ''} ${nom ?? ''}`.replace(/\s+/g, ' ').trim();
}

function libelleDe(liste, cle) {
  if (!cle) return null;
  return liste.find((element) => element.cle === cle)?.libelle ?? cle;
}

function ligneCompte(compte, role) {
  const personne = nomComplet(compte.prenom, compte.nom);
  let nom = personne;
  let sousTitre = compte.email ?? compte.telephone ?? '';

  if (role === 'donateur' && compte.nomStructure) nom = compte.nomStructure;
  if (role === 'bailleur') {
    nom = compte.raisonSociale || personne;
    sousTitre = [personne, compte.email].filter(Boolean).join(' · ');
  }

  return {
    cle: `compte-${compte.id}`,
    genre: 'compte',
    id: compte.id,
    nom: nom || null,
    sousTitre,
    statut: compte.statut,
    creeLe: compte.creeLe,
    derniereConnexion: compte.derniereConnexion,
    parcoursInacheve: role === 'donateur' ? (compte.etapeSuivante ?? 1) <= 5 : undefined,
  };
}

function ligneFiche(fiche) {
  return {
    cle: `fiche-${fiche.id}`,
    genre: 'fiche',
    id: fiche.id,
    nom: fiche.organizationName || nomComplet(fiche.firstName, fiche.lastName) || null,
    sousTitre: fiche.email ?? ([fiche.city, fiche.country].filter(Boolean).join(', ') || ''),
    statut:
      fiche.compteStatut === 'ACTIVE'
        ? 'fiche_compte'
        : fiche.compteStatut === 'SUSPENDED'
          ? 'fiche_suspendue'
          : 'fiche',
    donsNombre: fiche.donsNombre,
    creeLe: fiche.createdAt,
  };
}

export async function lister(onglet, requete = {}) {
  const role = ROLES[onglet];
  if (!role) throw new ErreurIntrouvable('La liste', onglet);
  const recherche = texteFacultatif(requete.recherche, 'recherche', { max: 120 });

  const comptes = (await depot.listerComptes(role, recherche)).map((c) => ligneCompte(c, role));
  if (role !== 'donateur') return { items: comptes };

  const fiches = (await depot.listerFiches(recherche)).map(ligneFiche);
  const items = [...comptes, ...fiches].sort((a, b) =>
    (a.nom ?? '￿').localeCompare(b.nom ?? '￿', 'fr', { sensitivity: 'base' })
  );
  return { items };
}

async function dons(ficheIds) {
  const [liste, synthese] = await Promise.all([
    depot.donsDesFiches(ficheIds),
    depot.syntheseDons(ficheIds),
  ]);
  return {
    dons: liste,
    totaux: synthese.totaux,
    projets: synthese.projets,
    mensuels: liste.filter((don) => don.frequence === 'MONTHLY').length,
    enAttente: liste.filter((don) => don.statut === 'PENDING').length,
  };
}

function parcoursLisible(parcours) {
  if (!parcours) return null;
  return {
    ...parcours,
    sourceLibelle: libelleDe(SOURCES_CONNAISSANCE, parcours.sourceConnaissance),
    typeLibelle: libelleDe(TYPES_DONATEUR, parcours.typeDonateur),
    langueLibelle: libelleDe(LANGUES, parcours.langue),
    modePaiementLibelle: libelleDe(MODES_PAIEMENT, parcours.modePaiement),
    frequenceLibelle: libelleDe(FREQUENCES, parcours.frequence),
    affectationLibelle:
      parcours.affectation === 'PROJECT'
        ? 'Don affecté à un projet'
        : parcours.affectation === 'HOPE'
          ? 'Don non affecté (fonds HOPE)'
          : null,
    termine: (parcours.etapeSuivante ?? 1) > 5,
  };
}

function projetsDuBenevole(taches, missions) {
  const projets = new Map();
  const noter = (id, nom, cle) => {
    if (!id) return;
    const projet = projets.get(id) ?? { id, nom, taches: 0, missions: 0 };
    projet[cle] += 1;
    projets.set(id, projet);
  };
  taches.forEach((tache) => noter(tache.projetId, tache.projetNom, 'taches'));
  missions.forEach((mission) => noter(mission.projetId, mission.projetNom, 'missions'));
  return [...projets.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

export async function profilCompte(id) {
  const compte = await depot.trouverCompte(idCompte(id));
  if (!compte || compte.statut === 'supprime') throw new ErreurIntrouvable('Le compte', id);

  const roles = compte.roles ?? [];
  const profil = { genre: 'compte', compte, roles };

  if (roles.includes('donateur')) {
    const [parcours, fiches] = await Promise.all([
      depot.parcoursDonateur(compte.id),
      depot.fichesDeLAdresse(compte.email),
    ]);
    profil.donateur = { parcours: parcoursLisible(parcours), ...(await dons(fiches)) };
  }

  if (roles.includes('benevole')) {
    const fiche = await depot.ficheBenevole(compte.id);
    const [taches, missions] = fiche
      ? await Promise.all([
          taskRepository.lister({ membre: fiche.id }),
          depot.missionsDuBenevole(fiche.id),
        ])
      : [[], []];
    profil.benevole = {
      fiche,
      taches,
      missions,
      projets: projetsDuBenevole(taches, missions),
    };
  }

  if (roles.includes('bailleur')) {
    const organisation = await depot.organisationDuContact(compte.id);
    if (organisation) {
      const [engagements, versements, projets, totaux] = await Promise.all([
        funderRepository.listerEngagements(organisation.id),
        funderRepository.listerVersements(organisation.id),
        depot.projetsFinances(organisation.id),
        depot.totauxBailleur(organisation.id),
      ]);
      profil.bailleur = { organisation, engagements, versements, projets, totaux };
    } else {
      profil.bailleur = { organisation: null, engagements: [], versements: [], projets: [], totaux: [] };
    }
  }

  return profil;
}

export async function profilFiche(id) {
  const ficheId = identifiantRequis(id, 'id');
  const fiche = await depot.trouverFiche(ficheId);
  if (!fiche) throw new ErreurIntrouvable('Le donateur', ficheId);
  return { genre: 'fiche', fiche, ...(await dons([ficheId])) };
}

function texteCourt(valeur, champ, max) {
  const texte = String(valeur ?? '').trim();
  if (texte.length > max) {
    throw new ErreurValidation(`Le champ « ${champ} » fait au plus ${max} caractères.`, {
      [champ]: `Au plus ${max} caractères`,
    });
  }
  return texte;
}

export async function modifierCompte(id, corps = {}) {
  const compte = await depot.trouverCompte(idCompte(id));
  if (!compte || compte.statut === 'supprime') throw new ErreurIntrouvable('Le compte', id);
  const roles = compte.roles ?? [];

  const details = {};
  const prenom = texteCourt(corps.prenom, 'prenom', 80);
  const nom = texteCourt(corps.nom, 'nom', 80);
  const email = texteCourt(corps.email, 'email', 160).toLowerCase();
  const telephone = texteCourt(corps.telephone, 'telephone', 20) || null;

  if (email === '') details.email = 'Champ obligatoire';
  else if (!COURRIEL.test(email)) details.email = 'Adresse électronique invalide';

  let raisonSociale;
  if (roles.includes('bailleur') && corps.raisonSociale !== undefined) {
    raisonSociale = texteCourt(corps.raisonSociale, 'raisonSociale', 200);
    if (raisonSociale === '') details.raisonSociale = 'Champ obligatoire';
  }
  const nomStructure =
    roles.includes('donateur') && corps.nomStructure !== undefined
      ? texteCourt(corps.nomStructure, 'nomStructure', 200) || null
      : undefined;

  if (Object.keys(details).length > 0) {
    throw new ErreurValidation('Certains champs sont à corriger.', details);
  }

  try {
    await transaction(async (client) => {
      await depot.modifierCompte(compte.id, { nom, prenom, email, telephone }, client);
      if (nomStructure !== undefined) {
        await depot.modifierNomStructure(compte.id, nomStructure, client);
      }
      if (raisonSociale !== undefined) {
        const organisation = await depot.organisationDuContact(compte.id, client);
        if (organisation) await depot.modifierRaisonSociale(organisation.id, raisonSociale, client);
      }
    });
  } catch (erreur) {
    if (erreur?.code === '23505') {
      const contrainte = String(erreur.constraint ?? '');
      const champ = contrainte.includes('telephone') ? 'telephone' : 'email';
      throw new ErreurValidation(
        champ === 'telephone'
          ? 'Ce numéro de téléphone est déjà utilisé par un autre compte.'
          : 'Cette adresse est déjà utilisée par un autre compte.',
        { [champ]: 'Déjà utilisé par un autre compte' }
      );
    }
    throw erreur;
  }

  return profilCompte(compte.id);
}

export async function supprimerCompte(id, admin = null) {
  const compte = await depot.trouverCompte(idCompte(id));
  if (!compte || compte.statut === 'supprime') throw new ErreurIntrouvable('Le compte', id);
  await volunteerRepository.changerStatut(compte.id, 'supprime', admin?.id ?? null);
  return { supprime: true };
}

export async function supprimerFiche(id, options = {}) {
  const ficheId = identifiantRequis(id, 'id');
  const fiche = await depot.trouverFiche(ficheId);
  if (!fiche) throw new ErreurIntrouvable('Le donateur', ficheId);

  const nombre = await depot.compterDonsDeFiche(ficheId);
  if (nombre === 0) {
    await depot.supprimerFiche(ficheId);
    return { supprime: true, dons: 0 };
  }

  const dons = `${nombre} don${nombre > 1 ? 's' : ''} enregistré${nombre > 1 ? 's' : ''}`;

  if (options.avecDons) {
    await transaction(async (client) => {
      await depot.supprimerDonsDeFiche(ficheId, client);
      await depot.supprimerFiche(ficheId, client);
    });
    return {
      supprime: true,
      dons: nombre,
      message: `Fiche supprimée avec ses ${dons}. Les sommes reçues par les projets concernés ont diminué d’autant.`,
    };
  }

  if (!options.forcer) {
    throw new ErreurRegleMetier(
      `Ce donateur a ${dons} : il ne peut pas être supprimé sans effacer l’historique des ` +
        'projets qu’il a soutenus. Vous pouvez effacer son identité : ses dons resteront, sans son nom.',
      'DONATEUR_AVEC_DONS'
    );
  }

  await depot.anonymiserFiche(ficheId);
  return {
    supprime: true,
    anonymise: true,
    dons: nombre,
    message: `L’identité de ce donateur est effacée. Ses ${dons} restent au compte des projets, sans son nom.`,
  };
}
