/**
 * FleetSiteCreateDrawer — Create a new Synapse site on a chosen sensor.
 *
 * Intentionally minimal: collects only the identity fields required
 * by Synapse's POST /sites — sensor, hostname, upstreams. WAF, rate
 * limit, access control, TLS, headers all default to "inherit global"
 * and can be tuned via the edit drawer after creation.
 *
 * On success, bubbles the newly-created FleetSite back to the caller
 * via `onCreated` so the parent can hand it to the edit drawer
 * immediately — bridges "create with defaults" and "tune now"
 * without a table-scan-then-click round-trip.
 */

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Server } from 'lucide-react';
import {
  Alert,
  Button,
  Drawer,
  Input,
  Panel,
  Select,
  Stack,
  Text,
  colors,
} from '@/ui';
import { apiFetch } from '../../lib/api';
import type { FleetSite } from '../../hooks/fleet';
import type { SensorSummary } from '../../types/fleet';

interface FleetSiteCreateDrawerProps {
  open: boolean;
  onClose: () => void;
  sensors: SensorSummary[];
  /** Preselect a sensor (e.g. from a sensor-filter on the page). */
  defaultSensorId?: string;
  /** Called after successful creation with the new site's shape. */
  onCreated?: (site: FleetSite) => void;
}

interface UpstreamRow {
  host: string;
  port: string; // string while editing; validated on submit
}

interface FormState {
  sensorId: string;
  hostname: string;
  upstreams: UpstreamRow[];
}

const emptyForm = (defaultSensorId?: string): FormState => ({
  sensorId: defaultSensorId ?? '',
  hostname: '',
  upstreams: [{ host: '', port: '' }],
});

// Loose hostname validation: allow wildcards, letters/digits/hyphens/
// dots. Synapse's validator is the final word — this just catches the
// obvious typos before a round-trip.
function isValidHostname(host: string): boolean {
  if (!host.trim()) return false;
  return /^[a-zA-Z0-9*._-]+$/.test(host.trim());
}

function validateForm(form: FormState): string | null {
  if (!form.sensorId) return 'Pick a sensor to host this site on.';
  if (!form.hostname.trim()) return 'Hostname is required.';
  if (!isValidHostname(form.hostname))
    return 'Hostname contains invalid characters. Allowed: letters, digits, dots, hyphens, and `*` for wildcards.';

  const upstreams = form.upstreams.filter((u) => u.host.trim() || u.port.trim());
  if (upstreams.length === 0) return 'At least one upstream is required.';

  for (const [i, u] of upstreams.entries()) {
    if (!u.host.trim()) return `Upstream #${i + 1}: host is required.`;
    const port = Number(u.port);
    if (!u.port.trim() || Number.isNaN(port) || port < 1 || port > 65535) {
      return `Upstream #${i + 1}: port must be a number between 1 and 65535.`;
    }
  }
  return null;
}

