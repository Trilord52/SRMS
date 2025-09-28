import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, query } from '@/lib/api';
import {
  analyticsByTemplateSchema,
  analyticsBySubmitterSchema,
  analyticsOverviewSchema,
  databaseResponseSchema,
  databasesResponseSchema,
  reportResponseSchema,
  reportsResponseSchema,
  templateResponseSchema,
  templatesResponseSchema,
  usersResponseSchema,
} from '@/lib/schemas';

/**
 * Query hooks.
 *
 * Responses are parsed rather than cast, so a shape that drifts from what the
 * client expects fails here with a readable path instead of turning into
 * `undefined` inside a component.
 */

export interface ReportFilters {
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  submittedBy?: string;
  templateId?: string;
  isoYear?: number;
  isoWeek?: number;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  sort?: 'newest' | 'oldest';
}

export function useReports(filters: ReportFilters = {}) {
  return useQuery({
    queryKey: ['reports', filters],
    queryFn: async () =>
      reportsResponseSchema.parse(await api.get(`/api/v1/reports${query({ ...filters })}`)),
  });
}

export function useReport(id: string | null) {
  return useQuery({
    queryKey: ['report', id],
    enabled: Boolean(id),
    queryFn: async () => reportResponseSchema.parse(await api.get(`/api/v1/reports/${id}`)),
  });
}

export function useTemplates(options: { isActive?: boolean; limit?: number } = {}) {
  return useQuery({
    queryKey: ['templates', options],
    queryFn: async () =>
      templatesResponseSchema.parse(
        await api.get(`/api/v1/templates${query({ ...options, limit: options.limit ?? 100 })}`)
      ),
  });
}

export function useTemplate(id: string | null) {
  return useQuery({
    queryKey: ['template', id],
    enabled: Boolean(id),
    queryFn: async () => templateResponseSchema.parse(await api.get(`/api/v1/templates/${id}`)),
  });
}

export function useDatabases(options: { isActive?: boolean } = {}) {
  return useQuery({
    queryKey: ['databases', options],
    queryFn: async () =>
      databasesResponseSchema.parse(
        await api.get(`/api/v1/databases${query({ ...options, limit: 100 })}`)
      ),
  });
}

export function usePendingRegistrations() {
  return useQuery({
    queryKey: ['registrations', 'pending'],
    queryFn: async () =>
      usersResponseSchema.parse(await api.get('/api/v1/auth/registrations/pending')),
  });
}

export function useUsers(options: { role?: string; accountStatus?: string } = {}) {
  return useQuery({
    queryKey: ['users', options],
    queryFn: async () =>
      usersResponseSchema.parse(
        await api.get(`/api/v1/auth/users${query({ ...options, limit: 100 })}`)
      ),
  });
}

export interface AnalyticsRange {
  from?: string;
  to?: string;
  granularity?: 'day' | 'week' | 'month';
}

export function useAnalyticsOverview(range: AnalyticsRange = {}) {
  return useQuery({
    queryKey: ['analytics', 'overview', range],
    queryFn: async () =>
      analyticsOverviewSchema.parse(
        await api.get(`/api/v1/analytics/overview${query({ ...range })}`)
      ),
  });
}

export function useAnalyticsBySubmitter(range: AnalyticsRange = {}) {
  return useQuery({
    queryKey: ['analytics', 'by-submitter', range],
    queryFn: async () =>
      analyticsBySubmitterSchema.parse(
        await api.get(`/api/v1/analytics/by-submitter${query({ ...range })}`)
      ),
  });
}

export function useAnalyticsByTemplate(range: AnalyticsRange = {}) {
  return useQuery({
    queryKey: ['analytics', 'by-template', range],
    queryFn: async () =>
      analyticsByTemplateSchema.parse(
        await api.get(`/api/v1/analytics/by-template${query({ ...range })}`)
      ),
  });
}

/** Mutations. Each invalidates only the keys its change can affect. */

export function useSubmitReport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) =>
      reportResponseSchema.parse(await api.postForm('/api/v1/reports', formData)),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['reports'] });
      void client.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useReviewReport() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reportId,
      decision,
      reviewComments,
      rejectionReason,
    }: {
      reportId: string;
      decision: 'approved' | 'rejected';
      reviewComments?: string;
      rejectionReason?: string;
    }) =>
      reportResponseSchema.parse(
        await api.post(`/api/v1/reports/${reportId}/review`, {
          decision,
          reviewComments: reviewComments || undefined,
          rejectionReason: rejectionReason || undefined,
        })
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['reports'] });
      void client.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

export function useDecideRegistration() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      decision,
      rejectionReason,
      role,
    }: {
      userId: string;
      decision: 'approved' | 'rejected';
      rejectionReason?: string;
      /** The role granted on approval, chosen by the approving manager. */
      role?: string;
    }) =>
      api.patch(`/api/v1/auth/registrations/${userId}`, {
        decision,
        rejectionReason: rejectionReason || undefined,
        // Only meaningful on approval; the API rejects it alongside a rejection.
        role: decision === 'approved' ? role : undefined,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['registrations'] });
      void client.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useSaveTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: unknown }) =>
      templateResponseSchema.parse(
        id
          ? await api.patch(`/api/v1/templates/${id}`, body)
          : await api.post('/api/v1/templates', body)
      ),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useRetireTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/api/v1/templates/${id}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useSaveDatabase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id?: string; body: unknown }) =>
      databaseResponseSchema.parse(
        id
          ? await api.patch(`/api/v1/databases/${id}`, body)
          : await api.post('/api/v1/databases', body)
      ),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['databases'] }),
  });
}

export function useRetireDatabase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, restore }: { id: string; restore?: boolean }) =>
      restore
        ? api.post(`/api/v1/databases/${id}/restore`)
        : api.delete(`/api/v1/databases/${id}`),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['databases'] }),
  });
}
