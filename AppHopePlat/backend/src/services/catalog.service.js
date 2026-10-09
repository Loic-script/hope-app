import * as categoryRepository from '../repositories/projectCategory.repository.js';

import { ErreurRegleMetier } from '../shared/errors.js';
import { texteFacultatif, texteRequis } from '../shared/validation.js';
import { DEVISES_ACCEPTEES, DEVISE_PAR_DEFAUT } from '../shared/money.js';
import { INDICATEURS_SUGGERES } from './impact.service.js';
import { MOYENS_PAIEMENT } from './donation.service.js';
import { CATEGORIES as CATEGORIES_DEPENSE } from './expense.service.js';

export const CATEGORIES_PAR_DEFAUT = [
  { name: 'Scolarité', description: 'Frais de scolarité, fournitures et soutien scolaire' },
  { name: 'Soins', description: 'Consultations, médicaments et suivi médical' },
  { name: 'Alimentation', description: 'Repas, distributions alimentaires et nutrition' },
  { name: 'Employabilité', description: "Insertion professionnelle et accompagnement vers l'emploi" },
  {
    name: 'Formation professionnelle',
    description: 'Apprentissage de métiers et formations qualifiantes',
  },
  { name: 'Soutien social', description: 'Accompagnement des familles et aide sociale' },
  { name: 'Urgence', description: "Réponse aux situations d'urgence et aux catastrophes" },
];

export const LIBELLES = {
  projectStatus: {
    IN_PROGRESS: 'En cours',
    COMPLETED: 'Terminé',
    ARCHIVED: 'Archivé',
  },
  donationAllocation: {
    PROJECT: 'Affecté à un projet',
    HOPE: 'Non affecté (fonds HOPE)',
  },
  donationFrequency: {
    ONE_TIME: 'Ponctuel',
    MONTHLY: 'Mensuel',
  },
  donationStatus: {
    PENDING: 'En attente',
    RECEIVED: 'Reçu',
    FAILED: 'Échoué',
    REFUNDED: 'Remboursé',
  },
  donorOrigin: {
    LOCAL: 'Madagascar',
    INTERNATIONAL: 'International',
  },
  accountStatus: {
    ACTIVE: 'Actif',
    SUSPENDED: 'Suspendu',
  },
  expenseStatus: {
    RECORDED: 'Enregistrée',
    CANCELLED: 'Annulée',
  },
  documentType: {
    INVOICE: 'Facture',
    RECEIPT: 'Reçu',
    QUOTE: 'Devis',
    CONTRACT: 'Contrat',
    DELIVERY_NOTE: 'Bon de livraison',
    BANK_PROOF: 'Preuve de paiement',
    ACTIVITY_REPORT: 'Rapport d’activité',
    COMPLETION_PHOTO: 'Photo de réalisation',
    CERTIFICATE: 'Certificat',
    PARTNER_AGREEMENT: 'Convention partenaire',
    OTHER: 'Autre',
  },
  beneficiaryType: {
    ORPHAN: 'Orphelin',
    SINGLE_MOTHER: 'Mère célibataire',
    FAMILY: 'Famille',
    OTHER: 'Autre',
  },
  beneficiaryStatus: { ACTIVE: 'Actif', INACTIVE: 'Inactif' },
  membershipStatus: { ACTIVE: 'En cours', COMPLETED: 'Terminé', WITHDRAWN: 'Sorti' },
  gender: { F: 'Féminin', M: 'Masculin', OTHER: 'Autre' },
  messageStatus: { NEW: 'Nouveau', READ: 'Lu', ANSWERED: 'Répondu' },
  notificationType: {
    DONATION: 'Don',
    MESSAGE: 'Message',
    PROJECT_COMPLETED: 'Projet terminé',
    INVESTMENT: 'Investissement',
    ACCOUNT_CREATED: 'Nouveau compte',
    TASK_REQUEST: 'Demande de tâche',
    TASK_DELIVERED: 'Tâche livrée',
    FUNDER_INTEREST: 'Intérêt d’un partenaire',
    FIELD_PROOF: 'Preuve terrain',
  },
  mediaType: { PHOTO: 'Photo', VIDEO: 'Vidéo' },

  projectType: {
    HOPE: 'Projet HOPE',
    INTERNAL: 'Projet interne',
  },

  proofType: {
    PHOTO: 'Photo',
    VIDEO: 'Vidéo',
    DOCUMENT: 'Document',
    TESTIMONY: 'Témoignage',
  },
};

export async function recuperer() {
  return {
    categories: await categoryRepository.lister(),
    labels: LIBELLES,
    currencies: DEVISES_ACCEPTEES,
    defaultCurrency: DEVISE_PAR_DEFAUT,
    indicators: INDICATEURS_SUGGERES,
    paymentMethods: MOYENS_PAIEMENT,
    expenseCategories: CATEGORIES_DEPENSE,
  };
}

export function listerCategories() {
  return categoryRepository.lister();
}

export async function creerCategorie(corps = {}) {
  const nom = texteRequis(corps.name, 'name', { max: 120 });

  const existantes = await categoryRepository.lister();
  if (existantes.some((categorie) => categorie.name.toLowerCase() === nom.toLowerCase())) {
    throw new ErreurRegleMetier('Une catégorie porte déjà ce nom.', 'CATEGORIE_EXISTANTE');
  }

  return categoryRepository.creer({
    name: nom,
    description: texteFacultatif(corps.description, 'description', { max: 1000 }),
  });
}

export async function installerCategoriesParDefaut() {
  const creees = [];
  for (const categorie of CATEGORIES_PAR_DEFAUT) {
    creees.push(await categoryRepository.creerSiAbsente(categorie));
  }
  return creees;
}
