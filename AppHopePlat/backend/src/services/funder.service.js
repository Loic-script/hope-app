import fs from 'node:fs/promises';
import path from 'node:path';

import * as donorSpaceRepository from '../repositories/donorSpace.repository.js';
import * as funderRepository from '../repositories/funder.repository.js';
import * as projectRepository from '../repositories/project.repository.js';
import { TYPES_ORGANISATION } from './funderAuth.service.js';
import { signalerInteretBailleur } from './notification.service.js';
import * as ficheProjetService from './ficheProjet.service.js';
import * as projectReportService from './projectReport.service.js';
import { DOSSIER_MEDIAS, PREFIXE_MEDIAS } from '../middleware/upload.middleware.js';
import { ErreurIntrouvable, ErreurRegleMetier, ErreurValidation } from '../shared/errors.js';
import { centimesVersTexte, depuisBase, pourcentage } from '../shared/money.js';

export const TYPES_DOCUMENT = {
  rapport_impact: 'Rapport d’impact',
  justificatif_financier: 'Justificatif financier',
  certificat: 'Certificat',
  convention: 'Convention',
};

function parmi(valeur, champ, autorises) {
  const texte = String(valeur ?? '').trim().toLowerCase();
  if (!autorises.includes(texte)) {
    throw new ErreurValidation(`Le champ "${champ}" doit valoir : ${autorises.join(', ')}.`, {
      [champ]: 'Valeur non autorisée',
    });
  }
  return texte;
}

function avecPart(lignes, champ = 'montant') {
  const total = lignes.reduce((somme, ligne) => somme + Number(ligne[champ] ?? 0), 0);
  return lignes.map((ligne) => ({
    ...ligne,
    part: total > 0 ? Math.round((Number(ligne[champ] ?? 0) * 1000) / total) / 10 : 0,
  }));
}

export async function tableauDeBord(bailleurId) {
  const [indicateurs, domaines, zones, projets, versements, origine, distinctions] =
    await Promise.all([
      funderRepository.indicateurs(bailleurId),
      funderRepository.repartitionParDomaine(bailleurId),
      funderRepository.zonesDIntervention(bailleurId),
      funderRepository.projetsVisibles(bailleurId),
      funderRepository.listerVersements(bailleurId, { recusSeulement: true }),
      funderRepository.origineDesFonds(),
      funderRepository.listerDistinctions(bailleurId),
    ]);

  const institutionnel = Number(origine.institutionnel ?? 0);
  const individuel = Number(origine.individuel ?? 0);
  const totalFonds = institutionnel + individuel;

  return {
    indicateurs: {
      montantEngage: Number(indicateurs.montantEngage ?? 0),
      montantRecu: Number(indicateurs.montantRecu ?? 0),
      montantAttendu: Number(indicateurs.montantAttendu ?? 0),
      tauxExecution: Number(indicateurs.tauxExecution ?? 0),
      projetsFinances: indicateurs.projetsFinances ?? 0,
      beneficiairesTouches: indicateurs.beneficiairesTouches ?? 0,
    },
    domaines: avecPart(domaines),
    zones,
    projets: projets.map(presenterProjet),
    versements: versements.slice(0, 10),
    origineDesFonds: {
      institutionnel,
      individuel,
      partInstitutionnel: totalFonds > 0 ? Math.round((institutionnel * 100) / totalFonds) : 0,
      partIndividuel: totalFonds > 0 ? Math.round((individuel * 100) / totalFonds) : 0,
    },
    distinctions,
  };
}

export async function partenariat(bailleurId) {
  const [engagements, versements, affectations] = await Promise.all([
    funderRepository.listerEngagements(bailleurId),
    funderRepository.listerVersements(bailleurId),
    funderRepository.listerAffectations(bailleurId),
  ]);

  const enrichis = engagements.map((engagement) => {
    const financier = engagement.typeSoutien === 'financier';

    const engage = Number(engagement.montantEngage ?? 0);
    const recu = Number(engagement.montantRecu ?? 0);
    const engagee = Number(engagement.quantiteEngagee ?? 0);
    const realisee = Number(engagement.quantiteRealisee ?? 0);

    const avancement = financier
      ? engage > 0
        ? Math.round((recu * 1000) / engage) / 10
        : 0
      : engagee > 0
        ? Math.round((realisee * 1000) / engagee) / 10
        : 0;

    return {
      ...engagement,
      avancement,
      resteAAffecter: financier
        ? Math.max(0, engage - Number(engagement.montantAffecte ?? 0))
        : null,
      versements: versements.filter((v) => v.engagementId === engagement.id),
      affectations: affectations.filter((a) => a.engagementId === engagement.id),
    };
  });

  const groupes = ['financier', 'competences', 'materiel'].map((type) => ({
    type,
    engagements: enrichis.filter((e) => e.typeSoutien === type),
  }));

  return { groupes, engagements: enrichis };
}

