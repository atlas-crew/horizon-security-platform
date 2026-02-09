/**
 * usePolicies Hook
 *
 * Manages global security policy templates.
 */

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string | null;
  severity: 'strict' | 'standard' | 'dev';
  config: Record<string, any>;
  isActive: boolean;
  isDefault: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

async function fetchPolicies(): Promise<PolicyTemplate[]> {
  const data = await apiFetch<{ templates?: PolicyTemplate[] }>('/fleet/policies');
  return Array.isArray(data.templates) ? data.templates : [];
}

async function fetchDefaults(): Promise<PolicyTemplate[]> {
  const data = await apiFetch<{ templates?: PolicyTemplate[] }>('/fleet/policies/defaults');
  return Array.isArray(data.templates) ? data.templates : [];
}

type PolicyTemplateInput = {
  name: string;
  description?: string;
  severity: PolicyTemplate['severity'];
  config: Record<string, any>;
};

async function createPolicyTemplate(input: PolicyTemplateInput) {
  return apiFetch('/fleet/policies', { method: 'POST', body: input });
}

async function updatePolicyTemplate(params: {
  id: string;
  input: Partial<PolicyTemplateInput>;
}) {
  return apiFetch(`/fleet/policies/${params.id}`, { method: 'PUT', body: params.input });
}

async function deletePolicyTemplate(id: string) {
  await apiFetch(`/fleet/policies/${id}`, { method: 'DELETE' });
  return true;
}

async function clonePolicyTemplate(params: { id: string; name: string }) {
  return apiFetch(`/fleet/policies/${params.id}/clone`, { method: 'POST', body: { name: params.name } });
}

export function usePolicies() {
  const queryClient = useQueryClient();

  const policiesQuery = useQuery({
    queryKey: ['fleet', 'policies'],
    queryFn: fetchPolicies,
  });

  const defaultsQuery = useQuery({
    queryKey: ['fleet', 'policies', 'defaults'],
    queryFn: fetchDefaults,
  });

  const createMutation = useMutation({
    mutationFn: createPolicyTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet', 'policies'] });
      queryClient.invalidateQueries({ queryKey: ['fleet', 'policies', 'defaults'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: updatePolicyTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet', 'policies'] });
      queryClient.invalidateQueries({ queryKey: ['fleet', 'policies', 'defaults'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePolicyTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet', 'policies'] });
      queryClient.invalidateQueries({ queryKey: ['fleet', 'policies', 'defaults'] });
    },
  });

  const cloneMutation = useMutation({
    mutationFn: clonePolicyTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet', 'policies'] });
      queryClient.invalidateQueries({ queryKey: ['fleet', 'policies', 'defaults'] });
    },
  });

  return {
    policies: policiesQuery.data || [],
    isLoading: policiesQuery.isLoading,
    error: policiesQuery.error as Error | null,
    defaults: defaultsQuery.data || [],
    isDefaultsLoading: defaultsQuery.isLoading,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['fleet', 'policies'] }),

    createTemplate: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateTemplate: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteTemplate: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    cloneTemplate: cloneMutation.mutateAsync,
    isCloning: cloneMutation.isPending,
  };
}

export default usePolicies;
