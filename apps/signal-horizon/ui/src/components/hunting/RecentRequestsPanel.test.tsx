import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { RecentRequest } from '../../hooks/useHunt';
import { RecentRequestsPanel } from './RecentRequestsPanel';

function makeRow(overrides: Partial<RecentRequest> = {}): RecentRequest {
  return {
    requestId: overrides.requestId ?? 'req-1',
    lastSeenAt: overrides.lastSeenAt ?? '2026-02-09T00:00:00.000Z',
    sensorId: overrides.sensorId ?? 'sensor-1',
    path: overrides.path ?? '/login',
    statusCode: overrides.statusCode ?? 404,
    wafAction: overrides.wafAction ?? null,
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('RecentRequestsPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders disabled state when ClickHouse is unavailable', () => {
    const getRecentRequests = vi.fn();
    render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={false} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/ClickHouse disabled/i)).toBeInTheDocument();
    const refreshBtn = screen.getByRole('button', { name: /Refresh/i });
    expect(refreshBtn).toBeDisabled();
    fireEvent.click(refreshBtn);
    expect(getRecentRequests).not.toHaveBeenCalled();
  });

  it('loads and renders recent requests', async () => {
    const getRecentRequests = vi.fn().mockResolvedValue([
      makeRow({ requestId: 'req-a', statusCode: 200, wafAction: 'ALLOW', lastSeenAt: '2026-02-09T01:00:00.000Z' }),
      makeRow({ requestId: 'req-b', statusCode: 403, wafAction: 'BLOCK', path: '/admin', lastSeenAt: '2026-02-09T00:30:00.000Z' }),
      makeRow({ requestId: 'req-c', statusCode: 500, wafAction: null, path: '/oops', lastSeenAt: '2026-02-08T23:00:00.000Z' }),
    ]);

    render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(1));
    expect(getRecentRequests).toHaveBeenCalledWith(50);
    expect(await screen.findByText('req-a')).toBeInTheDocument();
    expect(screen.getByText('req-b')).toBeInTheDocument();
    expect(screen.getByText('req-c')).toBeInTheDocument();

    const open = screen.getAllByRole('link', { name: /Open request timeline/i })[0];
    expect(open).toHaveAttribute('href', '/hunting/request/req-a');

    // Sorted by lastSeenAt desc: req-a should appear before req-b.
    const ids = screen.getAllByText(/req-[abc]/).map((n) => n.textContent);
    expect(ids).toEqual(['req-a', 'req-b', 'req-c']);

    const rowA = screen.getByText('req-a').closest('tr');
    const rowB = screen.getByText('req-b').closest('tr');
    const rowC = screen.getByText('req-c').closest('tr');
    expect(rowA).toBeTruthy();
    expect(rowB).toBeTruthy();
    expect(rowC).toBeTruthy();

    expect(within(rowA!).getAllByRole('cell')[4].textContent).toContain('ALLOW');
    expect(within(rowB!).getAllByRole('cell')[4].textContent).toContain('BLOCK');
    expect((within(rowC!).getAllByRole('cell')[4].textContent ?? '').trim()).toBe('');
  });

  it('keeps a stable order when multiple rows share the same lastSeenAt', async () => {
    const getRecentRequests = vi.fn().mockResolvedValue([
      makeRow({ requestId: 'req-1', lastSeenAt: '2026-02-09T00:00:00.000Z' }),
      makeRow({ requestId: 'req-2', lastSeenAt: '2026-02-09T00:00:00.000Z' }),
      makeRow({ requestId: 'req-3', lastSeenAt: '2026-02-09T00:00:00.000Z' }),
    ]);

    render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(1));
    const ids = screen.getAllByText(/req-[123]/).map((n) => n.textContent);
    expect(ids).toEqual(['req-1', 'req-2', 'req-3']);
  });

  it('encodes special characters in requestId when building the Open link', async () => {
    const getRecentRequests = vi.fn().mockResolvedValue([makeRow({ requestId: 'req/a+b' })]);
    render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('req/a+b')).toBeInTheDocument();
    const open = screen.getByRole('link', { name: /Open request timeline/i });
    expect(open).toHaveAttribute('href', '/hunting/request/req%2Fa%2Bb');
  });

  it('shows error when getRecentRequests fails', async () => {
    const getRecentRequests = vi.fn().mockRejectedValue(new Error('boom'));

    render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
  });

  it('uses fallback error text when getRecentRequests rejects with non-Error', async () => {
    const getRecentRequests = vi.fn().mockRejectedValue('nope');

    render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Failed to load recent requests/i)).toBeInTheDocument();
  });

  it('applies updated limit and refreshes', async () => {
    const getRecentRequests = vi.fn().mockResolvedValue([]);
    render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText(/Limit/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(getRecentRequests).toHaveBeenLastCalledWith(10));
  });

  it('clamps limit: NaN input defaults to 50', async () => {
    const getRecentRequests = vi.fn().mockResolvedValue([]);
    render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText(/Limit/i), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(getRecentRequests).toHaveBeenLastCalledWith(50));
  });

  it('clamps limit: values below 1 are clamped to 1', async () => {
    const getRecentRequests = vi.fn().mockResolvedValue([]);
    render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText(/Limit/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(getRecentRequests).toHaveBeenLastCalledWith(1));
  });

  it('clamps limit: values above 200 are clamped to 200', async () => {
    const getRecentRequests = vi.fn().mockResolvedValue([]);
    render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText(/Limit/i), { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(getRecentRequests).toHaveBeenLastCalledWith(200));
  });

  it('renders empty state message when no requests are returned', async () => {
    const getRecentRequests = vi.fn().mockResolvedValue([]);
    render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('No recent requests.')).toBeInTheDocument();
  });

  it('header Refresh triggers a reload', async () => {
    const getRecentRequests = vi.fn().mockResolvedValue([]);
    render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('No recent requests.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(2));
  });

  it('handles rapid consecutive Refresh clicks: latest response wins', async () => {
    const d1 = deferred<RecentRequest[]>();
    const d2 = deferred<RecentRequest[]>();
    const getRecentRequests = vi
      .fn()
      .mockResolvedValueOnce([]) // initial auto-load
      .mockImplementationOnce(() => d1.promise)
      .mockImplementationOnce(() => d2.promise);

    render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('No recent requests.')).toBeInTheDocument();

    const refreshBtn = screen.getByRole('button', { name: 'Refresh' });
    act(() => {
      refreshBtn.click();
      refreshBtn.click();
    });
    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(3));

    d2.resolve([makeRow({ requestId: 'req-new' })]);
    expect(await screen.findByText('req-new')).toBeInTheDocument();

    d1.resolve([makeRow({ requestId: 'req-old' })]);
    await waitFor(() => {
      expect(screen.queryByText('req-old')).not.toBeInTheDocument();
      expect(screen.getByText('req-new')).toBeInTheDocument();
    });
    expect(screen.getAllByText('req-new')).toHaveLength(1);
  });

  it('shows a loading spinner while fetch is pending', async () => {
    const d = deferred<RecentRequest[]>();
    const getRecentRequests = vi.fn().mockImplementation(() => d.promise);
    render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);

    d.resolve([]);
    await waitFor(() => expect(screen.queryAllByText('Loading...')).toHaveLength(0));
  });

  it('disables Apply while loading, then re-enables after resolve', async () => {
    const d = deferred<RecentRequest[]>();
    const getRecentRequests = vi.fn().mockImplementation(() => d.promise);
    render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();

    d.resolve([]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).not.toBeDisabled());
  });

  it('discards stale responses from superseded requests', async () => {
    const d1 = deferred<RecentRequest[]>();
    const d2 = deferred<RecentRequest[]>();
    const getRecentRequests = vi
      .fn()
      .mockImplementationOnce(() => d1.promise)
      .mockImplementationOnce(() => d2.promise);

    const { rerender } = render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(1));
    rerender(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={false} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(2));

    d2.resolve([makeRow({ requestId: 'req-new', lastSeenAt: '2026-02-09T02:00:00.000Z' })]);
    expect(await screen.findByText('req-new')).toBeInTheDocument();

    d1.resolve([makeRow({ requestId: 'req-old', lastSeenAt: '2026-02-09T03:00:00.000Z' })]);
    await waitFor(() => {
      expect(screen.queryByText('req-old')).not.toBeInTheDocument();
      expect(screen.getByText('req-new')).toBeInTheDocument();
    });
  });

  it('discards stale errors from superseded requests', async () => {
    const d1 = deferred<RecentRequest[]>();
    const d2 = deferred<RecentRequest[]>();
    const getRecentRequests = vi
      .fn()
      .mockImplementationOnce(() => d1.promise)
      .mockImplementationOnce(() => d2.promise);

    const { rerender } = render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(1));
    rerender(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={false} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(2));

    d2.resolve([makeRow({ requestId: 'req-ok' })]);
    expect(await screen.findByText('req-ok')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    d1.reject(new Error('boom'));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText('req-ok')).toBeInTheDocument();
    });
  });

  it('clears rows when ClickHouse is disabled after having loaded data', async () => {
    const getRecentRequests = vi.fn().mockResolvedValue([makeRow({ requestId: 'req-clear' })]);
    const { rerender } = render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('req-clear')).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={false} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );
    expect(screen.queryByText('req-clear')).not.toBeInTheDocument();
    expect(screen.getByText(/ClickHouse disabled/i)).toBeInTheDocument();
  });

  it('re-enabling ClickHouse triggers a fresh load', async () => {
    const getRecentRequests = vi.fn().mockResolvedValue([]);
    const { rerender } = render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={false} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    expect(getRecentRequests).not.toHaveBeenCalled();
    rerender(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(getRecentRequests).toHaveBeenCalledTimes(1));
  });

  it('copies request id to clipboard (success path)', async () => {
    const getRecentRequests = vi.fn().mockResolvedValue([makeRow({ requestId: 'req-copy' })]);
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    try {
      render(
        <MemoryRouter>
          <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
        </MemoryRouter>,
      );

      expect(await screen.findByText('req-copy')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Copy request id/i }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith('req-copy'));
    } finally {
      if (original) {
        Object.defineProperty(navigator, 'clipboard', original);
      }
    }
  });

  it('ignores clipboard errors when copy fails', async () => {
    const getRecentRequests = vi.fn().mockResolvedValue([makeRow({ requestId: 'req-copy-fail' })]);
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = vi.fn().mockRejectedValue(new Error('nope'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    try {
      render(
        <MemoryRouter>
          <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
        </MemoryRouter>,
      );

      expect(await screen.findByText('req-copy-fail')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Copy request id/i }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith('req-copy-fail'));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    } finally {
      if (original) {
        Object.defineProperty(navigator, 'clipboard', original);
      }
    }
  });

  it('formats invalid timestamps as Invalid Date', async () => {
    const getRecentRequests = vi.fn().mockResolvedValue([makeRow({ lastSeenAt: 'not-a-date' })]);
    render(
      <MemoryRouter>
        <RecentRequestsPanel historicalEnabled={true} getRecentRequests={getRecentRequests} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Invalid Date')).toBeInTheDocument();
  });
});
