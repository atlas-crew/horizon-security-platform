import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HuntingPage from '../HuntingPage';
import { useHunt } from '../../hooks/useHunt';

// Mock dependencies
vi.mock('../../hooks/useHunt', () => ({
  useHunt: vi.fn(),
}));

vi.mock('../../hooks/useFocusTrap', () => ({
  useFocusTrap: vi.fn(),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

// Mock child components to isolate page logic
vi.mock('../../components/hunting', () => ({
  HuntQueryBuilder: ({ onQuery, onSave, externalQuery }: any) => (
    <div data-testid="query-builder">
      <button onClick={() => onQuery({ startTime: 'now-1h', endTime: 'now' })}>Run Query</button>
      <button onClick={() => onSave({ startTime: 'now-1h', endTime: 'now' })}>Save Query</button>
      {externalQuery && <div data-testid="external-query">{JSON.stringify(externalQuery)}</div>}
    </div>
  ),
  HuntResultsTable: ({ result }: any) => (
    <div data-testid="results-table">
      {result ? `Results: ${result.total}` : 'No results'}
    </div>
  ),
  SavedQueries: ({ queries, onRun }: any) => (
    <div data-testid="saved-queries">
      {queries.map((q: any) => (
        <button key={q.id} onClick={() => onRun(q.id)}>{q.name}</button>
      ))}
    </div>
  ),
  BehavioralAnomaliesPanel: () => <div data-testid="anomalies-panel" />,
  LowAndSlowPanel: () => <div data-testid="low-slow-panel" />,
  FleetIntelligencePanel: ({ onPivotFingerprint }: any) => (
    <div data-testid="fleet-intel-panel">
      <button onClick={() => onPivotFingerprint('test-fp')}>Pivot FP</button>
    </div>
  ),
  SigmaLeadsPanel: () => <div data-testid="sigma-leads-panel" />,
  SigmaRulesPanel: () => <div data-testid="sigma-rules-panel" />,
}));

const mockHuntMethods = {
  isLoading: false,
  error: null,
  status: { historical: true, isFleetAdmin: true },
  getStatus: vi.fn().mockResolvedValue({ historical: true, isFleetAdmin: true }),
  queryTimeline: vi.fn(),
  getSavedQueries: vi.fn().mockResolvedValue([]),
  saveQuery: vi.fn(),
  runSavedQuery: vi.fn(),
  deleteSavedQuery: vi.fn(),
  getTenantBaselines: vi.fn(),
  getAnomalies: vi.fn(),
  getLowAndSlowIps: vi.fn(),
  getFleetFingerprintIntelligence: vi.fn(),
  createSigmaRule: vi.fn(),
  getSigmaLeads: vi.fn(),
  ackSigmaLead: vi.fn(),
  getSigmaRules: vi.fn(),
  updateSigmaRule: vi.fn(),
  deleteSigmaRule: vi.fn(),
  clearError: vi.fn(),
};

describe('HuntingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useHunt).mockReturnValue(mockHuntMethods as any);
  });

  it('bootstraps data on mount', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <HuntingPage />
        </MemoryRouter>
      );
    });

    expect(mockHuntMethods.getStatus).toHaveBeenCalled();
    expect(mockHuntMethods.getSavedQueries).toHaveBeenCalled();
  });

  it('hides admin panels for non-admin users', async () => {
    vi.mocked(useHunt).mockReturnValue({
      ...mockHuntMethods,
      status: { historical: true, isFleetAdmin: false },
    } as any);

    await act(async () => {
      render(
        <MemoryRouter>
          <HuntingPage />
        </MemoryRouter>
      );
    });

    expect(screen.queryByTestId('low-slow-panel')).not.toBeInTheDocument();
    expect(screen.getByText(/admin-only/i)).toBeInTheDocument();
  });

  it('shows admin panels for admin users', async () => {
    vi.mocked(useHunt).mockReturnValue({
      ...mockHuntMethods,
      status: { historical: true, isFleetAdmin: true },
    } as any);

    await act(async () => {
      render(
        <MemoryRouter>
          <HuntingPage />
        </MemoryRouter>
      );
    });

    expect(screen.getByTestId('low-slow-panel')).toBeInTheDocument();
  });

  it('executes query flow and updates results', async () => {
    const mockResult = { signals: [], total: 42, source: 'clickhouse', queryTimeMs: 100 };
    mockHuntMethods.queryTimeline.mockResolvedValue(mockResult);

    render(
      <MemoryRouter>
        <HuntingPage />
      </MemoryRouter>
    );

    const runButton = screen.getByText('Run Query');
    await act(async () => {
      fireEvent.click(runButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Results: 42')).toBeInTheDocument();
    });
  });

  it('handles example query parsing correctly', async () => {
    render(
      <MemoryRouter>
        <HuntingPage />
      </MemoryRouter>
    );

    // "ip:185.228.*" example (the first one)
    const exampleButtons = screen.getAllByText('Run →', { selector: 'button' });
    await act(async () => {
      fireEvent.click(exampleButtons[0]);
    });

    await waitFor(() => {
      const externalQuery = JSON.parse(screen.getByTestId('external-query').textContent || '{}');
      expect(externalQuery.sourceIps).toContain('185.228.');
    });
  });

  it('manages the save query modal lifecycle', async () => {
    render(
      <MemoryRouter>
        <HuntingPage />
      </MemoryRouter>
    );

    // 1. Open Modal
    const saveTrigger = screen.getByText('Save Query');
    fireEvent.click(saveTrigger);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/Name \*/)).toBeInTheDocument();

    // 2. Submit Modal
    const nameInput = screen.getByLabelText(/Name \*/);
    const submitButton = screen.getByText('Save Query', { selector: 'button[type="submit"]' });

    fireEvent.change(nameInput, { target: { value: 'My Search' } });
    
    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(mockHuntMethods.saveQuery).toHaveBeenCalledWith(
      'My Search',
      expect.any(Object),
      undefined
    );

    // 3. Modal should be closed
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows and dismisses error banners', async () => {
    vi.mocked(useHunt).mockReturnValue({
      ...mockHuntMethods,
      error: 'Critical failure',
    } as any);

    await act(async () => {
      render(
        <MemoryRouter>
          <HuntingPage />
        </MemoryRouter>
      );
    });

    expect(screen.getByText('Critical failure')).toBeInTheDocument();

    const dismissButton = screen.getByText('Dismiss');
    await act(async () => {
      fireEvent.click(dismissButton);
    });

    expect(mockHuntMethods.clearError).toHaveBeenCalled();
  });
});
