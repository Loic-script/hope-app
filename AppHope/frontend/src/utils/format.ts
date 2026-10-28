import type {
  BeneficiaryType,
  DonationFrequency,
  DonationType,
  TransactionStatus,
} from '@/types/api';

/** Traductions et mises en forme destinees a l'ecran. */

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatMonth(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Libelles des statuts de transaction.
 *
 * Ils sont ecrits pour un donateur, pas pour un developpeur : personne n'a
 * envie de lire "PROCESSING" apres avoir donne de l'argent.
 */
export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours de traitement',
  SUCCESS: 'Encaisse',
  FAILED: 'Echoue',
  CANCELLED: 'Annule',
  REFUNDED: 'Rembourse',
};

export const DONATION_TYPE_LABELS: Record<DonationType, string> = {
  ONE_TIME: 'Don ponctuel',
  RECURRING: 'Don recurrent',
};

export const FREQUENCY_LABELS: Record<DonationFrequency, string> = {
  MONTHLY: 'par mois',
  QUARTERLY: 'par trimestre',
  YEARLY: 'par an',
};

export const BENEFICIARY_TYPE_LABELS: Record<BeneficiaryType, string> = {
  ORPHAN: 'Enfants orphelins',
  SINGLE_MOTHER: 'Mères célibataires',
  FAMILY: 'Familles',
  OTHER: 'Autres bénéficiaires',
};

export const DONOR_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Particulier',
  COMPANY: 'Entreprise',
  FOUNDATION: 'Fondation',
  ORGANIZATION: 'Organisation',
  PARTNER: 'Partenaire',
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'En préparation',
  ACTIVE: 'En cours',
  COMPLETED: 'Terminé',
  SUSPENDED: 'Suspendu',
  CANCELLED: 'Annulé',
};

export const EXPENSE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  VALIDATED: 'Validée',
  PAID: 'Payée',
  CANCELLED: 'Annulée',
};

/**
 * Traduit un nom d'indicateur technique en libellé lisible.
 *
 * Les indicateurs viennent de la base sous forme de clés (`women_trained`).
 * Ceux que HOPE utilise couramment sont traduits ; les autres sont affichés
 * proprement plutôt que masqués — un indicateur inconnu reste une information.
 */
const INDICATOR_LABELS: Record<string, string> = {
  women_trained: 'Femmes formées',
  children_schooled: 'Enfants scolarisés',
  meals_distributed: 'Repas distribués',
  consultations: 'Consultations médicales',
  families_supported: 'Familles accompagnées',
  jobs_created: 'Emplois créés',
  success_rate: 'Taux de réussite',
};

export function formatIndicatorName(indicator: string): string {
  const known = INDICATOR_LABELS[indicator];
  if (known) return known;

  const readable = indicator.replace(/[_-]+/g, ' ').trim();
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

export function formatUnit(unit: string | null): string {
  if (!unit) return '';
  const units: Record<string, string> = {
    persons: 'personnes',
    percent: '%',
    meals: 'repas',
    days: 'jours',
  };
  return units[unit] ?? unit;
}

/** Coupe un texte long sans casser un mot. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength).trimEnd()}…`;
}
