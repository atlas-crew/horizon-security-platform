import React from 'react';
import { ShieldAlert, CheckCircle2, ChevronRight, Zap } from 'lucide-react';
import { RiskBadge } from './RiskBadge.js';
import { Button, SectionHeader } from '@/ui';

export type RiskLevel = 'low' | 'medium' | 'high' | 'unknown';

export interface EndpointAuthStats {
  endpoint: string;
  method: string;
  totalRequests: number;
  denialRate: number;
  riskLevel: RiskLevel;
}

interface Props {
  endpoints: EndpointAuthStats[];
  onViewEndpoint?: (endpoint: string) => void;
}

export const GapsPanel: React.FC<Props> = ({ endpoints, onViewEndpoint }) => {
  if (endpoints.length === 0) {
    return (
      <div className="bg-success/10 border border-success/30 p-8 flex flex-col items-center text-center">
        <CheckCircle2 className="w-10 h-10 text-success mb-3" />
        <SectionHeader
          title="No Authorization Gaps Detected"
          size="h4"
          mb="xs"
          style={{ marginBottom: '4px', display: 'inline-block' }}
          titleStyle={{ fontSize: '18px', lineHeight: '24px', fontWeight: 500 }}
        />
        <p className="text-sm text-ink-secondary">All observed endpoints show proper authentication enforcement.</p>
      </div>
    );
  }
  
  const displayEndpoints = endpoints.slice(0, 10);
  const hasMore = endpoints.length > 10;
  
  return (
    <div className="bg-danger/5 border border-danger/20">
      <div className="p-4 border-b border-danger/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-danger" />
          <SectionHeader
            title={`Critical Authorization Gaps (${endpoints.length})`}
            size="h4"
            mb="xs"
            style={{ marginBottom: 0 }}
            titleStyle={{
              fontSize: '14px',
              lineHeight: '20px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#EF3340',
            }}
          />
        </div>
        <div className="flex items-center gap-1 text-[10px] bg-danger/10 text-danger px-2 py-0.5 font-bold uppercase status-blink">
          <Zap className="w-3 h-3" /> Action Required
        </div>
      </div>
      
      <div className="p-4">
        <p className="text-xs text-ink-muted mb-4 uppercase tracking-widest font-mono">
          Endpoints receiving authenticated traffic but never returning 401/403 status codes
        </p>
        
        <div className="space-y-2">
          {displayEndpoints.map((ep) => (
            <div 
              key={ep.endpoint} 
              className="group flex items-center gap-4 p-3 bg-surface-card border border-border-subtle hover:border-danger/40 transition-colors cursor-pointer"
              onClick={() => onViewEndpoint?.(ep.endpoint)}
            >
              <RiskBadge level={ep.riskLevel} />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-ac-blue min-w-[40px]">{ep.method}</span>
                  <span className="text-sm font-mono truncate text-ink-primary">
                    {ep.endpoint.replace(`${ep.method} `, '')}
                  </span>
                </div>
              </div>
              
              <div className="text-right whitespace-nowrap">
                <div className="text-sm font-mono font-bold text-danger">
                  {ep.denialRate === 0 ? '0%' : `${(ep.denialRate * 100).toFixed(1)}%`}
                </div>
                <div className="text-[10px] text-ink-muted uppercase font-semibold">Denial Rate</div>
              </div>
              
              <div className="text-right whitespace-nowrap min-w-[80px]">
                <div className="text-sm font-mono text-ink-primary">
                  {ep.totalRequests.toLocaleString()}
                </div>
                <div className="text-[10px] text-ink-muted uppercase font-semibold">Total Req</div>
              </div>
              
              <div className="pl-2 border-l border-border-subtle opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="w-4 h-4 text-ac-blue" />
              </div>
            </div>
          ))}
        </div>
        
        {hasMore && (
          <div className="mt-4 pt-4 border-t border-border-subtle text-center">
            <Button
              variant="ghost"
              size="sm"
              style={{
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#0057B7',
                height: '32px',
              }}
              onClick={() => {}}
            >
              View all {endpoints.length} gaps
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
