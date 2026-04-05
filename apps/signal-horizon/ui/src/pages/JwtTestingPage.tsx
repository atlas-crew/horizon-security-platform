/**
 * JWT Testing Page
 *
 * Debug, forge, and verify JWTs using Apparatus IdentityApi.
 * Three tabs: Decode, Forge, Verify.
 */

import { useState, useCallback } from 'react';
import { Key, Search, Shield, AlertTriangle, CheckCircle, XCircle, Loader2, Copy } from 'lucide-react';
import { clsx } from 'clsx';
import { apiFetch } from '../lib/api';
import { useApparatusStatus } from '../hooks/useApparatusStatus';
import { useDemoMode } from '../stores/demoModeStore';
import { Stack, SectionHeader, Button, PAGE_TITLE_STYLE } from '@/ui';

// =============================================================================
// Types
// =============================================================================

interface JwtDebugResult { valid: boolean; header: Record<string, unknown>; payload: Record<string, unknown>; error?: string }
interface JwtForgeResult { token: string; header: Record<string, unknown>; payload: Record<string, unknown>; hints?: string[] }
interface JwtVerifyResult { valid: boolean; bypassed?: boolean; mode?: string; message?: string; payload?: Record<string, unknown>; matchedKey?: string }

type Tab = 'decode' | 'forge' | 'verify';

// =============================================================================
// Demo Data
// =============================================================================

const DEMO_DEBUG: JwtDebugResult = {
  valid: true,
  header: { alg: 'RS256', typ: 'JWT', kid: 'key-1' },
  payload: { sub: '1234567890', name: 'SOC Operator', iat: 1714000000, exp: 1714086400, role: 'admin', iss: 'https://auth.example.com' },
};

const DEMO_FORGE: JwtForgeResult = {
  token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MTQwMDAwMDB9.fake-signature',
  header: { alg: 'RS256', typ: 'JWT' },
  payload: { sub: 'test-user', role: 'admin', iat: 1714000000 },
  hints: ['Token signed with RS256 — try algorithm confusion by changing alg to HS256', 'Role claim set to admin — test if server validates role against session'],
};

const DEMO_VERIFY: JwtVerifyResult = {
  valid: false,
  bypassed: true,
  mode: 'algorithm-confusion',
  message: 'Token accepted with HS256 algorithm using public key as HMAC secret — algorithm confusion vulnerability detected',
  payload: { sub: 'test-user', role: 'admin' },
};

// =============================================================================
// Component
// =============================================================================

