/**
 * Signal Horizon Global State Store
 * Manages real-time threat data, campaigns, and connection state
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

// =============================================================================
// Memory Bounds - Prevent unbounded growth
// =============================================================================
const MAX_CAMPAIGNS = 50;
const MAX_THREATS = 100;
const MAX_ALERTS = 50;

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'MONITORING' | 'RESOLVED' | 'FALSE_POSITIVE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isCrossTenant: boolean;
  tenantsAffected: number;
  confidence: number;
  firstSeenAt: string;
  lastActivityAt: string;
}

export interface Threat {
  id: string;
  threatType: string;
  indicator: string;
  riskScore: number;
  fleetRiskScore?: number;
  hitCount: number;
  tenantsAffected: number;
  isFleetThreat: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface ThreatAlert {
  id: string;
  type: 'campaign' | 'threat' | 'blocklist';
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: number;
}

interface HorizonState {
  // Connection
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
  sessionId: string | null;

  // Loading state
  isLoading: boolean;
  hasReceivedSnapshot: boolean;

  // Data
  campaigns: Campaign[];
  threats: Threat[];
  alerts: ThreatAlert[];
  sensorStats: Record<string, number>;

  // Stats
  stats: {
    totalThreats: number;
    fleetThreats: number;
    activeCampaigns: number;
    blockedIndicators: number;
    sensorsOnline: number;
    apiStats: {
      discoveryEvents: number;
      schemaViolations: number;
    };
  };

  // Actions
  setConnectionState: (state: HorizonState['connectionState']) => void;
  setSessionId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setSnapshot: (data: {
    activeCampaigns: Campaign[];
    recentThreats: Threat[];
    sensorStats: Record<string, number>;
    apiStats: {
      discoveryEvents: number;
      schemaViolations: number;
    };
  }) => void;
  addCampaign: (campaign: Campaign) => void;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  addThreat: (threat: Threat) => void;
  updateThreat: (id: string, updates: Partial<Threat>) => void;
  addAlert: (alert: ThreatAlert) => void;
  clearAlerts: () => void;
  updateStats: (stats: Partial<HorizonState['stats']>) => void;
}

export const useHorizonStore = create<HorizonState>((set, get) => ({
  // Initial state
  connectionState: 'disconnected',
  sessionId: null,
  isLoading: true,
  hasReceivedSnapshot: false,
  campaigns: [],
  threats: [],
  alerts: [],
  sensorStats: {},
  stats: {
    totalThreats: 0,
    fleetThreats: 0,
    activeCampaigns: 0,
    blockedIndicators: 0,
    sensorsOnline: 0,
    apiStats: {
      discoveryEvents: 0,
      schemaViolations: 0,
    },
  },

  // Actions
  setConnectionState: (state) => set({ connectionState: state }),
  setSessionId: (id) => set({ sessionId: id }),
  setLoading: (loading) => set({ isLoading: loading }),

  setSnapshot: (data) =>
    set({
      campaigns: data.activeCampaigns,
      threats: data.recentThreats,
      sensorStats: data.sensorStats,
      isLoading: false,
      hasReceivedSnapshot: true,
      stats: {
        ...get().stats,
        activeCampaigns: data.activeCampaigns.length,
        totalThreats: data.recentThreats.length,
        fleetThreats: data.recentThreats.filter((t) => t.isFleetThreat).length,
        sensorsOnline: data.sensorStats.CONNECTED || 0,
        apiStats: data.apiStats,
      },
    }),

  addCampaign: (campaign) =>
    set((state) => {
      // Deduplicate and bound to MAX_CAMPAIGNS
      const updatedCampaigns = [
        campaign,
        ...state.campaigns.filter((c) => c.id !== campaign.id),
      ].slice(0, MAX_CAMPAIGNS);

      return {
        campaigns: updatedCampaigns,
        stats: {
          ...state.stats,
          activeCampaigns: updatedCampaigns.filter((c) => c.status === 'ACTIVE').length,
        },
      };
    }),

  updateCampaign: (id, updates) =>
    set((state) => ({
      campaigns: state.campaigns.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  addThreat: (threat) =>
    set((state) => {
      // Deduplicate and bound to MAX_THREATS
      const updatedThreats = [
        threat,
        ...state.threats.filter((t) => t.id !== threat.id),
      ].slice(0, MAX_THREATS);

      return {
        threats: updatedThreats,
        stats: {
          ...state.stats,
          totalThreats: updatedThreats.length,
          fleetThreats: updatedThreats.filter((t) => t.isFleetThreat).length,
        },
      };
    }),

  updateThreat: (id, updates) =>
    set((state) => ({
      threats: state.threats.map((threat) => (threat.id === id ? { ...threat, ...updates } : threat)),
    })),

  addAlert: (alert) =>
    set((state) => ({
      // Bound to MAX_ALERTS
      alerts: [alert, ...state.alerts].slice(0, MAX_ALERTS),
    })),

  clearAlerts: () => set({ alerts: [] }),

  updateStats: (stats) =>
    set((state) => ({
      stats: { ...state.stats, ...stats },
    })),
}));

// =============================================================================
// Memoized Selectors - Prevent unnecessary re-renders
// Uses useShallow from Zustand 5.x for shallow comparison
// =============================================================================

/**
 * Select connection state only - use when component only needs connection info
 */
export const useConnectionState = () =>
  useHorizonStore((state) => state.connectionState);

/**
 * Select loading state only
 */
export const useLoadingState = () =>
  useHorizonStore(
    useShallow((state) => ({ isLoading: state.isLoading, hasReceivedSnapshot: state.hasReceivedSnapshot }))
  );

/**
 * Select stats only - for dashboard summary components
 */
export const useStats = () => useHorizonStore(useShallow((state) => state.stats));

/**
 * Select campaigns with shallow comparison
 */
export const useCampaigns = () => useHorizonStore(useShallow((state) => state.campaigns));

/**
 * Select active campaigns only
 */
export const useActiveCampaigns = () =>
  useHorizonStore(useShallow((state) => state.campaigns.filter((c) => c.status === 'ACTIVE')));

/**
 * Select threats with shallow comparison
 */
export const useThreats = () => useHorizonStore(useShallow((state) => state.threats));

/**
 * Select fleet threats only
 */
export const useFleetThreats = () =>
  useHorizonStore(useShallow((state) => state.threats.filter((t) => t.isFleetThreat)));

/**
 * Select alerts with shallow comparison
 */
export const useAlerts = () => useHorizonStore(useShallow((state) => state.alerts));

/**
 * Select critical alerts only
 */
export const useCriticalAlerts = () =>
  useHorizonStore(useShallow((state) => state.alerts.filter((a) => a.severity === 'CRITICAL')));

/**
 * Select sensor stats
 */
export const useSensorStats = () => useHorizonStore(useShallow((state) => state.sensorStats));

/**
 * Combined selector for overview page - batches related state
 */
export const useOverviewData = () =>
  useHorizonStore(
    useShallow((state) => ({
      campaigns: state.campaigns,
      threats: state.threats,
      stats: state.stats,
      sensorStats: state.sensorStats,
    }))
  );
