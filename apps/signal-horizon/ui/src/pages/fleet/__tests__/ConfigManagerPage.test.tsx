import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigManagerPage } from '../ConfigManagerPage';

vi.mock('../../../components/fleet', () => ({
  MetricCard: ({ label, value }: any) => (
    <div>
      <span>{label}</span>
      <span>{String(value)}</span>
    </div>
  ),
}));

vi.mock('../../../stores/demoModeStore', () => ({
  useDemoMode: () => ({ isEnabled: false, scenario: 'default' }),
}));

vi.mock('../../../hooks/fleet', () => ({
  useSensors: () => ({
    data: [
      { id: 'sensor-1', name: 'Sensor 1', connectionState: 'CONNECTED' },
      { id: 'sensor-2', name: 'Sensor 2', connectionState: 'CONNECTED' },
    ],
  }),
}));

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ toast }),
}));

vi.mock('../../../components/fleet/SynapseConfigEditor', () => ({
  SynapseConfigEditor: ({ value, onChange }: any) => (
    <textarea
      aria-label="config-yaml"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  getDefaultConfigYaml: () => 'server: {}\n',
}));

const apiFetch = vi.fn();
vi.mock('../../../lib/api', () => ({
  apiFetch: (...args: any[]) => apiFetch(...args),
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui as any}</QueryClientProvider>);
}

describe('ConfigManagerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch.mockImplementation(async (endpoint: string, options?: any) => {
      if (endpoint === '/fleet/config/templates' && (!options || options.method === 'GET')) {
        return { templates: [] };
      }
      if (endpoint === '/fleet/config/sync-status') {
        return {
          totalSensors: 2,
          syncedSensors: 2,
          outOfSyncSensors: 0,
          errorSensors: 0,
          syncPercentage: 100,
        };
      }
      if (endpoint.startsWith('/fleet/config/audit')) {
        return { logs: [], total: 0, limit: 25, offset: 0 };
      }
      return {};
    });
  });

  it('creates a template (parses YAML, POSTs config object)', async () => {
    apiFetch.mockImplementation(async (endpoint: string, options?: any) => {
      if (endpoint === '/fleet/config/templates' && (!options || options.method === 'GET')) {
        return { templates: [] };
      }
      if (endpoint === '/fleet/config/templates' && options?.method === 'POST') {
        return {
          id: 'tmpl-1',
          name: options.body.name,
          description: options.body.description,
          environment: options.body.environment,
          config: options.body.config,
          hash: 'hash',
          version: '1.0.0',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      if (endpoint === '/fleet/config/sync-status') {
        return {
          totalSensors: 2,
          syncedSensors: 2,
          outOfSyncSensors: 0,
          errorSensors: 0,
          syncPercentage: 100,
        };
      }
      if (endpoint.startsWith('/fleet/config/audit')) {
        return { logs: [], total: 0, limit: 25, offset: 0 };
      }
      return {};
    });

    renderWithClient(<ConfigManagerPage />);

    await act(async () => {
      fireEvent.click(screen.getByText('Create Template'));
    });

    fireEvent.change(screen.getByPlaceholderText('Template name'), { target: { value: 'My Template' } });
    fireEvent.change(screen.getByLabelText('config-yaml'), { target: { value: 'server:\n  http_addr: "0.0.0.0:80"\n' } });

    const dialog = screen.getByRole('dialog');
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create Template' }));
    });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/fleet/config/templates', {
        method: 'POST',
        body: {
          name: 'My Template',
          description: undefined,
          environment: 'production',
          config: { server: { http_addr: '0.0.0.0:80' } },
        },
      });
    });
  });

  it('pushes to all sensors with sensor IDs (not empty array)', async () => {
    apiFetch.mockImplementation(async (endpoint: string, options?: any) => {
      if (endpoint === '/fleet/config/templates' && (!options || options.method === 'GET')) {
        return {
          templates: [
            {
              id: 'tmpl-1',
              name: 'Template 1',
              description: '',
              environment: 'production',
              version: '1.0.0',
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        };
      }
      if (endpoint === '/fleet/config/push' && options?.method === 'POST') return {};
      if (endpoint === '/fleet/config/sync-status') {
        return {
          totalSensors: 2,
          syncedSensors: 2,
          outOfSyncSensors: 0,
          errorSensors: 0,
          syncPercentage: 100,
        };
      }
      if (endpoint.startsWith('/fleet/config/audit')) {
        return { logs: [], total: 0, limit: 25, offset: 0 };
      }
      return {};
    });

    renderWithClient(<ConfigManagerPage />);

    // Wait for template to render
    await waitFor(() => expect(screen.getByText('Template 1')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText('Push to All'));
    });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/fleet/config/push', {
        method: 'POST',
        body: { templateId: 'tmpl-1', sensorIds: ['sensor-1', 'sensor-2'] },
      });
    });
  });

  it('disables push when no sensors are selected in push modal', async () => {
    apiFetch.mockImplementation(async (endpoint: string, options?: any) => {
      if (endpoint === '/fleet/config/templates' && (!options || options.method === 'GET')) {
        return {
          templates: [
            {
              id: 'tmpl-1',
              name: 'Template 1',
              description: '',
              environment: 'production',
              version: '1.0.0',
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        };
      }
      if (endpoint === '/fleet/config/sync-status') {
        return {
          totalSensors: 2,
          syncedSensors: 2,
          outOfSyncSensors: 0,
          errorSensors: 0,
          syncPercentage: 100,
        };
      }
      if (endpoint.startsWith('/fleet/config/audit')) {
        return { logs: [], total: 0, limit: 25, offset: 0 };
      }
      return {};
    });

    renderWithClient(<ConfigManagerPage />);
    await waitFor(() => expect(screen.getByText('Template 1')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText('Push to Selected'));
    });

    const dialog = screen.getByRole('dialog');
    const pushButton = within(dialog).getByRole('button', { name: /Push \(0\)/ });
    expect(pushButton).toBeDisabled();
  });
});
