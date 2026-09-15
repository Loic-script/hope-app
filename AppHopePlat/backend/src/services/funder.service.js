/**
 * Service de l'espace bailleur.
 *
 * Deux principes gouvernent ce fichier :
 *
 *   * l'espace est en LECTURE SEULE sur les montants. Le bailleur ne
 *     paie pas dans l'application : les virements arrivent hors ligne
 *     et le back-office les saisit. Aucune methode ici ne cree ni ne
 *     modifie un engagement, un versement ou une affectation.
 *   * les seules ecritures autorisees sont sa propre fiche de contact
 *     et une manifestation d'interet -- qui ne debite rien.
 *
 * Les quatre indicateurs du tableau de bord sont calcules a la volee.
 * Les stocker les desynchroniserait des la saisie du versement suivant.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { transaction } from '../config/database.js';
import * as funderRepository from '../repositories/funder.repository.js';
import * as fieldProofService from './fieldProof.service.js';
import * as volunteerRepository from '../repositories/volunteer.repository.js';
import { LIBELLES_TYPE, TYPES_ORGANISATION } from './funderAuth.service.js';
import { DOSSIER_JUSTIFICATIFS, PREFIXE_MEDIAS } from '../middleware/upload.middleware.js';
import { ErreurIntrouvable, ErreurRegleMetier, ErreurValidation } from '../shared/errors.js';

/** Types de document, et leurs libelles. */
export const TYPES_DOCUMENT = {
  rapport_impact: 'Rapport d’impact',
  justificatif_financier: 'Justificatif financier',
  certificat: 'Certificat',
  convention: 'Convention',
};

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
 * Ajoute a chaque ligne sa part en pourcentage du total.
 *
 * Le calcul est fait ici et non dans SQL : la somme de reference change
 * selon ce qu'on regarde (domaines, zones), et un pourcentage arrondi
 * en base ne se recompose plus.
 */
function avecPart(lignes, champ = 'montant') {
  const total = lignes.reduce((somme, ligne) => somme + Number(ligne[champ] ?? 0), 0);
  return lignes.map((ligne) => ({
    ...ligne,
    part: total > 0 ? Math.round((Number(ligne[champ] ?? 0) * 1000) / total) / 10 : 0,
  }));
}

/**
 * Tableau de bord consolide.
 *
 * @param {string} bailleurId resolu depuis le compte connecte
 */
export async function tableauDeBord(bailleurId) {
  const [indicateurs, domaines, zones, projets, versements, origine, distinctions] =
    await Promise.all([
      funderRepository.indicateurs(bailleurId),
      funderRepository.repartitionParDomaine(bailleurId),
      funderRepository.zonesDIntervention(bailleurId),
      funderRepository.projetsFinances(bailleurId),
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
      // Le taux vaut 0 et non null quand rien n'est engage : l'ecran
      // affiche un chiffre, pas un trou.
      tauxExecution: Number(indicateurs.tauxExecution ?? 0),
      projetsFinances: indicateurs.projetsFinances ?? 0,
      beneficiairesTouches: indicateurs.beneficiairesTouches ?? 0,
    },
    domaines: avecPart(domaines),
    zones,
    projets,
    // Les dix derniers versements recus suffisent au tableau de bord ;
    // la page Partenariat porte l'historique complet.
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

/**
 * Page Partenariat : les engagements regroupes par nature de soutien.
 *
 * La barre de progression ne se calcule pas de la meme facon selon le
 * type : en montants verses pour le financier, en quantite realisee
 * pour les competences et le materiel.
 */
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
      // Ce qui reste a affecter : le plafond du declencheur SQL.
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

/** Historique complet des versements. */
export async function versements(bailleurId, requete = {}) {
  const recusSeulement = requete.recus === 'true' || requete.recus === true;
  const items = await funderRepository.listerVersements(bailleurId, { recusSeulement });
  return { items };
}

/* ================================================================
   Rapports et justificatifs
   ================================================================ */

/**
 * Liste les documents, avec les compteurs des trois onglets.
 *
 * @param {{ type?: string }} requete
 */
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

/**
 * Enregistre un telechargement et renvoie l'adresse du fichier.
 *
 * Le document est cherche AVEC le bailleur_id : un identifiant devine
 * ne donne pas acces au rapport d'un autre partenaire.
 */
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

/**
 * Genere le certificat de partenariat.
 *
 * Il est construit a la demande depuis les agregats du bailleur, et
 * porte un numero unique de la forme HFBL-PART-000112.
 */
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

  await fs.mkdir(DOSSIER_JUSTIFICATIFS, { recursive: true });
  const nomDisque = `certificat-${reference}.pdf`;
  await fs.writeFile(path.join(DOSSIER_JUSTIFICATIFS, nomDisque), pdf);

  const document = await funderRepository.creerDocument(bailleurId, {
    type: 'certificat',
    titre: `Certificat de partenariat ${reference}`,
    fichierUrl: `${PREFIXE_MEDIAS}/${nomDisque}`,
    nbPages: 1,
  });

  return { ...document, reference };
}

/**
 * PDF minimal mais valide du certificat.
 *
 * Ecrit a la main plutot qu'avec une bibliotheque : une page de texte
 * ne justifie pas une dependance de plus, et le fichier reste lisible
 * par n'importe quel lecteur.
 */
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

  // Les parentheses et les antislashs sont des delimiteurs PDF.
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

/* ================================================================
   Preuves terrain et fil d'actualite
   ================================================================ */

/** Les preuves des projets finances, remontees du back-office. */
export async function preuves(bailleurId) {
  const items = await funderRepository.listerPreuves(bailleurId);
  return { items };
}

/**
 * Un fichier de preuve, pour l'espace bailleur.
 *
 * L'appartenance est verifiee ici, et non dans la route : c'est la seule
 * chose qui separe les images d'un projet finance de celles d'un projet
 * voisin. Un refus se dit "introuvable" -- repondre "interdit"
 * confirmerait que la preuve existe.
 */
export async function fichierDePreuve(bailleurId, preuveId, fichierId) {
  const numero = Number(preuveId);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new ErreurIntrouvable('La preuve', preuveId);
  }

  const visible = await funderRepository.preuveEstVisible(bailleurId, numero);
  if (!visible) throw new ErreurIntrouvable('La preuve', preuveId);

  return fieldProofService.recupererFichier(numero, fichierId);
}

