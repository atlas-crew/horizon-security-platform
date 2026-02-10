/**
 * Rule Distribution Page
 * Enhanced fleet-wide rule management using the polished card-based UI
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Play,
  Pause,
  Settings,
  ChevronDown,
  ChevronRight,
  Activity,
  AlertTriangle,
  Clock,
  RefreshCw,
  Zap,
  Loader2
} from 'lucide-react';
import { clsx } from 'clsx';
import { useBeamRules } from '../../hooks/useBeamRules';
import { useSensors } from '../../hooks/fleet';
import { StatsGridSkeleton, CardSkeleton } from '../../components/LoadingStates';
import { apiFetch } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { Rule } from '../../types/beam';

type RuleStatus = 'active' | 'paused' | 'deploying' | 'failed';
type RuleSeverity = 'critical' | 'high' | 'medium' | 'low';

const SEVERITY_CONFIG: Record<RuleSeverity, { color: string; bg: string }> = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/20' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/20' },
  medium: { color: 'text-sky-400', bg: 'bg-sky-500/20' },
  low: { color: 'text-blue-400', bg: 'bg-blue-500/20' },
};

const STATUS_CONFIG: Record<RuleStatus, { icon: React.ElementType; color: string; label: string }> = {
  active: { icon: ShieldCheck, color: 'text-green-400', label: 'Active' },
  paused: { icon: ShieldOff, color: 'text-gray-400', label: 'Paused' },
  deploying: { icon: Clock, color: 'text-blue-400', label: 'Deploying' },
  failed: { icon: ShieldAlert, color: 'text-red-400', label: 'Failed' },
};

// Stat Card
function StatCard({
  label,
  value,
  icon: Icon,
  color = 'text-horizon-400',
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-card border border-border-subtle p-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-secondary">{label}</p>
          <p className="mt-1 text-2xl font-bold text-ink-primary">{value}</p>
        </div>
        <div className="p-3 bg-surface-subtle/50">
          <Icon className={clsx('w-6 h-6', color)} />
        </div>
      </div>
    </motion.div>
  );
}

// Format relative time
function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Rule Card Component
function RuleCard({
  rule,
  isExpanded,
  onToggle,
  onToggleEnabled,
  isUpdating = false,
}: {
  rule: Rule;
  isExpanded: boolean;
  onToggle: () => void;
  onToggleEnabled: () => void;
  isUpdating?: boolean;
}) {
  const severityConfig = SEVERITY_CONFIG[rule.severity as RuleSeverity] || SEVERITY_CONFIG.medium;
  const statusConfig = STATUS_CONFIG[rule.status as RuleStatus] || STATUS_CONFIG.active;
  const StatusIcon = statusConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'bg-surface-card border overflow-hidden transition-all',
        isUpdating && 'opacity-60 grayscale',
        rule.status === 'failed'
          ? 'border-red-500/50'
          : rule.status === 'deploying'
          ? 'border-blue-500/50'
          : 'border-border-subtle hover:border-ac-blue/50'
      )}
    >
      <div className="px-5 py-4 flex items-center justify-between">
        <button
          onClick={onToggle}
          className="flex items-center gap-4 flex-1 text-left"
        >
          <div className="p-2 bg-surface-subtle">
            <Shield className="w-5 h-5 text-horizon-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-ink-primary font-medium">{rule.name}</h3>
              <span className={clsx('px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest', severityConfig.color, severityConfig.bg)}>
                {rule.severity}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">{rule.category}</p>
          </div>
        </button>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-ink-muted tracking-tighter">Triggers</p>
            <p className="text-ink-primary font-mono text-sm">{(rule.triggers24h || 0).toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-ink-muted tracking-tighter">Last Seen</p>
            <p className="text-ink-secondary text-sm">{formatRelativeTime(rule.lastTriggered)}</p>
          </div>
          <div className={clsx('flex items-center gap-1', statusConfig.color)}>
            <StatusIcon className="w-4 h-4" />
            <span className="text-[10px] uppercase font-bold tracking-widest">{statusConfig.label}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleEnabled();
            }}
            disabled={isUpdating}
            className={clsx(
              'relative w-12 h-6 transition-colors',
              rule.enabled ? 'bg-status-success' : 'bg-surface-elevated border border-border-subtle'
            )}
          >
            <span
              className={clsx(
                'absolute top-1 w-4 h-4 bg-white shadow transition-transform',
                rule.enabled ? 'left-7' : 'left-1'
              )}
            />
          </button>
          <button onClick={onToggle}>
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-ink-secondary" />
            ) : (
              <ChevronRight className="w-5 h-5 text-ink-secondary" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="px-5 py-4 border-t border-border-subtle bg-surface-subtle">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] uppercase font-bold text-ink-muted tracking-widest mb-1">Description</p>
              <p className="text-sm text-ink-secondary leading-relaxed">{rule.description}</p>
            </div>
            <div className="flex items-center gap-8">
              <div>
                <p className="text-[10px] uppercase font-bold text-ink-muted tracking-widest mb-1">Fleet Synchronization</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-32 h-2 bg-surface-base overflow-hidden border border-border-subtle">
                    <div
                      className={clsx(
                        'h-full',
                        rule.deployedSensors === rule.totalSensors
                          ? 'bg-status-success'
                          : rule.deployedSensors > 0
                          ? 'bg-ac-blue'
                          : 'bg-surface-elevated'
                      )}
                      style={{ width: `${(rule.deployedSensors / rule.totalSensors) * 100}%` }}
                    />
                  </div>
                  <span className="text-ink-secondary text-xs font-mono">
                    {rule.deployedSensors}/{rule.totalSensors} online
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-ink-muted tracking-widest mb-1">Created</p>
                <p className="text-ink-secondary text-sm font-mono">
                  {new Date(rule.createdAt || Date.now()).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button 
                onClick={(e) => { e.stopPropagation(); onToggleEnabled(); }}
                disabled={isUpdating}
                className={clsx(
                  "px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2",
                  rule.enabled ? "bg-ac-navy text-white hover:bg-ac-navy-light" : "bg-status-success text-white hover:bg-status-success/90"
                )}
              >
                {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : rule.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {rule.enabled ? 'Pause Rule' : 'Activate Rule'}
              </button>
              <button className="px-4 py-2 border-2 border-border-subtle text-ink-secondary hover:text-ink-primary hover:bg-surface-card text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2">
                <Settings className="w-3.5 h-3.5" />
                Configure Logic
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function RuleDistributionPage() {
  useDocumentTitle('Fleet - Rule Distribution');
  const { ruleId } = useParams<{ ruleId?: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [updatingRuleId, setUpdatingRuleId] = useState<string | null>(null);
  const [confirmToggleRule, setConfirmToggleRule] = useState<Rule | null>(null);

  // Fetch data
  const { rules, isLoading: rulesLoading, refetch, updateRule } = useBeamRules({ pollingInterval: 30000 });
  const { data: sensors = [] } = useSensors();

  // Auto-expand rule from URL (finding 16)
  useEffect(() => {
    if (ruleId && rules.length > 0) {
      const rule = rules.find(r => r.id === ruleId);
      if (rule) {
        setExpandedRules(prev => {
          if (prev.has(ruleId)) return prev;
          const next = new Set(prev);
          next.add(ruleId);
          return next;
        });
      }
    }
  }, [ruleId, rules]);

  // Fleet distribution mutation
  const deployMutation = useMutation({
    mutationFn: async (ruleIds: string[]) => {
      const sensorIds = sensors.filter(s => s.status === 'online').map(s => s.id);
      if (sensorIds.length === 0) throw new Error('No online sensors found to target');
      
      await apiFetch('/fleet/rules/push', { 
        method: 'POST', 
        body: { 
          ruleIds, 
          sensorIds, 
          strategy: 'immediate' 
        } 
      });
    },
    onSuccess: () => {
      toast.success('Rules pushed to all online fleet sensors');
      queryClient.invalidateQueries({ queryKey: ['fleet', 'rules'] });
    },
    onError: (err) => {
      toast.error('Failed to distribute rules: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  });

  const handleToggleRule = useCallback((ruleId: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) newExpanded.delete(ruleId);
    else newExpanded.add(ruleId);
    setExpandedRules(newExpanded);
  }, [expandedRules]);

  const handleToggleEnabled = async (rule: Rule) => {
    setUpdatingRuleId(rule.id);
    setConfirmToggleRule(null);
    try {
      // 1. Update rule in database
      const nextEnabled = !rule.enabled;
      await updateRule(rule.id, { enabled: nextEnabled });
      
      // 2. Immediately push update to the whole fleet
      await deployMutation.mutateAsync([rule.id]);
      
      toast.success(`Rule "${rule.name}" ${nextEnabled ? 'activated' : 'paused'} across fleet`);
    } catch (err) {
      toast.error(`Failed to toggle rule "${rule.name}": ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUpdatingRuleId(null);
    }
  };

  const handleDeployAll = async () => {
    const activeRuleIds = rules.filter(r => r.enabled).map(r => r.id);
    if (activeRuleIds.length === 0) {
      toast.info('No active rules to deploy');
      return;
    }
    await deployMutation.mutateAsync(activeRuleIds);
  };

  // Stats
  const stats = useMemo(() => {
    const total = rules.length;
    const active = rules.filter((r) => r.enabled).length;
    const totalTriggers = rules.reduce((sum, r) => sum + (r.triggers24h || 0), 0);
    const avgSync = total > 0 ? (rules.reduce((sum, r) => sum + (r.deployedSensors || 0), 0) / (total * (sensors.length || 1))) * 100 : 100;

    return { total, active, totalTriggers, avgSync };
  }, [rules, sensors]);

  if (rulesLoading) {
    return (
      <div className="p-6 space-y-6">
        <StatsGridSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Confirmation Dialog (finding 9) */}
      <ConfirmDialog
        open={!!confirmToggleRule}
        title={confirmToggleRule?.enabled ? 'Pause Rule?' : 'Activate Rule?'}
        description={`This will immediately ${confirmToggleRule?.enabled ? 'disable' : 'enable'} the protection logic across all ${sensors.length} online sensors.`}
        confirmLabel={confirmToggleRule?.enabled ? 'Pause Rule' : 'Activate Rule'}
        variant={confirmToggleRule?.enabled ? 'warning' : 'danger'}
        onConfirm={() => confirmToggleRule && handleToggleEnabled(confirmToggleRule)}
        onCancel={() => setConfirmToggleRule(null)}
      />

      {/* Header */}
      <header className="flex justify-between items-end border-b border-border-subtle pb-6">
        <div>
          <h1 className="text-3xl font-light text-ink-primary mb-2 uppercase tracking-tight">Fleet Rule Control</h1>
          <p className="text-ink-secondary">Manage and synchronize WAF protection logic across the global sensor array.</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 border-2 border-border-subtle text-ink-secondary hover:text-ink-primary hover:bg-surface-subtle transition-all text-xs font-bold uppercase tracking-widest"
          >
            <RefreshCw className={clsx('w-4 h-4', rulesLoading && 'animate-spin')} />
            Refresh State
          </button>
          <button
            onClick={handleDeployAll}
            disabled={deployMutation.isPending}
            className="flex items-center gap-2 px-6 py-2 bg-ac-navy text-white hover:bg-ac-blue-darker transition-all text-xs font-bold uppercase tracking-widest shadow-lg shadow-ac-blue/20"
          >
            {deployMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Sync Full Fleet
          </button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Protection Rules" value={stats.total.toString()} icon={Shield} />
        <StatCard
          label="Active Policies"
          value={stats.active.toString()}
          icon={ShieldCheck}
          color="text-status-success"
        />
        <StatCard
          label="Total Interceptions"
          value={stats.totalTriggers.toLocaleString()}
          icon={Activity}
          color="text-ac-sky-blue"
        />
        <StatCard
          label="Fleet Convergence"
          value={`${stats.avgSync.toFixed(1)}%`}
          icon={RefreshCw}
          color="text-ac-orange"
        />
      </div>

      {/* Deployment Advisory */}
      <div className="bg-ac-card-dark p-4 border-l-4 border-ac-magenta flex items-center justify-between text-white">
        <div className="flex items-center gap-4">
          <AlertTriangle className="w-5 h-5 text-ac-magenta" />
          <div>
            <p className="text-sm font-bold uppercase tracking-widest">Global Policy Mode: ENFORCEMENT</p>
            <p className="text-[10px] text-white/60 uppercase tracking-tighter">Rule toggles trigger immediate deployment to {sensors.length} sensors across {new Set(sensors.map(s => s.region)).size} regions.</p>
          </div>
        </div>
        <div className="flex gap-2 font-mono text-[10px] text-white/40">
          <span>TAG: FLEET_SYNC_v3</span>
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules.length === 0 ? (
          <div className="text-center py-20 bg-surface-subtle border border-dashed border-border-subtle">
            <ShieldOff className="w-12 h-12 mx-auto text-ink-muted mb-4 opacity-20" />
            <p className="text-ink-secondary uppercase tracking-widest font-bold">No rules found in tenant policy</p>
          </div>
        ) : (
          rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              isExpanded={expandedRules.has(rule.id)}
              onToggle={() => handleToggleRule(rule.id)}
              onToggleEnabled={() => setConfirmToggleRule(rule)}
              isUpdating={updatingRuleId === rule.id}
            />
          ))
        )}
      </div>
    </div>
  );
}