export async function versements(bailleurId, requete = {}) {
  const recusSeulement = requete.recus === 'true' || requete.recus === true;
  const items = await funderRepository.listerVersements(bailleurId, { recusSeulement });
  return { items };
}

const ETAT_DON = { RECEIVED: 'recu', PENDING: 'en_attente' };
const ETAT_VERSEMENT = { recu: 'recu', attendu: 'en_attente', en_retard: 'en_attente' };

export async function paiements(bailleur) {
  const [dons, versements] = await Promise.all([
    bailleur.utilisateurId ? donorSpaceRepository.mesDons(bailleur.utilisateurId) : [],
    funderRepository.listerVersements(bailleur.bailleurId),
  ]);

  const items = [
    ...dons
      .filter((don) => ETAT_DON[don.statut])
      .map((don) => ({
        id: `don-${don.id}`,
        source: 'don',
        montant: don.montant,
        devise: don.devise,
        etat: ETAT_DON[don.statut],
        date: don.recuLe ?? don.creeLe,
        libelle: don.projetNom ?? 'Fonds général de HOPE',
        projetId: don.projetId ?? null,
        moyen: don.modePaiement ?? null,
        reference: don.reference ?? null,
      })),
    ...versements
      .filter((v) => ETAT_VERSEMENT[v.statut])
      .map((v) => ({
        id: `versement-${v.id}`,
        source: 'convention',
        montant: v.montant,
        devise: v.devise,
        etat: ETAT_VERSEMENT[v.statut],
        enRetard: v.statut === 'en_retard',
        date: v.dateRecue ?? v.datePrevue,
        libelle: v.engagementIntitule,
        tranche: v.numeroTranche ?? null,
        moyen: v.moyen ?? null,
        reference: v.referenceBancaire ?? null,
      })),
  ].sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0));

  const parDevise = new Map();
  for (const p of items) {
    const ligne = parDevise.get(p.devise) ?? { devise: p.devise, paye: 0, enAttente: 0 };
    if (p.etat === 'recu') ligne.paye += depuisBase(p.montant);
    else ligne.enAttente += depuisBase(p.montant);
    parDevise.set(p.devise, ligne);
  }
  const recus = items.filter((p) => p.etat === 'recu');

  return {
    items,
    synthese: {
      totaux: [...parDevise.values()]
        .map((l) => ({ devise: l.devise, paye: centimesVersTexte(l.paye), enAttente: centimesVersTexte(l.enAttente) }))
        .sort((a, b) => Number(b.paye) - Number(a.paye)),
      nombrePayes: recus.length,
      nombreEnAttente: items.length - recus.length,
      dernierPaiement: recus[0]?.date ?? null,
    },
  };
}

function presenterProjet(projet) {
  return {
    ...projet,
    tauxFinancement: pourcentage(
      depuisBase(projet.montantFinance),
      depuisBase(projet.requiredBudget)
    ),
    financeParMoi: Number(projet.montantAffecte ?? 0) > 0,
  };
}

export async function projets(bailleurId) {
  const items = await funderRepository.projetsVisibles(bailleurId);
  return { items: items.map(presenterProjet) };
}

async function projetLisible(bailleurId, projetId) {
  const texte = String(projetId ?? '');
  const projet = /^[1-9]\d{0,8}$/.test(texte)
    ? await funderRepository.projetVisible(bailleurId, Number(texte))
    : null;
  if (!projet) throw new ErreurIntrouvable('Le projet', projetId);
  return projet;
}

export async function projet(bailleurId, projetId) {
  const visible = await projetLisible(bailleurId, projetId);
  return ficheProjetService.ficheHorsAdmin(visible.id, { bailleurId });
}

export async function rapportProjet(bailleurId, projetId) {
  const projet = await projetLisible(bailleurId, projetId);
  const rapport = await projectReportService.rapportDuJour(projet.id);
  return {
    projet: { id: projet.id, reference: projet.reference, nom: projet.name },
    ...rapport,
  };
}

