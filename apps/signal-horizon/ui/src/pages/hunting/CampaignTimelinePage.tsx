/**
 * Campaign Timeline Pivot Page
 * Correlates ClickHouse rows by campaign_id across campaign_history.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Clipboard, RefreshCw } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useHunt, type CampaignTimelineEvent } from '../../hooks/useHunt';
import { formatIsoOrInvalid } from '../../utils';

function formatConfidenceOrNa(confidence: unknown): string {
  if (typeof confidence !== 'number') return 'n/a';
  if (!Number.isFinite(confidence)) return 'n/a';
  if (confidence < 0 || confidence > 1) return 'n/a';
  return confidence.toFixed(2);
}

export default function CampaignTimelinePage() {
  useDocumentTitle('Campaign Timeline');

  const { campaignId: routeCampaignId } = useParams();
  const navigate = useNavigate();
  const { isLoading, error, clearError, getCampaignTimeline } = useHunt();

  const [campaignId, setCampaignId] = useState(routeCampaignId ?? '');
  const [events, setEvents] = useState<CampaignTimelineEvent[] | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const runSeqRef = useRef(0);
  const skipAutoRunIdRef = useRef<string | null>(null);
  const submitInFlightRef = useRef(false);
  const lastAutoRunIdRef = useRef<string | null>(null);

  // Optional time window (ISO strings expected by API).
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const canRun = campaignId.trim().length > 0 && !isLoading;

  // One-way sync from route param into the input field.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (routeCampaignId && routeCampaignId !== campaignId) {
      setCampaignId(routeCampaignId);
    }
  }, [routeCampaignId]);

  const run = useCallback(async (id: string) => {
    const seq = ++runSeqRef.current;
    clearError();
    setLocalError(null);
    try {
      const res = await getCampaignTimeline(id, {
        startTime: startTime.trim() || undefined,
        endTime: endTime.trim() || undefined,
      });
      if (seq !== runSeqRef.current) return;
      setEvents(res.events);
    } catch (err) {
      if (seq !== runSeqRef.current) return;
      setEvents(null);
      setLocalError(err instanceof Error ? err.message : 'Campaign timeline query failed');
    }
  }, [clearError, endTime, getCampaignTimeline, startTime]);

  // Auto-run when deep-linked.
  useEffect(() => {
    if (routeCampaignId) {
      if (skipAutoRunIdRef.current === routeCampaignId) {
        skipAutoRunIdRef.current = null;
        lastAutoRunIdRef.current = routeCampaignId;
        return;
      }
      if (lastAutoRunIdRef.current === routeCampaignId) return;
      lastAutoRunIdRef.current = routeCampaignId;
      void run(routeCampaignId);
    }
  }, [routeCampaignId, run]);

  const header = useMemo(() => {
    const id = campaignId.trim();
    return id.length > 0 ? id : '(enter campaign id)';
  }, [campaignId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const id = campaignId.trim();
    if (!id) return;
    if (isLoading) return;
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    skipAutoRunIdRef.current = id;
    navigate(`/hunting/campaign/${encodeURIComponent(id)}`);
    try {
      await run(id);
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const handleCopy = async () => {
    const id = campaignId.trim();
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light text-ink-primary">Campaign Timeline</h1>
          <p className="text-ink-secondary mt-1">
            Pivot ClickHouse telemetry by <span className="font-mono">campaign_id</span>.
            <span className="ml-2 text-ink-muted">
              <Link className="text-link hover:text-link-hover" to="/hunting">Back to hunting</Link>
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="btn-outline h-10 px-3 text-sm inline-flex items-center gap-2"
            disabled={!campaignId.trim()}
            aria-label="Copy campaign id"
            title="Copy campaign id"
          >
            <Clipboard className="w-4 h-4" />
            Copy
          </button>
          <button
            type="button"
            onClick={() => campaignId.trim() && void run(campaignId.trim())}
            className="btn-primary h-10 px-3 text-sm inline-flex items-center gap-2"
            disabled={!campaignId.trim() || isLoading}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={isLoading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
            Refresh
          </button>
        </div>
      </div>

      {(error || localError) && (
        <div className="p-4 bg-ac-red/10 border border-ac-red/30 text-ac-red flex items-center justify-between gap-4">
          <span className="text-sm">{localError ?? error}</span>
          <button onClick={() => { clearError(); setLocalError(null); }} className="text-sm hover:text-ac-red/80">
            Dismiss
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2 className="font-medium text-ink-primary">Query</h2>
          <p className="text-xs text-ink-muted mt-1">
            Campaign: <span className="font-mono">{header}</span>
          </p>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4">
              <label htmlFor="campaign-id" className="block text-xs text-ink-muted mb-1 font-mono">
                campaign_id
              </label>
              <input
                id="campaign-id"
                className="w-full px-3 py-2 border border-border-subtle bg-surface-base text-ink-primary font-mono"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                placeholder="campaign-123"
              />
            </div>

            <div className="md:col-span-3">
              <label htmlFor="start-time" className="block text-xs text-ink-muted mb-1 font-mono">
                startTime (optional)
              </label>
              <input
                id="start-time"
                className="w-full px-3 py-2 border border-border-subtle bg-surface-base text-ink-primary font-mono"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                placeholder="2026-02-09T00:00:00.000Z"
              />
            </div>

            <div className="md:col-span-3">
              <label htmlFor="end-time" className="block text-xs text-ink-muted mb-1 font-mono">
                endTime (optional)
              </label>
              <input
                id="end-time"
                className="w-full px-3 py-2 border border-border-subtle bg-surface-base text-ink-primary font-mono"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                placeholder="2026-02-09T12:00:00.000Z"
              />
            </div>

            <div className="md:col-span-2 flex items-end">
              <button
                type="submit"
                disabled={!canRun}
                className="btn-primary w-full h-10 px-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Run
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="font-medium text-ink-primary">Timeline</h2>
          <p className="text-xs text-ink-muted mt-1">
            {events ? (
              <span className="font-mono">count={events.length}</span>
            ) : (
              <span className="font-mono">count=?</span>
            )}
          </p>
        </div>

        <div className="card-body">
          {!events && (
            <div className="text-sm text-ink-secondary">
              {isLoading ? 'Loading…' : 'Run a query to load campaign history.'}
            </div>
          )}

          {events && events.length === 0 && (
            <div className="text-sm text-ink-secondary">No events found.</div>
          )}

          {events && events.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-ink-muted border-b border-border-subtle">
                  <tr>
                    <th className="text-left font-medium py-2 pr-3">Timestamp</th>
                    <th className="text-left font-medium py-2 pr-3">Type</th>
                    <th className="text-left font-medium py-2 pr-3">Name</th>
                    <th className="text-left font-medium py-2 pr-3">Status</th>
                    <th className="text-left font-medium py-2 pr-3">Severity</th>
                    <th className="text-right font-medium py-2 pr-3 font-mono">Tenants</th>
                    <th className="text-right font-medium py-2 font-mono">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e, idx) => (
                    <tr key={`${e.timestamp}-${idx}`} className="border-b border-border-subtle">
                      <td className="py-2 pr-3 font-mono text-ink-secondary whitespace-nowrap">
                        {formatIsoOrInvalid(e.timestamp)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{e.eventType}</td>
                      <td className="py-2 pr-3">{e.name}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{e.status}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{e.severity}</td>
                      <td className="py-2 pr-3 text-right font-mono">{e.tenantsAffected}</td>
                      <td className="py-2 text-right font-mono">{formatConfidenceOrNa(e.confidence)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