export default function JwtTestingPage() {
  const { isEnabled: isDemo } = useDemoMode();
  const { status: apparatusStatus } = useApparatusStatus();
  const isConnected = isDemo || apparatusStatus.state === 'connected';

  const [tab, setTab] = useState<Tab>('decode');
  const [isLoading, setIsLoading] = useState(false);

  // Decode state
  const [decodeToken, setDecodeToken] = useState('');
  const [decodeResult, setDecodeResult] = useState<JwtDebugResult | null>(null);

  // Forge state
  const [forgeSub, setForgeSub] = useState('test-user');
  const [forgeRole, setForgeRole] = useState('admin');
  const [forgeExpiry, setForgeExpiry] = useState('1h');
  const [forgeResult, setForgeResult] = useState<JwtForgeResult | null>(null);

  // Verify state
  const [verifyToken, setVerifyToken] = useState('');
  const [verifyResult, setVerifyResult] = useState<JwtVerifyResult | null>(null);

  const handleDecode = useCallback(async () => {
    if (!decodeToken.trim()) return;
    setIsLoading(true);
    try {
      if (isDemo) { setDecodeResult(DEMO_DEBUG); return; }
      const result = await apiFetch<JwtDebugResult>('/apparatus/identity/jwt/debug', {
        method: 'POST', body: JSON.stringify({ token: decodeToken.trim() }),
      });
      setDecodeResult(result);
    } catch { setDecodeResult({ valid: false, header: {}, payload: {}, error: 'Failed to decode token' }); }
    finally { setIsLoading(false); }
  }, [decodeToken, isDemo]);

  const handleForge = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isDemo) { setForgeResult(DEMO_FORGE); return; }
      const result = await apiFetch<JwtForgeResult>('/apparatus/identity/jwt/forge', {
        method: 'POST', body: JSON.stringify({ sub: forgeSub, role: forgeRole, expiresIn: forgeExpiry }),
      });
      setForgeResult(result);
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }, [forgeSub, forgeRole, forgeExpiry, isDemo]);

  const handleVerify = useCallback(async () => {
    if (!verifyToken.trim()) return;
    setIsLoading(true);
    try {
      if (isDemo) { setVerifyResult(DEMO_VERIFY); return; }
      const result = await apiFetch<JwtVerifyResult>('/apparatus/identity/jwt/verify', {
        method: 'POST', body: JSON.stringify({ token: verifyToken.trim() }),
      });
      setVerifyResult(result);
    } catch { setVerifyResult({ valid: false, message: 'Verification request failed' }); }
    finally { setIsLoading(false); }
  }, [verifyToken, isDemo]);

  const copyToClipboard = (text: string) => navigator.clipboard?.writeText(text);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'decode', label: 'Decode' },
    { id: 'forge', label: 'Forge' },
    { id: 'verify', label: 'Verify' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <SectionHeader title="JWT Testing" icon={<Key className="w-5 h-5 text-ac-magenta" />} size="h1" titleStyle={PAGE_TITLE_STYLE} />
      <p className="text-sm text-ink-muted max-w-2xl">
        Decode, forge, and verify JSON Web Tokens using the Apparatus identity testing engine.
        Test for algorithm confusion, expired token acceptance, and claim manipulation.
      </p>

      {!isConnected && (
        <div className="px-4 py-3 border border-ac-orange/30 bg-ac-orange/10 text-sm text-ac-orange">
          <Stack direction="row" align="center" gap="sm"><AlertTriangle className="w-4 h-4" /><span>Apparatus is not connected.</span></Stack>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border-subtle">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t.id ? 'border-ac-magenta text-ac-magenta' : 'border-transparent text-ink-muted hover:text-ink-primary',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Decode Tab */}
      {tab === 'decode' && (
        <div className="space-y-4">
          <textarea
            value={decodeToken}
            onChange={(e) => setDecodeToken(e.target.value)}
            placeholder="Paste a JWT token here..."
            rows={3}
            className="w-full bg-surface-base border border-border-subtle px-3 py-2 text-sm font-mono text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-ac-magenta resize-none"
          />
          <Button variant="primary" onClick={handleDecode} disabled={!decodeToken.trim() || isLoading || !isConnected}>
            <Stack direction="row" align="center" gap="sm">
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
              <span>Decode</span>
            </Stack>
          </Button>
          {decodeResult && (
            <div className="space-y-3">
              <Stack direction="row" align="center" gap="sm">
                {decodeResult.valid ? <CheckCircle className="w-4 h-4 text-ac-green" /> : <XCircle className="w-4 h-4 text-ac-red" />}
                <span className={clsx('text-sm font-mono', decodeResult.valid ? 'text-ac-green' : 'text-ac-red')}>
                  {decodeResult.valid ? 'Valid signature' : decodeResult.error ?? 'Invalid signature'}
                </span>
              </Stack>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-surface-card border border-border-subtle p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2">Header</p>
                  <pre className="text-xs font-mono text-ink-primary whitespace-pre-wrap">{JSON.stringify(decodeResult.header, null, 2)}</pre>
                </div>
                <div className="bg-surface-card border border-border-subtle p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-2">Payload</p>
                  <pre className="text-xs font-mono text-ink-primary whitespace-pre-wrap">{JSON.stringify(decodeResult.payload, null, 2)}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Forge Tab */}
      {tab === 'forge' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-1">Subject</label>
              <input type="text" value={forgeSub} onChange={(e) => setForgeSub(e.target.value)}
                className="w-full bg-surface-base border border-border-subtle px-3 py-2 text-sm font-mono text-ink-primary focus:outline-none focus:border-ac-magenta" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-1">Role</label>
              <input type="text" value={forgeRole} onChange={(e) => setForgeRole(e.target.value)}
                className="w-full bg-surface-base border border-border-subtle px-3 py-2 text-sm font-mono text-ink-primary focus:outline-none focus:border-ac-magenta" />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-1">Expiry</label>
              <input type="text" value={forgeExpiry} onChange={(e) => setForgeExpiry(e.target.value)}
                className="w-full bg-surface-base border border-border-subtle px-3 py-2 text-sm font-mono text-ink-primary focus:outline-none focus:border-ac-magenta" />
            </div>
          </div>
          <Button variant="magenta" onClick={handleForge} disabled={isLoading || !isConnected}>
            <Stack direction="row" align="center" gap="sm">
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}
              <span>Forge Token</span>
            </Stack>
          </Button>
          {forgeResult && (
            <div className="space-y-3">
              <div className="bg-surface-card border border-border-subtle p-4">
                <Stack direction="row" align="center" justify="space-between" className="mb-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Generated Token</p>
                  <button onClick={() => copyToClipboard(forgeResult.token)} className="text-ink-muted hover:text-ink-primary">
                    <Copy className="w-3 h-3" />
                  </button>
                </Stack>
                <pre className="text-xs font-mono text-ac-magenta break-all whitespace-pre-wrap">{forgeResult.token}</pre>
              </div>
              {forgeResult.hints && forgeResult.hints.length > 0 && (
                <div className="bg-ac-orange/10 border border-ac-orange/30 p-4 space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-ac-orange mb-1">Attack Hints</p>
                  {forgeResult.hints.map((hint, i) => (
                    <p key={i} className="text-xs text-ac-orange">{hint}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Verify Tab */}
      {tab === 'verify' && (
        <div className="space-y-4">
          <textarea
            value={verifyToken}
            onChange={(e) => setVerifyToken(e.target.value)}
            placeholder="Paste a JWT to verify (including forged tokens)..."
            rows={3}
            className="w-full bg-surface-base border border-border-subtle px-3 py-2 text-sm font-mono text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-ac-magenta resize-none"
          />
          <Button variant="primary" onClick={handleVerify} disabled={!verifyToken.trim() || isLoading || !isConnected}>
            <Stack direction="row" align="center" gap="sm">
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
              <span>Verify</span>
            </Stack>
          </Button>
          {verifyResult && (
            <div className="bg-surface-card border border-border-subtle p-4 space-y-3">
              <Stack direction="row" align="center" gap="sm">
                {verifyResult.valid && !verifyResult.bypassed ? (
                  <CheckCircle className="w-4 h-4 text-ac-green" />
                ) : verifyResult.bypassed ? (
                  <AlertTriangle className="w-4 h-4 text-ac-red" />
                ) : (
                  <XCircle className="w-4 h-4 text-ac-orange" />
                )}
                <span className={clsx('text-sm font-semibold',
                  verifyResult.bypassed ? 'text-ac-red' : verifyResult.valid ? 'text-ac-green' : 'text-ac-orange',
                )}>
                  {verifyResult.bypassed ? 'BYPASS DETECTED' : verifyResult.valid ? 'Valid' : 'Rejected'}
                </span>
                {verifyResult.mode && (
                  <span className="text-[10px] font-mono uppercase tracking-wider text-ink-muted px-2 py-0.5 border border-border-subtle">{verifyResult.mode}</span>
                )}
              </Stack>
              {verifyResult.message && <p className="text-sm text-ink-secondary">{verifyResult.message}</p>}
              {verifyResult.payload && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-1">Decoded Payload</p>
                  <pre className="text-xs font-mono text-ink-primary whitespace-pre-wrap">{JSON.stringify(verifyResult.payload, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
