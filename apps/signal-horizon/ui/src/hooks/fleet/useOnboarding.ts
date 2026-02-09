/**
 * useOnboarding Hook
 *
 * Manages sensor provisioning and registration tokens.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

export interface RegistrationToken {
  id: string;
  name: string;
  tokenPrefix: string;
  status: 'ACTIVE' | 'EXPIRED' | 'EXHAUSTED' | 'REVOKED';
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  expiresAt: string | null;
  createdAt: string;
  token?: string; // Only present immediately after creation
}

export interface OnboardingStats {
  pendingApprovals: number;
  activeTokens: number;
  registrationsLast7Days: number;
}

async function fetchTokens(): Promise<RegistrationToken[]> {
  const data = await apiFetch<{ tokens?: RegistrationToken[] }>('/onboarding/tokens');
  return Array.isArray(data.tokens) ? data.tokens : [];
}

async function fetchStats(): Promise<OnboardingStats> {
  return apiFetch<OnboardingStats>('/onboarding/stats');
}

async function createToken(name: string): Promise<RegistrationToken> {
  return apiFetch<RegistrationToken>('/onboarding/tokens', {
    method: 'POST',
    body: { name, maxUses: 10, expiresIn: 30 }, // Default to 10 uses, 30 days
  });
}

export function useOnboarding() {
  const queryClient = useQueryClient();

  const tokensQuery = useQuery({
    queryKey: ['onboarding', 'tokens'],
    queryFn: fetchTokens,
  });

  const statsQuery = useQuery({
    queryKey: ['onboarding', 'stats'],
    queryFn: fetchStats,
  });

  const createTokenMutation = useMutation({
    mutationFn: createToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  return {
    tokens: tokensQuery.data || [],
    isLoadingTokens: tokensQuery.isLoading,
    stats: statsQuery.data || { pendingApprovals: 0, activeTokens: 0, registrationsLast7Days: 0 },
    isLoadingStats: statsQuery.isLoading,
    createToken: createTokenMutation.mutateAsync,
    isCreatingToken: createTokenMutation.isPending,
  };
}

export default useOnboarding;
