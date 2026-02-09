import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { CampaignTimelineEvent } from '../../hooks/useHunt';
import CampaignTimelinePage from '../hunting/CampaignTimelinePage';

const mockClearError = vi.fn();
const mockGetCampaignTimeline = vi.fn();

vi.mock('../../hooks/useHunt', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useHunt')>('../../hooks/useHunt');
  return {
    ...actual,
    useHunt: () => ({
      isLoading: false,
      error: null,
      clearError: mockClearError,
      getCampaignTimeline: mockGetCampaignTimeline,
    }),
  };
});

function renderRoute(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/hunting/campaign" element={<CampaignTimelinePage />} />
        <Route path="/hunting/campaign/:campaignId" element={<CampaignTimelinePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function makeEvent(overrides: Partial<CampaignTimelineEvent> = {}): CampaignTimelineEvent {
  return {
    timestamp: overrides.timestamp ?? '2026-02-09T00:00:00.000Z',
    campaignId: overrides.campaignId ?? 'camp-1',
    eventType: overrides.eventType ?? 'created',
    name: overrides.name ?? 'Example Campaign',
    status: overrides.status ?? 'OPEN',
    severity: overrides.severity ?? 'HIGH',
    isCrossTenant: overrides.isCrossTenant ?? false,
    tenantsAffected: overrides.tenantsAffected ?? 1,
    confidence: overrides.confidence ?? 0.9,
  };
}

describe('CampaignTimelinePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-runs when deep-linked with campaignId', async () => {
    mockGetCampaignTimeline.mockResolvedValue({
      events: [makeEvent({ name: 'Deep Link Event' })],
      meta: { campaignId: 'camp-123', count: 1 },
    });

    renderRoute('/hunting/campaign/camp-123');

    await waitFor(() =>
      expect(mockGetCampaignTimeline).toHaveBeenCalledWith('camp-123', { startTime: undefined, endTime: undefined }),
    );

    expect(await screen.findByText('Deep Link Event')).toBeInTheDocument();
    expect(screen.getByLabelText('campaign_id')).toHaveValue('camp-123');
  });

  it('submits form and runs query for entered campaignId', async () => {
    mockGetCampaignTimeline.mockResolvedValue({
      events: [makeEvent({ campaignId: 'camp-xyz', name: 'Form Event' })],
      meta: { campaignId: 'camp-xyz', count: 1 },
    });

    renderRoute('/hunting/campaign');

    fireEvent.change(screen.getByLabelText('campaign_id'), { target: { value: 'camp-xyz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(mockGetCampaignTimeline).toHaveBeenCalledWith('camp-xyz', { startTime: undefined, endTime: undefined }));
    expect(await screen.findByText('Form Event')).toBeInTheDocument();
  });

  it('shows error and allows dismiss', async () => {
    mockGetCampaignTimeline.mockRejectedValue(new Error('boom'));
    renderRoute('/hunting/campaign/camp-err');

    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
    const callsBefore = mockClearError.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(mockClearError.mock.calls.length).toBe(callsBefore + 1);
    await waitFor(() => expect(screen.queryByText(/boom/i)).not.toBeInTheDocument());
  });
});