export async function pdfRapportProjet(bailleurId, projetId, contact) {
  if (contact && contact.peutTelecharger === false) {
    throw new ErreurRegleMetier(
      'Votre accès est limité à la consultation : le téléchargement n’est pas autorisé.',
      'TELECHARGEMENT_INTERDIT'
    );
  }
  const projet = await projetLisible(bailleurId, projetId);
  return projectReportService.pdf(projet.id);
}

export async function documents(bailleurId, requete = {}) {
  const type = requete.type && requete.type !== 'tous'
    ? parmi(requete.type, 'type', Object.keys(TYPES_DOCUMENT))
    : null;

  const [items, compteurs] = await Promise.all([
    funderRepository.listerDocuments(bailleurId, { type }),
    funderRepository.compterDocuments(bailleurId),
  ]);

  return {
    items,
    counts: {
      ...compteurs,
      tous: Object.values(compteurs).reduce((somme, n) => somme + n, 0),
    },
  };
}

export async function apercuDocument(bailleurId, documentId) {
  const document = await funderRepository.apercuDocument(bailleurId, documentId);
  if (!document) throw new ErreurIntrouvable('Le document', documentId);

  const contenu = document.contenu ?? null;
  const blocs = Array.isArray(contenu?.blocs) ? contenu.blocs : null;

  return {
    id: document.id,
    type: document.type,
    titre: document.titre,
    sousTitre: contenu?.sousTitre ?? sousTitreParDefaut(document),
    periodeDebut: document.periodeDebut,
    periodeFin: document.periodeFin,
    publieLe: document.publieLe,
    nbPages: document.nbPages,
    engagementIntitule: document.engagementIntitule,
    projetNom: document.projetNom,
    blocs,
  };
}

function sousTitreParDefaut(document) {
  const morceaux = [];
  if (document.periodeDebut && document.periodeFin) {
    morceaux.push(`Période du ${dateFr(document.periodeDebut)} au ${dateFr(document.periodeFin)}`);
  }
  if (document.publieLe) morceaux.push(`Publié le ${dateFr(document.publieLe)}`);
  return morceaux.join(' · ');
}

function dateFr(valeur) {
  const date = valeur instanceof Date ? valeur : new Date(valeur);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR');
}

export async function telecharger(bailleurId, documentId, contact) {
  if (contact && contact.peutTelecharger === false) {
    throw new ErreurRegleMetier(
      'Votre accès est limité à la consultation : le téléchargement n’est pas autorisé.',
      'TELECHARGEMENT_INTERDIT'
    );
  }

  const document = await funderRepository.trouverDocument(bailleurId, documentId);
  if (!document) throw new ErreurIntrouvable('Le document', documentId);

  const compteur = await funderRepository.marquerTelechargement(documentId);

  return {
    id: document.id,
    titre: document.titre,
    fichierUrl: document.fichierUrl,
    nbTelechargements: compteur.nbTelechargements,
    telechargeLe: compteur.telechargeLe,
  };
}

export async function genererCertificat(bailleurId, bailleur) {
  const [indicateurs, domaines, numero] = await Promise.all([
    funderRepository.indicateurs(bailleurId),
    funderRepository.repartitionParDomaine(bailleurId),
    funderRepository.prochainNumeroCertificat(),
  ]);

  if (Number(indicateurs.montantEngage ?? 0) <= 0) {
    throw new ErreurRegleMetier(
      'Aucun engagement enregistré : le certificat sera disponible dès votre premier partenariat.',
      'AUCUN_ENGAGEMENT'
    );
  }

  const reference = `HFBL-PART-${String(numero).padStart(6, '0')}`;
  const pdf = construireCertificat({
    reference,
    raisonSociale: bailleur.raisonSociale,
    partenaireDepuis: bailleur.partenaireDepuis,
    montantEngage: Number(indicateurs.montantEngage ?? 0),
    beneficiaires: indicateurs.beneficiairesTouches ?? 0,
    projets: indicateurs.projetsFinances ?? 0,
    domaines: domaines.map((d) => d.domaine),
  });

  await fs.mkdir(DOSSIER_MEDIAS, { recursive: true });
  const nomDisque = `certificat-${reference}.pdf`;
  await fs.writeFile(path.join(DOSSIER_MEDIAS, nomDisque), pdf);

  const document = await funderRepository.creerDocument(bailleurId, {
    type: 'certificat',
    titre: `Certificat de partenariat ${reference}`,
    fichierUrl: `${PREFIXE_MEDIAS}/${nomDisque}`,
    nbPages: 1,
    contenu: {
      sousTitre: `Édité le ${dateFr(new Date())} · Référence ${reference}`,
      blocs: [
        { t: 'h2', texte: 'Partenaire' },
        { t: 'p', texte: bailleur.raisonSociale },
        { t: 'kv', lignes: [
          ['Référence', reference],
          ['Partenaire de HOPE depuis', bailleur.partenaireDepuis ?? '—'],
          ['Montant engagé', `${Number(indicateurs.montantEngage ?? 0).toLocaleString('fr-FR')} Ar`],
          ['Projets financés', String(indicateurs.projetsFinances ?? 0)],
          ['Bénéficiaires touchés', String(indicateurs.beneficiairesTouches ?? 0)],
          ['Domaines', domaines.map((d) => d.domaine).join(', ') || '—'],
        ] },
        { t: 'h2', texte: 'Attestation' },
        { t: 'p', texte:
          'Ce certificat atteste du partenariat établi entre HOPE et l’organisation nommée ' +
          'ci-dessus. Il est généré automatiquement depuis les engagements enregistrés à la ' +
          'date d’édition.' },
      ],
    },
  });

  return { ...document, reference };
}

