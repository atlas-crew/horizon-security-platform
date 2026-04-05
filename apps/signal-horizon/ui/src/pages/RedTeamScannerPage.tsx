/**
 * Red Team Scanner Page
 *
 * Launch targeted OWASP security scans via Apparatus SecurityApi.
 */

import { useState, useCallback } from 'react';
import { Crosshair, Play, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { apiFetch } from '../lib/api';
import { useApparatusStatus } from '../hooks/useApparatusStatus';
import { useDemoMode } from '../stores/demoModeStore';
import { Stack, SectionHeader, Button, PAGE_TITLE_STYLE } from '@/ui';

// =============================================================================
// Types
// =============================================================================

interface RedTeamResult { test: string; status: 'pass' | 'fail' | 'warning'; message: string; details?: Record<string, unknown> }
interface RedTeamResponse { target: string; results: RedTeamResult[]; summary: { total: number; passed: number; failed: number; warnings: number }; duration: string }

const AVAILABLE_TESTS = ['headers', 'cors', 'tls', 'csrf', 'cookies', 'xss', 'sqli'] as const;

// =============================================================================
// Demo Data
// =============================================================================

const DEMO_RESULTS: RedTeamResponse = {
  target: 'https://api.example.com',
  results: [
    { test: 'headers', status: 'pass', message: 'Security headers properly configured (HSTS, CSP, X-Frame-Options)' },
    { test: 'cors', status: 'warning', message: 'CORS allows wildcard origin in preflight — consider restricting to known domains' },
    { test: 'tls', status: 'pass', message: 'TLS 1.3 with strong cipher suite (ECDHE-RSA-AES256-GCM-SHA384)' },
    { test: 'csrf', status: 'pass', message: 'Double-submit cookie CSRF protection detected' },
    { test: 'cookies', status: 'warning', message: 'Session cookie missing SameSite=Strict attribute' },
    { test: 'xss', status: 'pass', message: 'No reflected XSS vectors found in 47 tested parameters' },
    { test: 'sqli', status: 'fail', message: 'SQL injection detected in /api/v2/users?search= parameter — error-based extraction possible', details: { parameter: 'search', payload: "' OR 1=1--", technique: 'error-based' } },
  ],
  summary: { total: 7, passed: 4, failed: 1, warnings: 2 },
  duration: '12.4s',
};

// =============================================================================
// Component
// =============================================================================

export default function RedTeamScannerPage() {
  const { isEnabled: isDemo } = useDemoMode();
  const { status: apparatusStatus } = useApparatusStatus();
  const isConnected = isDemo || apparatusStatus.state === 'connected';

  const [target, setTarget] = useState('');
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set(AVAILABLE_TESTS));
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<RedTeamResponse | null>(null);

  const toggleTest = (test: string) => {
    setSelectedTests((prev) => {
      const next = new Set(prev);
      if (next.has(test)) next.delete(test); else next.add(test);
      return next;
    });
  };

  const handleScan = useCallback(async () => {
    if (!target.trim()) return;
    setIsScanning(true);
    setResult(null);
    try {
      if (isDemo) {
        // Simulate scan delay
        await new Promise((r) => setTimeout(r, 1500));
        setResult({ ...DEMO_RESULTS, target: target.trim() });
        return;
      }
      const data = await apiFetch<RedTeamResponse>('/apparatus/security/redteam', {
        method: 'POST',
        body: JSON.stringify({ target: target.trim(), tests: [...selectedTests] }),
      });
      setResult(data);
    } catch { /* silent */ }
    finally { setIsScanning(false); }
  }, [target, selectedTests, isDemo]);

  const STATUS_STYLE: Record<string, { icon: typeof CheckCircle; color: string }> = {
    pass: { icon: CheckCircle, color: 'text-ac-green' },
    fail: { icon: XCircle, color: 'text-ac-red' },
    warning: { icon: AlertTriangle, color: 'text-ac-orange' },
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <SectionHeader title="Red Team Scanner" icon={<Crosshair className="w-5 h-5 text-ac-red" />} size="h1" titleStyle={PAGE_TITLE_STYLE} />
      <p className="text-sm text-ink-muted max-w-2xl">
        Launch targeted OWASP security scans against any URL. Tests for headers, CORS,
        TLS, CSRF, cookies, XSS, and SQL injection.
      </p>

      {!isConnected && (
        <div className="px-4 py-3 border border-ac-orange/30 bg-ac-orange/10 text-sm text-ac-orange">
          <Stack direction="row" align="center" gap="sm"><AlertTriangle className="w-4 h-4" /><span>Apparatus is not connected.</span></Stack>
        </div>
      )}

      {/* Scan Form */}
      <section className="bg-surface-card border border-border-subtle p-4 space-y-4">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-1">Target URL</label>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="https://api.example.com"
            className="w-full bg-surface-base border border-border-subtle px-3 py-2 text-sm font-mono text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-ac-red"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2">Tests</label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_TESTS.map((test) => (
              <button
                key={test}
                onClick={() => toggleTest(test)}
                className={clsx(
                  'px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors',
                  selectedTests.has(test)
                    ? 'border-ac-red/40 bg-ac-red/10 text-ac-red'
                    : 'border-border-subtle text-ink-muted hover:text-ink-primary',
                )}
              >
                {test}
              </button>
            ))}
          </div>
        </div>
        <Button variant="magenta" disabled={!target.trim() || selectedTests.size === 0 || isScanning || !isConnected} onClick={handleScan}>
          <Stack direction="row" align="center" gap="sm">
            {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            <span>{isScanning ? 'Scanning...' : 'Run Scan'}</span>
          </Stack>
        </Button>
      </section>

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-surface-card border border-border-subtle p-3">
              <p className="text-[10px] text-ink-muted uppercase tracking-wider">Total</p>
              <p className="text-xl font-mono text-ink-primary">{result.summary.total}</p>
            </div>
            <div className="bg-surface-card border border-border-subtle p-3">
              <p className="text-[10px] text-ink-muted uppercase tracking-wider">Passed</p>
              <p className="text-xl font-mono text-ac-green">{result.summary.passed}</p>
            </div>
            <div className="bg-surface-card border border-border-subtle p-3">
              <p className="text-[10px] text-ink-muted uppercase tracking-wider">Failed</p>
              <p className="text-xl font-mono text-ac-red">{result.summary.failed}</p>
            </div>
            <div className="bg-surface-card border border-border-subtle p-3">
              <p className="text-[10px] text-ink-muted uppercase tracking-wider">Warnings</p>
              <p className="text-xl font-mono text-ac-orange">{result.summary.warnings}</p>
            </div>
          </div>

          {/* Result rows */}
          <section className="bg-surface-card border border-border-subtle">
            <div className="px-4 py-3 border-b border-border-subtle">
              <Stack direction="row" align="center" justify="space-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-medium">Scan Results</p>
                <span className="text-xs font-mono text-ink-muted">{result.target} &middot; {result.duration}</span>
              </Stack>
            </div>
            <div className="divide-y divide-border-subtle">
              {result.results.map((r, i) => {
                const style = STATUS_STYLE[r.status];
                const Icon = style.icon;
                return (
                  <div key={i} className="px-4 py-3">
                    <Stack direction="row" align="start" gap="md">
                      <Icon className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', style.color)} />
                      <div className="flex-1 min-w-0">
                        <Stack direction="row" align="center" gap="sm" className="mb-1">
                          <span className="text-sm font-bold text-ink-primary uppercase">{r.test}</span>
                          <span className={clsx('text-[10px] font-mono uppercase tracking-wider', style.color)}>{r.status}</span>
                        </Stack>
                        <p className="text-sm text-ink-secondary">{r.message}</p>
                        {r.details && (
                          <pre className="mt-2 text-xs font-mono text-ink-muted bg-surface-subtle border border-border-subtle p-2 whitespace-pre-wrap">
                            {JSON.stringify(r.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </Stack>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
