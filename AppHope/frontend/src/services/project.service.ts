import { get } from './api';
import type { Budget, Impact, IndicatorTotal, Project, ProjectDetail } from '@/types/api';

/** Lecture des projets publies. Aucune ecriture : le public ne cree pas de projet. */

export interface ProjectListFilters {
  search?: string;
  categoryId?: string;
  status?: string;
  take?: number;
  skip?: number;
}

export const projectService = {
  list(filters: ProjectListFilters = {}): Promise<Project[]> {
    // Les filtres vides ne partent pas dans l'URL : elle reste lisible et
    // partageable, et le cache de React Query reste stable.
    const params: Record<string, unknown> = {};
    if (filters.search?.trim()) params['search'] = filters.search.trim();
    if (filters.categoryId) params['categoryId'] = filters.categoryId;
    if (filters.status) params['status'] = filters.status;
    if (filters.take) params['take'] = filters.take;
    if (filters.skip) params['skip'] = filters.skip;

    return get<Project[]>('/projects', params);
  },

  /** Accepte l'identifiant technique comme le code lisible HOPE-PRJ-... */
  detail(idOrCode: string): Promise<ProjectDetail> {
    return get<ProjectDetail>(`/projects/${encodeURIComponent(idOrCode)}`);
  },

  impacts(
    idOrCode: string,
  ): Promise<{ impacts: Impact[]; indicators: IndicatorTotal[]; totalMeasurements: number }> {
    return get(`/projects/${encodeURIComponent(idOrCode)}/impacts`);
  },

  budgets(idOrCode: string): Promise<Budget[]> {
    return get<Budget[]>(`/projects/${encodeURIComponent(idOrCode)}/budgets`);
  },
};