function construireCertificat(donnees) {
  const montant = Number(donnees.montantEngage).toLocaleString('fr-FR');

  const lignes = [
    ['/F2 22 Tf', 70, 760, 'HOPE - Hope for a Better Life'],
    ['/F1 12 Tf', 70, 735, 'Certificat de partenariat'],
    ['/F1 10 Tf', 70, 715, `Reference : ${donnees.reference}`],
    ['/F2 17 Tf', 70, 660, donnees.raisonSociale],
    ['/F1 11 Tf', 70, 632, `Partenaire de HOPE depuis le ${donnees.partenaireDepuis ?? '-'}`],
    ['/F1 11 Tf', 70, 590, `Montant engage : ${montant} Ar`],
    ['/F1 11 Tf', 70, 570, `Projets finances : ${donnees.projets}`],
    ['/F1 11 Tf', 70, 550, `Beneficiaires touches : ${donnees.beneficiaires}`],
    ['/F1 11 Tf', 70, 530, `Domaines : ${donnees.domaines.join(', ') || '-'}`],
    ['/F1 10 Tf', 70, 470, 'Ce certificat atteste du partenariat etabli entre HOPE et'],
    ['/F1 10 Tf', 70, 455, "l'organisation nommee ci-dessus. Il est genere automatiquement"],
    ['/F1 10 Tf', 70, 440, 'depuis les engagements enregistres a la date d edition.'],
    ['/F1 9 Tf', 70, 100, `Edite le ${new Date().toISOString().slice(0, 10)} - HOPE, Madagascar`],
  ];

  const echapper = (texte) => texte.replace(/([\\()])/g, '\\$1');

  const contenu = lignes
    .map(([police, x, y, texte]) => `BT ${police} ${x} ${y} Td (${echapper(texte)}) Tj ET`)
    .join('\n');

  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R ' +
      '/Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${contenu.length} >>\nstream\n${contenu}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];

  let pdf = '%PDF-1.4\n';
  const positions = [];
  objets.forEach((objet, index) => {
    positions.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${objet}\nendobj\n`;
  });

  const debutXref = pdf.length;
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  for (const position of positions) {
    pdf += `${String(position).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

export async function fil(bailleurId) {
  const items = await funderRepository.listerPublications(bailleurId);

  return {
    items: items.map(({ photoPropre, photoProjet, ...publication }) => {
      const budget = depuisBase(publication.budgetProjet);
      const finance = depuisBase(publication.montantFinance);
      const avecBarre =
        publication.type === 'appel_financement' && publication.projetId !== null && budget > 0;
      return {
        ...publication,
        avancement: avecBarre ? pourcentage(finance, budget) : null,
        objectifAtteint: avecBarre && finance >= budget,
        projetTermine: avecBarre && publication.projetStatut !== 'IN_PROGRESS',
      };
    }),
  };
}

export async function manifesterUnInteret(bailleurId, corps = {}, contact = null) {
  const publicationId = typeof corps.publicationId === 'string' ? corps.publicationId : null;
  const projetId = corps.projetId ? Number.parseInt(corps.projetId, 10) : null;
  const message = typeof corps.message === 'string' ? corps.message.trim() : '';

  if (!publicationId && !projetId) {
    throw new ErreurValidation('Indiquez la publication ou le projet concerné.', {
      publicationId: 'Champ obligatoire',
    });
  }

  const manifestation = await funderRepository.creerManifestation(bailleurId, {
    publicationId,
    projetId,
    message: message || null,
    contactId: contact?.contactId ?? null,
  });

  const projet = projetId ? await projectRepository.trouverParId(projetId) : null;
  await signalerInteretBailleur({
    organisation: contact?.raisonSociale || 'Un partenaire',
    projet: projet?.name ?? null,
    projetId,
  });

  return {
    ...manifestation,
    message:
      'Votre intérêt est transmis à l’équipe HOPE. Elle vous contactera pour formaliser le partenariat — aucun montant n’a été débité.',
  };
}

export async function mettreAJourOrganisation(bailleurId, corps = {}) {
  const texte = (valeur, max) => {
    const propre = typeof valeur === 'string' ? valeur.trim() : '';
    if (propre === '') return null;
    return propre.length > max ? propre.slice(0, max) : propre;
  };

  const raisonSociale = texte(corps.raisonSociale, 200);
  const typeOrganisation = String(corps.typeOrganisation ?? '').trim().toLowerCase();

  const details = {};
  if (!raisonSociale) details.raisonSociale = 'Champ obligatoire';
  if (typeOrganisation === '') details.typeOrganisation = 'Champ obligatoire';
  else if (!TYPES_ORGANISATION.includes(typeOrganisation)) {
    details.typeOrganisation = `Types acceptés : ${TYPES_ORGANISATION.join(', ')}`;
  }
  if (Object.keys(details).length > 0) {
    throw new ErreurValidation('Le formulaire comporte des erreurs.', details);
  }

  await funderRepository.mettreAJourOrganisation(bailleurId, {
    raison_sociale: raisonSociale,
    type_organisation: typeOrganisation,
    secteur: texte(corps.secteur, 120),
    pays: texte(corps.pays, 80) ?? 'Madagascar',
    adresse: texte(corps.adresse, 2000),
    site_web: texte(corps.siteWeb, 500),
    nif: texte(corps.nif, 40),
  });

  return {
    success: true,
    message: 'La fiche de votre organisation est à jour.',
  };
}

export async function profil(bailleurId) {
  const [contacts, distinctions] = await Promise.all([
    funderRepository.listerContacts(bailleurId),
    funderRepository.listerDistinctions(bailleurId),
  ]);
  return { contacts, distinctions };
}

function photoValide(valeur) {
  if (valeur === null || String(valeur).trim() === '') return null;

  const adresse = String(valeur).trim();
  if (!adresse.startsWith('/media/')) {
    throw new ErreurValidation('La photo doit être téléversée depuis votre espace.', {
      photoUrl: 'Adresse non acceptée',
    });
  }
  return adresse;
}

export async function mettreAJourContact(contactId, corps = {}) {
  const texte = (valeur, max) => {
    if (valeur === undefined) return undefined;
    const propre = String(valeur ?? '').trim();
    if (propre === '') return null;
    if (propre.length > max) {
      throw new ErreurValidation(`Ce champ fait au plus ${max} caractères.`, {
        fonction: `Au plus ${max} caractères`,
      });
    }
    return propre;
  };

  await funderRepository.mettreAJourContact(contactId, {
    fonction: texte(corps.fonction, 120),
  });

  const identite = {};
  const details = {};
  for (const champ of ['prenom', 'nom']) {
    if (corps[champ] === undefined) continue;
    const propre = String(corps[champ] ?? '').trim();
    if (propre === '') details[champ] = 'Champ obligatoire';
    else if (propre.length > 80) details[champ] = 'Au plus 80 caractères';
    else identite[champ] = propre;
  }
  if (corps.telephone !== undefined) {
    const numero = String(corps.telephone ?? '').trim();
    if (numero.length > 20) details.telephone = 'Au plus 20 caractères';
    else identite.telephone = numero === '' ? null : numero;
  }
  if (Object.keys(details).length > 0) {
    throw new ErreurValidation('La fiche comporte des erreurs.', details);
  }
  try {
    await funderRepository.mettreAJourIdentite(contactId, identite);
  } catch (erreur) {
    if (erreur?.code === '23505' && String(erreur.constraint ?? '').includes('telephone')) {
      throw new ErreurValidation('Ce numéro est déjà utilisé par un autre compte.', {
        telephone: 'Numéro déjà utilisé',
      });
    }
    throw erreur;
  }

  if (corps.photoUrl !== undefined) {
    await funderRepository.mettreAJourPhoto(contactId, photoValide(corps.photoUrl));
  }

  return { success: true, message: 'Votre fiche est à jour.' };
}
