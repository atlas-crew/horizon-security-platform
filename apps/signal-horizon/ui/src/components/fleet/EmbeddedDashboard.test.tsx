/**
 * EmbeddedDashboard Component Test Suite
 *
 * Tests for the embedded dashboard proxy component used
 * for displaying remote sensor dashboards.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmbeddedDashboard } from './EmbeddedDashboard';

// Mock fetch
const mockFetch = vi.fn();

describe('EmbeddedDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><body>Dashboard Content</body></html>'),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render header with sensor info', () => {
      render(<EmbeddedDashboard sensorId="sensor-1" />);

      expect(screen.getByText(/Sensor Dashboard/i)).toBeInTheDocument();
      expect(screen.getByText(/sensor-1/i)).toBeInTheDocument();
    });

    it('should show tunnel mode indicator when tunnelMode is true', () => {
      render(<EmbeddedDashboard sensorId="sensor-1" tunnelMode={true} />);

      expect(screen.getByText(/Tunnel Mode/i)).toBeInTheDocument();
    });

    it('should show direct mode indicator when tunnelMode is false', () => {
      render(<EmbeddedDashboard sensorId="sensor-1" tunnelMode={false} />);

      expect(screen.getByText(/Direct Mode/i)).toBeInTheDocument();
    });

    it('should show loading state initially in tunnel mode', () => {
      render(<EmbeddedDashboard sensorId="sensor-1" tunnelMode={true} />);

      expect(screen.getByText(/Loading dashboard/i)).toBeInTheDocument();
    });

    it('should show connected status after successful load', async () => {
      render(<EmbeddedDashboard sensorId="sensor-1" tunnelMode={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Connected/i)).toBeInTheDocument();
      });
    });
  });

  describe('Tunnel Mode', () => {
    it('should fetch dashboard content from tunnel proxy', async () => {
      render(<EmbeddedDashboard sensorId="sensor-1" sessionId="session-1" tunnelMode={true} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/v1/tunnel/proxy/session-1');
      });
    });

    it('should use sensorId when sessionId not provided', async () => {
      render(<EmbeddedDashboard sensorId="sensor-1" tunnelMode={true} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/v1/tunnel/proxy/sensor-1');
      });
    });

    it('should call onLoad callback after successful load', async () => {
      const onLoad = vi.fn();

      render(<EmbeddedDashboard sensorId="sensor-1" tunnelMode={true} onLoad={onLoad} />);

      await waitFor(() => {
        expect(onLoad).toHaveBeenCalled();
      });
    });
  });

  describe('Direct Mode', () => {
    it('should not fetch content in direct mode', () => {
      render(<EmbeddedDashboard sensorId="sensor-1" tunnelMode={false} />);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should show error state when fetch fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Service Unavailable',
      });

      render(<EmbeddedDashboard sensorId="sensor-1" tunnelMode={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch dashboard/i)).toBeInTheDocument();
      });
    });

    it('should show disconnected status on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<EmbeddedDashboard sensorId="sensor-1" tunnelMode={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Disconnected/i)).toBeInTheDocument();
      });
    });

    it('should call onError callback when fetch fails', async () => {
      const onError = vi.fn();
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<EmbeddedDashboard sensorId="sensor-1" tunnelMode={true} onError={onError} />);

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });

    it('should show retry button on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      render(<EmbeddedDashboard sensorId="sensor-1" tunnelMode={true} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
      });
    });
  });

  describe('Actions', () => {
    it('should refresh content when refresh button clicked', async () => {
      render(<EmbeddedDashboard sensorId="sensor-1" tunnelMode={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Connected/i)).toBeInTheDocument();
      });

      const refreshButton = screen.getByTitle(/Refresh Dashboard/i);
      fireEvent.click(refreshButton);

      // Should have been called twice (initial + refresh)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should toggle fullscreen mode', async () => {
      render(<EmbeddedDashboard sensorId="sensor-1" tunnelMode={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Connected/i)).toBeInTheDocument();
      });

      const fullscreenButton = screen.getByTitle(/Fullscreen/i);
      fireEvent.click(fullscreenButton);

      // Should now show exit fullscreen
      expect(screen.getByTitle(/Exit Fullscreen/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible title on iframe', async () => {
      render(<EmbeddedDashboard sensorId="sensor-1" tunnelMode={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Connected/i)).toBeInTheDocument();
      });

      const iframe = document.querySelector('iframe');
      expect(iframe).toHaveAttribute('title', 'Sensor sensor-1 Dashboard');
    });
  });
});
