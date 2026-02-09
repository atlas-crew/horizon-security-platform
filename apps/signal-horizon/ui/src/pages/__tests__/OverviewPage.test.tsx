import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import OverviewPage from '../OverviewPage';
import { useHorizonStore } from '../../stores/horizonStore';
import { useAttackMap } from '../../hooks/useAttackMap';

// Mock framer-motion to avoid issues with animations
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    path: ({ children, ...props }: any) => <path {...props}>{children}</path>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock the global stores and hooks
vi.mock('../../stores/horizonStore', () => ({
  useHorizonStore: vi.fn(),
}));

vi.mock('../../hooks/useAttackMap', () => ({
  useAttackMap: vi.fn(),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('../../hooks/useRelativeTime', () => ({
  useRelativeTime: vi.fn(() => 'just now'),
}));

// Mock lazy components
vi.mock('../../components/soc/ActiveCampaignList', () => ({
  default: () => <div data-testid="active-campaign-list">Active Campaigns</div>,
}));

vi.mock('../../components/soc/ThreatTrajectoryFeed', () => ({
  default: () => <div data-testid="threat-feed">Threat Feed</div>,
}));

const mockStats = {
  activeCampaigns: 5,
  totalThreats: 100,
  sensorsOnline: 42,
  blockedIndicators: 1234,
  apiStats: { discoveryEvents: 10, schemaViolations: 2 },
};

const mockThreats = [
  { id: '1', threatType: 'Fingerprint', indicator: 'user-agent-1', hitCount: 500, tenantsAffected: 1, isFleetThreat: false },
  { id: '2', threatType: 'Scanner', indicator: 'ip-1', hitCount: 1000, tenantsAffected: 5, isFleetThreat: true },
  { id: '3', threatType: 'Fingerprint', indicator: 'user-agent-2', hitCount: 250, tenantsAffected: 1, isFleetThreat: false },
  { id: '4', threatType: 'Brute Force', indicator: 'ip-2', hitCount: 750, tenantsAffected: 2, isFleetThreat: false },
  { id: '5', threatType: 'SQLi', indicator: 'ip-3', hitCount: 100, tenantsAffected: 1, isFleetThreat: false },
  { id: '6', threatType: 'DDoS', indicator: 'ip-4', hitCount: 2000, tenantsAffected: 10, isFleetThreat: true },
];

describe('OverviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when store or map is loading', () => {
    vi.mocked(useHorizonStore).mockReturnValue({
      isLoading: true,
      campaigns: [],
      threats: [],
      alerts: [],
      stats: mockStats,
    } as any);

    vi.mocked(useAttackMap).mockReturnValue({
      isLoading: false,
      points: [],
      routes: [],
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<OverviewPage />);
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading fleet intelligence...')).toBeInTheDocument();
  });

  it('renders correctly with real data and sorts top attackers', async () => {
    vi.mocked(useHorizonStore).mockReturnValue({
      isLoading: false,
      campaigns: [],
      threats: mockThreats,
      alerts: [],
      stats: mockStats,
    } as any);

    vi.mocked(useAttackMap).mockReturnValue({
      isLoading: false,
      points: [],
      routes: [],
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<OverviewPage />);

    await waitFor(() => {
      expect(screen.queryByText('Loading fleet intelligence...')).not.toBeInTheDocument();
    });

    // Check header stats
    expect(screen.getByText('42')).toBeInTheDocument(); // Sensors online

    // Check Top Attackers sorting (hitCount: 2000, 1000, 750, 500, 250)
    // DDoS (2000) should be first
    expect(screen.getByText('ip-4')).toBeInTheDocument();
    // SQLi (100) should be sliced off (only top 5 kept)
    expect(screen.queryByText('ip-3')).not.toBeInTheDocument();
  });

  it('filters top fingerprints correctly', async () => {
    vi.mocked(useHorizonStore).mockReturnValue({
      isLoading: false,
      campaigns: [],
      threats: mockThreats,
      alerts: [],
      stats: mockStats,
    } as any);

    vi.mocked(useAttackMap).mockReturnValue({
      isLoading: false,
      points: [],
      routes: [],
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<OverviewPage />);

    // Top fingerprints should only show items where threatType contains 'fingerprint'
    // id 1 (500) and id 3 (250).
    // user-agent-1 appears twice (in top attackers and top fingerprints)
    expect(screen.getAllByText('user-agent-1')[0]).toBeInTheDocument();
    expect(screen.getAllByText('user-agent-2')[0]).toBeInTheDocument();
  });

  it('filters attack map when filters are clicked', async () => {
    vi.mocked(useHorizonStore).mockReturnValue({
      isLoading: false,
      campaigns: [],
      threats: [],
      alerts: [],
      stats: mockStats,
    } as any);

    const mockPoints = [
      { id: 1, lat: 0, lon: 0, severity: 'HIGH', label: 'Bot 1', count: 10, category: 'bot', scope: 'local' },
      { id: 2, lat: 10, lon: 10, severity: 'HIGH', label: 'Attack 1', count: 20, category: 'attack', scope: 'fleet' },
    ];

    vi.mocked(useAttackMap).mockReturnValue({
      isLoading: false,
      points: mockPoints,
      routes: [],
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<OverviewPage />);

    const botFilter = screen.getByText('Top Bots (1h)');
    
    await act(async () => {
      botFilter.click();
    });

    await waitFor(() => {
      expect(botFilter).toHaveClass('border-link');
    });
  });

  it('calls refetch when refresh button is clicked', async () => {
    const refetch = vi.fn();
    vi.mocked(useHorizonStore).mockReturnValue({
      isLoading: false,
      campaigns: [],
      threats: [],
      alerts: [],
      stats: mockStats,
    } as any);

    vi.mocked(useAttackMap).mockReturnValue({
      isLoading: false,
      points: [],
      routes: [],
      error: null,
      refetch,
    } as any);

    render(<OverviewPage />);

    const refreshButton = screen.getByText('Refresh');
    await act(async () => {
      refreshButton.click();
    });

    expect(refetch).toHaveBeenCalled();
  });

  it('shows fallback data when no threats are present', async () => {
    vi.mocked(useHorizonStore).mockReturnValue({
      isLoading: false,
      campaigns: [],
      threats: [],
      alerts: [],
      stats: mockStats,
    } as any);

    vi.mocked(useAttackMap).mockReturnValue({
      isLoading: false,
      points: [],
      routes: [],
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<OverviewPage />);

    // Should show fallback attackers (e.g., '185.228.101.0/24')
    expect(screen.getByText('185.228.101.0/24')).toBeInTheDocument();
  });

  it('shows "Using cached data" warning on map error', async () => {
    vi.mocked(useHorizonStore).mockReturnValue({
      isLoading: false,
      campaigns: [],
      threats: [],
      alerts: [],
      stats: mockStats,
    } as any);

    vi.mocked(useAttackMap).mockReturnValue({
      isLoading: false,
      points: [],
      routes: [],
      error: new Error('Map failed'),
      refetch: vi.fn(),
    } as any);

    render(<OverviewPage />);

    expect(screen.getByText('Using cached data')).toBeInTheDocument();
  });
});
