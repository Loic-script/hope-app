import axios, { AxiosError, type AxiosInstance } from 'axios';
import type { ApiEnvelope, ApiErrorBody, ApiErrorCode, ApiErrorDetail } from '@/types/api';

/**
 * CLIENT HTTP UNIQUE DU FRONTEND.
 *
 * Le navigateur ne parle qu'a cette API. Il n'accede jamais a PostgreSQL, ne
 * connait aucun identifiant de base, et ne detient aucun secret : tout ce qui
 * commence par VITE_ est embarque dans le JavaScript telecharge par le
 * visiteur, donc lisible par n'importe qui.
 */

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Erreur applicative presentable a l'utilisateur.
 *
 * Elle transporte le code metier du backend, un message deja redige en
 * francais comprehensible, et le detail des champs invalides quand il y en a.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fieldErrors: ApiErrorDetail[];

  constructor(
    message: string,
    code: ApiErrorCode,
    status: number,
    fieldErrors: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  /** Reessayer a-t-il une chance d'aboutir ? */
  get isRetryable(): boolean {
    return this.status >= 500 || this.code === 'NETWORK_ERROR' || this.code === 'RATE_LIMITED';
  }
}

/**
 * Messages de repli par statut HTTP.
 *
 * Le backend redige deja des messages clairs et en francais ; ceux-ci ne
 * servent que lorsqu'il n'a rien pu dire — panne reseau, passerelle muette.
 * Ils s'adressent a un visiteur, pas a un developpeur : ni code technique, ni
 * nom de table, et toujours une action possible.
 */
const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'Les informations envoyees sont incompletes ou mal formees. Verifiez le formulaire.',
  401: 'Cette action demande une identification.',
  403: 'Vous n’avez pas les droits necessaires pour cette action.',
  404: 'Cette ressource est introuvable. Elle a peut-etre ete retiree.',
  409: 'Cette operation entre en conflit avec l’etat actuel. Rechargez la page et reessayez.',
  422: 'Cette operation n’est pas possible en l’etat.',
  429: 'Trop de tentatives en peu de temps. Patientez une minute avant de reessayer.',
  500: 'Le serveur a rencontre un probleme. Reessayez dans un instant.',
  502: 'Le service de paiement ne repond pas. Reessayez dans quelques minutes.',
  503: 'Le service est temporairement indisponible. Reessayez dans quelques minutes.',
};

const NETWORK_MESSAGE =
  'Impossible de joindre le serveur HOPE. Verifiez votre connexion, puis reessayez.';

function extractFieldErrors(body: ApiErrorBody | undefined): ApiErrorDetail[] {
  const details = body?.error?.details;
  if (!Array.isArray(details)) return [];

  return details.filter(
    (detail): detail is ApiErrorDetail =>
      typeof detail === 'object' &&
      detail !== null &&
      typeof (detail as ApiErrorDetail).field === 'string',
  );
}

/** Transforme n'importe quelle panne axios en ApiError lisible. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof AxiosError) {
    // Pas de reponse du tout : serveur eteint, coupure reseau, CORS refuse.
    if (!error.response) {
      return new ApiError(NETWORK_MESSAGE, 'NETWORK_ERROR', 0);
    }

    const status = error.response.status;
    const body = error.response.data as ApiErrorBody | undefined;

    return new ApiError(
      body?.error?.message ?? FALLBACK_MESSAGES[status] ?? FALLBACK_MESSAGES[500]!,
      (body?.error?.code as ApiErrorCode) ?? 'INTERNAL_ERROR',
      status,
      extractFieldErrors(body),
    );
  }

  return new ApiError(
    error instanceof Error ? error.message : 'Une erreur inattendue est survenue.',
    'INTERNAL_ERROR',
    0,
  );
}

// Toute erreur remontant d'axios devient une ApiError : les composants n'ont
// jamais a manipuler la forme brute d'axios.
http.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error)),
);

/** Deballe l'enveloppe `{ data: ... }` commune a toutes les reponses. */
export async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const response = await http.get<ApiEnvelope<T>>(path, { params });
  return response.data.data;
}

export async function post<T>(path: string, payload?: unknown): Promise<T> {
  const response = await http.post<ApiEnvelope<T>>(path, payload);
  return response.data.data;
}
