/**
 * DLP Scanner Page
 *
 * On-demand DLP content scanning via Apparatus DataApi.
 */

import { useState, useCallback } from 'react';
import { ScanSearch, AlertTriangle, Loader2, Eye } from 'lucide-react';
import { clsx } from 'clsx';
import { apiFetch } from '../lib/api';
import { useApparatusStatus } from '../hooks/useApparatusStatus';
import { useDemoMode } from '../stores/demoModeStore';
import { Stack, SectionHeader, Button, PAGE_TITLE_STYLE } from '@/ui';

// =============================================================================
// Types
// =============================================================================

interface DlpMatch { type: string; value: string; location: { start: number; end: number }; confidence: number }
interface DlpScanResult { matches: DlpMatch[]; summary: { total: number; types: Record<string, number> } }

const PRESET_RULES = [
  { id: 'credit_card', label: 'Credit Cards', description: 'Visa, Mastercard, Amex patterns' },
  { id: 'ssn', label: 'SSN', description: 'US Social Security Numbers' },
  { id: 'email', label: 'Email Addresses', description: 'RFC 5322 email patterns' },
  { id: 'api_key', label: 'API Keys', description: 'Common API key formats (AWS, Stripe, etc.)' },
  { id: 'phone', label: 'Phone Numbers', description: 'US and international formats' },
];

// =============================================================================
// Demo Data
// =============================================================================

const DEMO_RESULT: DlpScanResult = {
  matches: [
    { type: 'credit_card', value: '4532-****-****-7890', location: { start: 45, end: 64 }, confidence: 0.98 },
    { type: 'ssn', value: '***-**-4567', location: { start: 102, end: 113 }, confidence: 0.95 },
    { type: 'email', value: 'john.doe@example.com', location: { start: 150, end: 170 }, confidence: 1.0 },
    { type: 'api_key', value: 'sk_live_****...7Fk2', location: { start: 210, end: 245 }, confidence: 0.92 },
  ],
  summary: { total: 4, types: { credit_card: 1, ssn: 1, email: 1, api_key: 1 } },
};

// =============================================================================
// Component
// =============================================================================

export default function DlpScannerPage() {
  const { isEnabled: isDemo } = useDemoMode();
  const { status: apparatusStatus } = useApparatusStatus();
  const isConnected = isDemo || apparatusStatus.state === 'connected';

  const [content, setContent] = useState('');
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set(PRESET_RULES.map((r) => r.id)));
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<DlpScanResult | null>(null);

  const toggleRule = (id: string) => {
    setSelectedRules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleScan = useCallback(async () => {
    if (!content.trim()) return;
    setIsScanning(true);
    setResult(null);
    try {
      if (isDemo) {
        await new Promise((r) => setTimeout(r, 800));
        setResult(DEMO_RESULT);
        return;
      }
      const data = await apiFetch<DlpScanResult>('/apparatus/data/dlp-scan', {
        method: 'POST',
        body: JSON.stringify({ content: content.trim(), rules: [...selectedRules] }),
      });
      setResult(data);
    } catch { /* silent */ }
    finally { setIsScanning(false); }
  }, [content, selectedRules, isDemo]);

  const CONFIDENCE_COLOR = (c: number) => c >= 0.95 ? 'text-ac-red' : c >= 0.8 ? 'text-ac-orange' : 'text-ac-cyan';

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <SectionHeader title="DLP Scanner" icon={<ScanSearch className="w-5 h-5 text-ac-cyan" />} size="h1" titleStyle={PAGE_TITLE_STYLE} />
      <p className="text-sm text-ink-muted max-w-2xl">
        Scan content for sensitive data patterns — credit cards, SSNs, API keys, and more.
        Complements Synapse's in-flight DLP with on-demand content review.
      </p>

      {!isConnected && (
        <div className="px-4 py-3 border border-ac-orange/30 bg-ac-orange/10 text-sm text-ac-orange">
          <Stack direction="row" align="center" gap="sm"><AlertTriangle className="w-4 h-4" /><span>Apparatus is not connected.</span></Stack>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste content to scan for sensitive data..."
            rows={10}
            className="w-full bg-surface-base border border-border-subtle px-3 py-2 text-sm font-mono text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-ac-cyan resize-none"
          />
          <Button variant="primary" disabled={!content.trim() || selectedRules.size === 0 || isScanning || !isConnected} onClick={handleScan}>
            <Stack direction="row" align="center" gap="sm">
              {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
              <span>{isScanning ? 'Scanning...' : 'Scan Content'}</span>
            </Stack>
          </Button>
        </div>

        {/* Rule Selection */}
        <div>
          <section className="bg-surface-card border border-border-subtle">
            <div className="px-4 py-3 border-b border-border-subtle">
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-medium">Detection Rules</p>
            </div>
            <div className="p-2 space-y-1">
              {PRESET_RULES.map((rule) => (
                <button
                  key={rule.id}
                  onClick={() => toggleRule(rule.id)}
                  className={clsx(
                    'w-full text-left px-3 py-2 border transition-colors',
                    selectedRules.has(rule.id)
                      ? 'border-ac-cyan/40 bg-ac-cyan/5'
                      : 'border-transparent hover:bg-surface-subtle',
                  )}
                >
                  <p className="text-sm font-medium text-ink-primary">{rule.label}</p>
                  <p className="text-xs text-ink-muted">{rule.description}</p>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Results */}
      {result && (
        <section className="bg-surface-card border border-border-subtle">
          <div className="px-4 py-3 border-b border-border-subtle">
            <Stack direction="row" align="center" justify="space-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-medium">
                {result.matches.length > 0 ? `${result.summary.total} matches found` : 'No sensitive data detected'}
              </p>
              {result.matches.length > 0 && (
                <Stack direction="row" align="center" gap="sm" className="text-xs font-mono text-ink-muted">
                  {Object.entries(result.summary.types).map(([type, count]) => (
                    <span key={type}>{type}: {count}</span>
                  ))}
                </Stack>
              )}
            </Stack>
          </div>
          {result.matches.length > 0 ? (
            <div className="divide-y divide-border-subtle">
              {result.matches.map((match, i) => (
                <div key={i} className="px-4 py-3">
                  <Stack direction="row" align="start" gap="md">
                    <AlertTriangle className="w-4 h-4 text-ac-red mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Stack direction="row" align="center" gap="sm" className="mb-1">
                        <span className="text-sm font-bold text-ink-primary uppercase">{match.type.replace(/_/g, ' ')}</span>
                        <span className={clsx('text-[10px] font-mono', CONFIDENCE_COLOR(match.confidence))}>
                          {(match.confidence * 100).toFixed(0)}% confidence
                        </span>
                      </Stack>
                      <p className="text-sm font-mono text-ac-red">{match.value}</p>
                      <p className="text-xs text-ink-muted mt-1">Position: {match.location.start}–{match.location.end}</p>
                    </div>
                  </Stack>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-ink-muted text-sm">Content is clean — no sensitive data patterns detected.</div>
          )}
        </section>
      )}
    </div>
  );
}
