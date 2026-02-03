/**
 * SynapseConfigEditor - Visual and YAML editor for Synapse sensor configuration
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Code, Settings, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { CodeEditor } from '../ctrlx/CodeEditor';
import YAML from 'yaml';

// Default config structure
export interface SynapseConfig {
  server: {
    listen: string;
    admin_listen: string;
    workers: number;
  };
  upstreams: Array<{ host: string; port: number }>;
  rate_limit: {
    enabled: boolean;
    rps: number;
    per_ip_rps: number;
  };
  logging: {
    level: string;
    format: string;
    access_log: boolean;
  };
  detection: {
    sqli: boolean;
    xss: boolean;
    path_traversal: boolean;
    command_injection: boolean;
    action: string;
    block_status: number;
  };
  tls: {
    enabled: boolean;
    min_version: string;
    cert_path?: string;
    key_path?: string;
  };
  tarpit: {
    enabled: boolean;
    base_delay_ms: number;
    max_delay_ms: number;
  };
  dlp: {
    enabled: boolean;
    max_scan_size: number;
  };
}

const defaultConfig: SynapseConfig = {
  server: {
    listen: '0.0.0.0:6190',
    admin_listen: '0.0.0.0:6191',
    workers: 0,
  },
  upstreams: [{ host: '127.0.0.1', port: 8080 }],
  rate_limit: {
    enabled: true,
    rps: 10000,
    per_ip_rps: 100,
  },
  logging: {
    level: 'info',
    format: 'json',
    access_log: true,
  },
  detection: {
    sqli: true,
    xss: true,
    path_traversal: true,
    command_injection: true,
    action: 'block',
    block_status: 403,
  },
  tls: {
    enabled: false,
    min_version: '1.2',
  },
  tarpit: {
    enabled: true,
    base_delay_ms: 1000,
    max_delay_ms: 30000,
  },
  dlp: {
    enabled: true,
    max_scan_size: 5242880,
  },
};

interface Props {
  value: string;
  onChange: (yaml: string) => void;
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, children, defaultOpen = true }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-border-subtle rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-subtle hover:bg-surface-elevated transition-colors"
      >
        <span className="font-medium text-ink-primary">{title}</span>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-ink-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-ink-muted" />
        )}
      </button>
      {isOpen && <div className="p-4 space-y-4 bg-surface-base">{children}</div>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        className={`relative w-10 h-6 rounded-full transition-colors ${
          checked ? 'bg-ac-blue' : 'bg-surface-elevated'
        }`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </div>
      <span className="text-sm text-ink-secondary">{label}</span>
    </label>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder }: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-ink-secondary mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-surface-elevated border border-border-subtle rounded text-ink-primary text-sm focus:outline-none focus:ring-1 focus:ring-ac-blue"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm text-ink-secondary mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-surface-elevated border border-border-subtle rounded text-ink-primary text-sm focus:outline-none focus:ring-1 focus:ring-ac-blue"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export function SynapseConfigEditor({ value, onChange }: Props) {
  const [mode, setMode] = useState<'visual' | 'yaml'>('visual');
  const [config, setConfig] = useState<SynapseConfig>(defaultConfig);
  const [yamlError, setYamlError] = useState<string | null>(null);

  // Parse YAML to config on mount and when value changes externally
  useEffect(() => {
    try {
      const parsed = YAML.parse(value);
      if (parsed && typeof parsed === 'object') {
        setConfig({ ...defaultConfig, ...parsed });
        setYamlError(null);
      }
    } catch {
      // Keep current config if YAML is invalid
    }
  }, []);

  // Update YAML when config changes in visual mode
  const updateConfigAndYaml = useCallback((newConfig: SynapseConfig) => {
    setConfig(newConfig);
    const yaml = YAML.stringify(newConfig, { indent: 2 });
    onChange(yaml);
  }, [onChange]);

  // Handle YAML text changes
  const handleYamlChange = useCallback((yaml: string) => {
    onChange(yaml);
    try {
      const parsed = YAML.parse(yaml);
      if (parsed && typeof parsed === 'object') {
        setConfig({ ...defaultConfig, ...parsed });
        setYamlError(null);
      }
    } catch (e) {
      setYamlError(e instanceof Error ? e.message : 'Invalid YAML');
    }
  }, [onChange]);

  // Helper to update nested config
  const updateConfig = <K extends keyof SynapseConfig>(
    section: K,
    field: keyof SynapseConfig[K],
    value: SynapseConfig[K][keyof SynapseConfig[K]]
  ) => {
    const newConfig = {
      ...config,
      [section]: {
        ...config[section],
        [field]: value,
      },
    };
    updateConfigAndYaml(newConfig);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mode Toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode('visual')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'visual'
              ? 'bg-ac-blue text-white'
              : 'bg-surface-elevated text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <Settings className="w-4 h-4" />
          Visual
        </button>
        <button
          type="button"
          onClick={() => setMode('yaml')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'yaml'
              ? 'bg-ac-blue text-white'
              : 'bg-surface-elevated text-ink-secondary hover:text-ink-primary'
          }`}
        >
          <Code className="w-4 h-4" />
          YAML
        </button>
      </div>

      {mode === 'yaml' ? (
        <div className="flex-1 flex flex-col">
          {yamlError && (
            <div className="mb-2 p-2 bg-ac-red/10 border border-ac-red/30 rounded text-sm text-ac-red">
              {yamlError}
            </div>
          )}
          <div className="flex-1 border border-border-subtle rounded-lg overflow-hidden">
            <CodeEditor
              value={value}
              onChange={handleYamlChange}
              language="yaml"
              height="100%"
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Server Section */}
          <Section title="Server">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Listen Address"
                value={config.server.listen}
                onChange={(v) => updateConfig('server', 'listen', v)}
                placeholder="0.0.0.0:6190"
              />
              <Input
                label="Admin Listen Address"
                value={config.server.admin_listen}
                onChange={(v) => updateConfig('server', 'admin_listen', v)}
                placeholder="0.0.0.0:6191"
              />
              <Input
                label="Workers (0 = auto)"
                value={config.server.workers}
                onChange={(v) => updateConfig('server', 'workers', parseInt(v) || 0)}
                type="number"
              />
            </div>
          </Section>

          {/* Upstreams Section */}
          <Section title="Upstreams">
            <div className="space-y-3">
              {config.upstreams.map((upstream, idx) => (
                <div key={idx} className="flex items-end gap-3">
                  <div className="flex-1">
                    <Input
                      label={idx === 0 ? 'Host' : ''}
                      value={upstream.host}
                      onChange={(v) => {
                        const newUpstreams = [...config.upstreams];
                        newUpstreams[idx] = { ...newUpstreams[idx], host: v };
                        updateConfigAndYaml({ ...config, upstreams: newUpstreams });
                      }}
                      placeholder="127.0.0.1"
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      label={idx === 0 ? 'Port' : ''}
                      value={upstream.port}
                      onChange={(v) => {
                        const newUpstreams = [...config.upstreams];
                        newUpstreams[idx] = { ...newUpstreams[idx], port: parseInt(v) || 8080 };
                        updateConfigAndYaml({ ...config, upstreams: newUpstreams });
                      }}
                      type="number"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newUpstreams = config.upstreams.filter((_, i) => i !== idx);
                      if (newUpstreams.length === 0) newUpstreams.push({ host: '127.0.0.1', port: 8080 });
                      updateConfigAndYaml({ ...config, upstreams: newUpstreams });
                    }}
                    className="p-2 text-ink-muted hover:text-ac-red transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  updateConfigAndYaml({
                    ...config,
                    upstreams: [...config.upstreams, { host: '127.0.0.1', port: 8080 }],
                  });
                }}
                className="flex items-center gap-2 text-sm text-ac-blue hover:text-ac-blue/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Upstream
              </button>
            </div>
          </Section>

          {/* Rate Limiting Section */}
          <Section title="Rate Limiting">
            <Toggle
              label="Enable Rate Limiting"
              checked={config.rate_limit.enabled}
              onChange={(v) => updateConfig('rate_limit', 'enabled', v)}
            />
            <div className="grid grid-cols-2 gap-4 mt-3">
              <Input
                label="Global RPS Limit"
                value={config.rate_limit.rps}
                onChange={(v) => updateConfig('rate_limit', 'rps', parseInt(v) || 10000)}
                type="number"
              />
              <Input
                label="Per-IP RPS Limit"
                value={config.rate_limit.per_ip_rps}
                onChange={(v) => updateConfig('rate_limit', 'per_ip_rps', parseInt(v) || 100)}
                type="number"
              />
            </div>
          </Section>

          {/* Logging Section */}
          <Section title="Logging">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Log Level"
                value={config.logging.level}
                onChange={(v) => updateConfig('logging', 'level', v)}
                options={[
                  { value: 'trace', label: 'Trace' },
                  { value: 'debug', label: 'Debug' },
                  { value: 'info', label: 'Info' },
                  { value: 'warn', label: 'Warn' },
                  { value: 'error', label: 'Error' },
                ]}
              />
              <Select
                label="Log Format"
                value={config.logging.format}
                onChange={(v) => updateConfig('logging', 'format', v)}
                options={[
                  { value: 'json', label: 'JSON' },
                  { value: 'text', label: 'Text' },
                ]}
              />
            </div>
            <Toggle
              label="Enable Access Logs"
              checked={config.logging.access_log}
              onChange={(v) => updateConfig('logging', 'access_log', v)}
            />
          </Section>

          {/* Detection Section */}
          <Section title="WAF Detection">
            <div className="grid grid-cols-2 gap-4">
              <Toggle
                label="SQL Injection"
                checked={config.detection.sqli}
                onChange={(v) => updateConfig('detection', 'sqli', v)}
              />
              <Toggle
                label="XSS"
                checked={config.detection.xss}
                onChange={(v) => updateConfig('detection', 'xss', v)}
              />
              <Toggle
                label="Path Traversal"
                checked={config.detection.path_traversal}
                onChange={(v) => updateConfig('detection', 'path_traversal', v)}
              />
              <Toggle
                label="Command Injection"
                checked={config.detection.command_injection}
                onChange={(v) => updateConfig('detection', 'command_injection', v)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <Select
                label="Action"
                value={config.detection.action}
                onChange={(v) => updateConfig('detection', 'action', v)}
                options={[
                  { value: 'block', label: 'Block' },
                  { value: 'log', label: 'Log Only' },
                  { value: 'challenge', label: 'Challenge' },
                ]}
              />
              <Input
                label="Block Status Code"
                value={config.detection.block_status}
                onChange={(v) => updateConfig('detection', 'block_status', parseInt(v) || 403)}
                type="number"
              />
            </div>
          </Section>

          {/* TLS Section */}
          <Section title="TLS" defaultOpen={false}>
            <Toggle
              label="Enable TLS"
              checked={config.tls.enabled}
              onChange={(v) => updateConfig('tls', 'enabled', v)}
            />
            {config.tls.enabled && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <Select
                  label="Minimum TLS Version"
                  value={config.tls.min_version}
                  onChange={(v) => updateConfig('tls', 'min_version', v)}
                  options={[
                    { value: '1.2', label: 'TLS 1.2' },
                    { value: '1.3', label: 'TLS 1.3' },
                  ]}
                />
                <Input
                  label="Certificate Path"
                  value={config.tls.cert_path || ''}
                  onChange={(v) => updateConfig('tls', 'cert_path', v)}
                  placeholder="/etc/certs/server.pem"
                />
                <Input
                  label="Key Path"
                  value={config.tls.key_path || ''}
                  onChange={(v) => updateConfig('tls', 'key_path', v)}
                  placeholder="/etc/certs/server.key"
                />
              </div>
            )}
          </Section>

          {/* Tarpit Section */}
          <Section title="Tarpit" defaultOpen={false}>
            <Toggle
              label="Enable Tarpit"
              checked={config.tarpit.enabled}
              onChange={(v) => updateConfig('tarpit', 'enabled', v)}
            />
            {config.tarpit.enabled && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <Input
                  label="Base Delay (ms)"
                  value={config.tarpit.base_delay_ms}
                  onChange={(v) => updateConfig('tarpit', 'base_delay_ms', parseInt(v) || 1000)}
                  type="number"
                />
                <Input
                  label="Max Delay (ms)"
                  value={config.tarpit.max_delay_ms}
                  onChange={(v) => updateConfig('tarpit', 'max_delay_ms', parseInt(v) || 30000)}
                  type="number"
                />
              </div>
            )}
          </Section>

          {/* DLP Section */}
          <Section title="Data Loss Prevention" defaultOpen={false}>
            <Toggle
              label="Enable DLP"
              checked={config.dlp.enabled}
              onChange={(v) => updateConfig('dlp', 'enabled', v)}
            />
            {config.dlp.enabled && (
              <div className="mt-3">
                <Input
                  label="Max Scan Size (bytes)"
                  value={config.dlp.max_scan_size}
                  onChange={(v) => updateConfig('dlp', 'max_scan_size', parseInt(v) || 5242880)}
                  type="number"
                />
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

export function getDefaultConfigYaml(): string {
  return YAML.stringify(defaultConfig, { indent: 2 });
}
