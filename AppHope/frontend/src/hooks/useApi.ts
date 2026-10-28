import { useMutation, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ApiError } from '@/services/api';
import { catalogService } from '@/services/catalog.service';
import { donationService } from '@/services/donation.service';
import { paymentService } from '@/services/payment.service';
import { projectService, type ProjectListFilters } from '@/services/project.service';
import type { CheckoutRequest, CheckoutResponse } from '@/types/api';

/**
 * Acces aux donnees via React Query.
 *
 * Les cles de cache sont regroupees ici : une cle dupliquee ailleurs dans le
 * code produirait deux caches distincts pour la meme donnee, et un ecran qui
 * ne se rafraichit pas quand l'autre change.
 */

export const queryKeys = {
  projects: (filters: ProjectListFilters = {}) => ['projects', filters] as const,
  project: (idOrCode: string) => ['project', idOrCode] as const,
  projectImpacts: (idOrCode: string) => ['project', idOrCode, 'impacts'] as const,
  categories: () => ['categories'] as const,
  paymentMethods: (country?: string) => ['payment-methods', country ?? 'all'] as const,
  stats: () => ['stats'] as const,
  indicators: () => ['indicators'] as const,
  donation: (id: string) => ['donation', id] as const,
  transaction: (idOrReference: string) => ['transaction', idOrReference] as const,
};

/**
 * Reglages communs aux lectures.
 *
 * `retry` ne rejoue PAS une erreur 4xx : un projet introuvable le restera, et
 * insister ne ferait qu'allonger l'attente devant un ecran vide. Seules les
 * pannes reseau et serveur meritent une seconde tentative.
 */
export const defaultQueryOptions = {
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  retry(failureCount: number, error: unknown) {
    if (error instanceof ApiError && !error.isRetryable) return false;
    return failureCount < 2;
  },
  refetchOnWindowFocus: false,
} satisfies Partial<UseQueryOptions>;

// ---------------------------------------------------------------------------
// Projets
// ---------------------------------------------------------------------------

export function useProjects(filters: ProjectListFilters = {}) {
  return useQuery({
    queryKey: queryKeys.projects(filters),
    queryFn: () => projectService.list(filters),
    ...defaultQueryOptions,
  });
}

export function useProject(idOrCode: string | undefined) {
  return useQuery({
    queryKey: queryKeys.project(idOrCode ?? ''),
    queryFn: () => projectService.detail(idOrCode as string),
    enabled: Boolean(idOrCode),
    ...defaultQueryOptions,
  });
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => catalogService.categories(),
    // Les categories changent une fois par an : inutile de les redemander.
    ...defaultQueryOptions,
    staleTime: 30 * 60_000,
  });
}

/**
 * Moyens de paiement proposes au donateur.
 *
 * Tant que le pays n'est pas choisi, on ne demande rien : afficher MVola a
 * quelqu'un qui donnera depuis la France, pour le retirer une seconde plus
 * tard, est plus deroutant qu'une courte attente.
 */
export function usePaymentMethods(country: string | undefined) {
  return useQuery({
    queryKey: queryKeys.paymentMethods(country),
    queryFn: () => catalogService.paymentMethods(country),
    enabled: Boolean(country),
    ...defaultQueryOptions,
  });
}

export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats(),
    queryFn: () => catalogService.stats(),
    ...defaultQueryOptions,
  });
}

export function useIndicators() {
  return useQuery({
    queryKey: queryKeys.indicators(),
    queryFn: () => catalogService.indicators(),
    ...defaultQueryOptions,
  });
}

// ---------------------------------------------------------------------------
// Don et paiement
// ---------------------------------------------------------------------------

export function useDonation(donationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.donation(donationId ?? ''),
    queryFn: () => donationService.detail(donationId as string),
    enabled: Boolean(donationId),
    ...defaultQueryOptions,
  });
}

export function useTransaction(idOrReference: string | undefined) {
  return useQuery({
    queryKey: queryKeys.transaction(idOrReference ?? ''),
    queryFn: () => paymentService.detail(idOrReference as string),
    enabled: Boolean(idOrReference),
    ...defaultQueryOptions,
  });
}

/**
 * Envoi du don.
 *
 * `retry: false` est ici une regle de securite, pas un reglage de confort :
 * rejouer automatiquement une demande de paiement pourrait debiter deux fois
 * le meme donateur. Si quelque chose echoue, c'est a la personne de decider
 * de reessayer.
 */
export function useCheckout() {
  return useMutation<CheckoutResponse, ApiError, CheckoutRequest>({
    mutationFn: (request) => donationService.checkout(request),
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Remonte en haut de page a chaque changement de route.
 *
 * Sans cela, on arrive au milieu d'une page apres avoir clique sur un lien :
 * le navigateur conserve la position de defilement precedente.
 * Les ancres (#section) sont respectees, et le retour arriere du navigateur
 * garde son propre comportement.
 */
export function useScrollToTop(): void {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, hash]);
}
