import { LiveAttackMap } from '../../components/soc/LiveAttackMap';
import { Shield, Globe } from 'lucide-react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { SectionHeader, Stack, StatusBadge, colors } from '@/ui';

export default function LiveMapPage() {
  useDocumentTitle('SOC - Live Map');
  return (
    <div className="p-6 space-y-6">
      <SectionHeader
        title="Live Threat Map"
        description="Real-time visualization of fleet-wide attack vectors"
        size="h3"
        actions={
          <Stack direction="row" align="center" gap="sm">
            <StatusBadge status="info" variant="subtle" size="sm">
              <span className="inline-flex items-center gap-1">
                <Globe aria-hidden="true" className="w-4 h-4" />
                Global Fleet Connected
                <span
                  className="w-2 h-2 animate-pulse"
                  style={{ background: colors.green, display: 'inline-block' }}
                />
              </span>
            </StatusBadge>
          </Stack>
        }
      />
      <div className="grid grid-cols-1 gap-6">
        <LiveAttackMap />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-4">
            <h3 className="text-sm font-medium text-ink-secondary mb-2 flex items-center gap-2">
              <span className="w-2 h-2" style={{ background: colors.red }} />
              Critical Threats (Last 5m)
            </h3>
            <span className="text-2xl font-mono text-ink-primary">142</span>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-medium text-ink-secondary mb-2 flex items-center gap-2">
              <span className="w-2 h-2" style={{ background: colors.orange }} />
              High Severity
            </h3>
            <span className="text-2xl font-mono text-ink-primary">853</span>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-medium text-ink-secondary mb-2 flex items-center gap-2">
              <Shield aria-hidden="true" className="w-4 h-4" style={{ color: colors.green }} />
              Auto-Blocked
            </h3>
            <span className="text-2xl font-mono text-ink-primary">98.4%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