/** Le fil, filtre sur la cible "bailleurs". */
export async function fil(bailleurId) {
  const items = await funderRepository.listerPublications(bailleurId);

  return {
    items: items.map((publication) => {
      const cible = Number(publication.montantCible ?? 0);
      const collecte = Number(publication.montantCollecte ?? 0);
      return {
        ...publication,
        avancement: cible > 0 ? Math.min(100, Math.round((collecte * 1000) / cible) / 10) : null,
      };
    }),
  };
}

/**
 * "Financer ce projet" : enregistre une intention.
 *
 * Rien n'est debite, aucun engagement n'est cree. L'equipe HOPE prend
 * contact hors ligne, puis saisit l'engagement reel. L'application
 * enregistre la relation, elle ne la remplace pas.
 */
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

  return {
    ...manifestation,
    message:
      'Votre intérêt est transmis à l’équipe HOPE. Elle vous contactera pour formaliser le partenariat — aucun montant n’a été débité.',
  };
}

/* ================================================================
   Completion du profil : declarer son organisation
   ================================================================ */

/**
 * Cree l'organisation du bailleur et l'y rattache comme contact
 * principal.
 *
 * Ce formulaire existe parce que l'inscription ne le recueille pas :
 * raison sociale et type d'organisation sont obligatoires en base, mais
 * le formulaire commun aux trois types ne peut pas les demander. On les
 * demande donc a la premiere connexion.
 *
 * L'organisation nait en "prospect" : le compte est actif, le
 * partenariat reste a construire avec l'equipe.
 *
 * @param {string} utilisateurId compte connecte
 * @param {object} corps champs du formulaire
 */
export async function declarerOrganisation(utilisateurId, corps = {}) {
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

  // Une organisation deja declaree ne se recree pas : le formulaire ne
  // doit pas servir a se rattacher deux fois.
  const existante = await funderRepository.trouverParUtilisateur(utilisateurId);
  if (existante) {
    throw new ErreurRegleMetier(
      'Votre organisation est déjà enregistrée.',
      'ORGANISATION_DEJA_DECLAREE'
    );
  }

  return transaction(async (client) => {
    await funderRepository.creerAvecContact(
      {
        raisonSociale,
        typeOrganisation,
        secteur: texte(corps.secteur, 120),
        pays: texte(corps.pays, 80) ?? 'Madagascar',
        siteWeb: texte(corps.siteWeb, 500),
      },
      utilisateurId,
      texte(corps.fonction, 120),
      client
    );

    // Les champs facultatifs de l'organisation, en une passe.
    await funderRepository.mettreAJourOrganisationParUtilisateur(
      utilisateurId,
      {
        adresse: texte(corps.adresse, 2000),
        nif: texte(corps.nif, 40),
      },
      client
    );

    await volunteerRepository.marquerProfilComplete(utilisateurId, client);

    const fiche = await funderRepository.trouverParUtilisateur(utilisateurId, client);
    return {
      success: true,
      message: 'Votre organisation est enregistrée. Bienvenue dans l’espace partenaire.',
      bailleurId: fiche.id,
      raisonSociale: fiche.raisonSociale,
      typeLibelle: LIBELLES_TYPE[fiche.typeOrganisation] ?? fiche.typeOrganisation,
    };
  });
}

/* ================================================================
   Profil
   ================================================================ */

/** L'organisation, ses contacts et ses distinctions. */
export async function profil(bailleurId) {
  const [contacts, distinctions] = await Promise.all([
    funderRepository.listerContacts(bailleurId),
    funderRepository.listerDistinctions(bailleurId),
  ]);
  return { contacts, distinctions };
}

/**
 * Met a jour sa propre fiche de contact.
 *
 * C'est la seule ecriture du bailleur sur ses donnees. Ni le statut de
 * l'organisation, ni son niveau, ni les droits de consultation ne sont
 * modifiables ici : ils relevent de HOPE.
 */
/**
 * Verifie l'adresse d'une photo de profil.
 *
 * Elle doit venir du dossier des medias de HOPE : c'est le televersement
 * de l'espace qui la produit. Une chaine vide efface la photo.
 */
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

  /*
   * La photo vit sur le compte, pas sur la fiche de contact : c'est la
   * personne qu'on voit dans les conversations, pas son role dans
   * l'organisation. Meme colonne que pour un benevole.
   */
  if (corps.photoUrl !== undefined) {
    await funderRepository.mettreAJourPhoto(contactId, photoValide(corps.photoUrl));
  }

  return { success: true, message: 'Votre fiche est à jour.' };
}