export function FleetSiteCreateDrawer({
  open,
  onClose,
  sensors,
  defaultSensorId,
  onCreated,
}: FleetSiteCreateDrawerProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultSensorId));
  const [error, setError] = useState<string | null>(null);

  // Reset form on open so re-opening always starts fresh rather than
  // holding stale input from a previous session. Also picks up a new
  // defaultSensorId if the parent's sensor filter changed.
  useEffect(() => {
    if (open) {
      setForm(emptyForm(defaultSensorId));
      setError(null);
    }
  }, [open, defaultSensorId]);

  const createMutation = useMutation({
    mutationFn: async (state: FormState): Promise<Record<string, unknown>> => {
      const body = {
        hostname: state.hostname.trim(),
        upstreams: state.upstreams
          .filter((u) => u.host.trim() && u.port.trim())
          .map((u) => ({ host: u.host.trim(), port: Number(u.port) })),
      };
      const res = await apiFetch<unknown>(
        `/synapse/${encodeURIComponent(state.sensorId)}/proxy/sites`,
        { method: 'POST', body },
      );
      // Unwrap {data: {...}} vs bare object — Synapse handlers vary.
      const site = (res as { data?: unknown }).data ?? res;
      return site as Record<string, unknown>;
    },
    onSuccess: (site, state) => {
      queryClient.invalidateQueries({ queryKey: ['fleet', 'sites'] });
      // Hand off to the edit drawer flow if the caller wants it —
      // we synthesise a FleetSite shape from the state + response so
      // the caller can open the edit drawer without a refetch.
      if (onCreated) {
        const sensor = sensors.find((s) => s.id === state.sensorId);
        onCreated({
          sensorId: state.sensorId,
          sensorName: sensor?.name ?? state.sensorId,
          hostname: state.hostname.trim(),
          upstreams: state.upstreams
            .filter((u) => u.host.trim() && u.port.trim())
            .map((u) => `${u.host.trim()}:${u.port}`),
          tlsEnabled: false,
          wafEnabled: true,
          rateLimitRps: undefined,
          accessDefault: undefined,
          raw: site,
        });
      }
      onClose();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      setError(msg);
    },
  });

  const handleSubmit = () => {
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    createMutation.mutate(form);
  };

  const updateUpstream = (index: number, patch: Partial<UpstreamRow>) => {
    setForm((prev) => ({
      ...prev,
      upstreams: prev.upstreams.map((u, i) => (i === index ? { ...u, ...patch } : u)),
    }));
  };

  const addUpstream = () => {
    setForm((prev) => ({ ...prev, upstreams: [...prev.upstreams, { host: '', port: '' }] }));
  };

  const removeUpstream = (index: number) => {
    setForm((prev) => ({
      ...prev,
      // Always leave at least one row so the form has somewhere to type.
      upstreams:
        prev.upstreams.length <= 1
          ? [{ host: '', port: '' }]
          : prev.upstreams.filter((_, i) => i !== index),
    }));
  };

  return (
    <Drawer open={open} onClose={onClose} title="Create site" width="480px">
      <Stack direction="column" gap="md">
        {/* Sensor picker — required. The site lives on exactly one
            sensor; the API enforces this at the URL level
            (/synapse/:sensorId/proxy/sites). */}
        <Panel tone="info" padding="md" spacing="sm">
          <Stack direction="row" align="center" gap="sm" className="mb-2">
            <Server className="w-4 h-4 text-ac-blue" />
            <Text variant="label">Sensor</Text>
          </Stack>
          <Select
            id="create-site-sensor"
            label="Host this site on"
            value={form.sensorId}
            onChange={(e) => setForm((f) => ({ ...f, sensorId: e.target.value }))}
            size="sm"
            options={[
              { value: '', label: 'Select a sensor…' },
              ...sensors.map((s) => ({ value: s.id, label: s.name ?? s.id })),
            ]}
          />
        </Panel>

        {/* Hostname */}
        <Panel tone="info" padding="md" spacing="sm">
          <Text variant="label" className="mb-2">Hostname</Text>
          <Input
            id="create-site-hostname"
            label="Hostname or wildcard (e.g. api.example.com, *.example.com)"
            value={form.hostname}
            onChange={(e) => setForm((f) => ({ ...f, hostname: e.target.value }))}
            placeholder="api.example.com"
            size="sm"
          />
        </Panel>

        {/* Upstreams — at least one required, each host:port */}
        <Panel tone="info" padding="md" spacing="sm">
          <Stack direction="row" align="center" justify="space-between" className="mb-2">
            <Text variant="label">Upstreams</Text>
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={addUpstream}
            >
              Add upstream
            </Button>
          </Stack>
          <Stack direction="column" gap="sm">
            {form.upstreams.map((u, i) => (
              <Stack key={i} direction="row" gap="sm" align="flex-end">
                <div className="flex-1">
                  <Input
                    id={`create-site-upstream-host-${i}`}
                    label={i === 0 ? 'Host' : undefined}
                    value={u.host}
                    onChange={(e) => updateUpstream(i, { host: e.target.value })}
                    placeholder="127.0.0.1"
                    size="sm"
                  />
                </div>
                <div style={{ width: '120px' }}>
                  <Input
                    id={`create-site-upstream-port-${i}`}
                    label={i === 0 ? 'Port' : undefined}
                    type="number"
                    min={1}
                    max={65535}
                    value={u.port}
                    onChange={(e) => updateUpstream(i, { port: e.target.value })}
                    placeholder="8080"
                    size="sm"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => removeUpstream(i)}
                  aria-label={`Remove upstream ${i + 1}`}
                  style={{ color: colors.gray.mid }}
                >
                  {''}
                </Button>
              </Stack>
            ))}
          </Stack>
          <Text variant="tag" muted>
            The site will proxy traffic to these backends. Multiple upstreams load-balance
            round-robin by default.
          </Text>
        </Panel>

        <Text variant="body" muted>
          WAF, rate limiting, access control, and TLS all default to the sensor's global
          settings. Tune them per-site after creation via the edit drawer.
        </Text>

        {error && <Alert status="error">{error}</Alert>}

        <Stack direction="row" justify="flex-end" gap="sm">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating…' : 'Create site'}
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
