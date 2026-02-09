import { type LucideIcon } from 'lucide-react';
import { apiFetch } from '../../../lib/api';

// ======================== API Functions ========================

export async function fetchSensorDetail(id: string) {
  return apiFetch(`/fleet/sensors/${id}`);
}

export async function fetchSystemInfo(id: string) {
  return apiFetch(`/fleet/sensors/${id}/system`);
}

export async function fetchPerformance(id: string) {
  return apiFetch(`/fleet/sensors/${id}/performance`);
}

export async function fetchNetwork(id: string) {
  return apiFetch(`/fleet/sensors/${id}/network`);
}

export async function fetchProcesses(id: string) {
  return apiFetch(`/fleet/sensors/${id}/processes`);
}

export async function runDiagnostics(id: string) {
  return apiFetch(`/fleet/sensors/${id}/diagnostics/run`, { method: 'POST' });
}

export async function fetchKernelConfig(id: string) {
  return apiFetch(`/synapse/${id}/config?section=kernel`);
}

export async function updateKernelConfig(id: string, params: Record<string, string>, persist: boolean) {
  return apiFetch(`/synapse/${id}/config`, {
    method: 'PUT',
    body: {
      section: 'kernel',
      config: { params, persist },
    },
  });
}

export async function fetchSystemConfig(id: string) {
  return apiFetch(`/synapse/${id}/config`);
}

export async function fetchCommandHistory(id: string) {
  const data: any = await apiFetch(`/fleet/commands?limit=100&offset=0`);
  const commands = (data?.commands || []).filter((command: any) => command.sensorId === id);
  return { ...data, commands };
}

export async function fetchPingoraConfig(id: string) {
  return apiFetch(`/fleet/sensors/${id}/config/pingora`);
}

export async function updatePingoraConfig(id: string, config: any) {
  return apiFetch(`/fleet/sensors/${id}/config/pingora`, { method: 'POST', body: config });
}

export async function runPingoraAction(id: string, action: 'test' | 'reload' | 'restart') {
  return apiFetch(`/fleet/sensors/${id}/actions/pingora`, { method: 'POST', body: { action } });
}

// ======================== Helper Components ========================

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="text-ink-primary font-mono text-xs">{value}</dd>
    </div>
  );
}

export function ActionButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2 px-4 py-3 bg-surface-subtle border border-border-subtle hover:border-ac-blue/60 hover:bg-surface-card transition-colors focus:outline-none focus:ring-2 focus:ring-ac-blue/50"
    >
      <Icon className="w-4 h-4 text-ac-blue group-hover:text-ac-magenta transition-colors" />
      <span className="text-xs uppercase tracking-[0.2em] text-ink-secondary group-hover:text-ink-primary">
        {label}
      </span>
    </button>
  );
}

// ======================== Helper Functions ========================

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// ======================== Types ========================

export type TabType = 'overview' | 'performance' | 'network' | 'processes' | 'logs' | 'configuration' | 'remote-shell' | 'files';
