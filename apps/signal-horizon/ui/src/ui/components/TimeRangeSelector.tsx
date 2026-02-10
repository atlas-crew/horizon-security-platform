import React from 'react';
import { colors, fontFamily, fontWeight, spacing, transitions } from '../tokens/tokens';

/**
 * TimeRangeSelector — Time range picker for dashboard views.
 */

type PresetRange = '1m' | '5m' | '15m' | '30m' | '1h' | '3h' | '6h' | '12h' | '24h' | '3d' | '7d' | '14d' | '30d' | '90d';

interface TimeRangeSelectorProps {
  value: PresetRange | 'custom';
  onChange: (range: PresetRange | 'custom') => void;
  presets?: PresetRange[];
  showLive?: boolean;
  live?: boolean;
  onToggleLive?: (live: boolean) => void;
  showRefresh?: boolean;
  onRefresh?: () => void;
  autoRefreshInterval?: string;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

const defaultPresets: PresetRange[] = ['5m', '15m', '1h', '6h', '24h', '7d', '30d'];

const presetLabels: Record<PresetRange, string> = {
  '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '3h': '3h', '6h': '6h', '12h': '12h',
  '24h': '24h', '3d': '3d', '7d': '7d', '14d': '14d',
  '30d': '30d', '90d': '90d',
};

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  value, onChange, presets = defaultPresets,
  showLive, live, onToggleLive,
  showRefresh, onRefresh, autoRefreshInterval,
  size = 'md', style,
}) => {
  const isSmall = size === 'sm';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, ...style }}>
      {showLive && onToggleLive && (
        <button
          onClick={() => onToggleLive(!live)}
          style={{
            fontFamily, fontWeight: fontWeight.medium,
            fontSize: isSmall ? '11px' : '12px',
            padding: isSmall ? '4px 8px' : '6px 12px',
            background: live ? colors.green : 'transparent',
            color: live ? '#FFFFFF' : colors.gray.mid,
            border: live ? 'none' : '1px solid rgba(255,255,255,0.15)',
            borderRadius: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px',
            transition: `all ${transitions.fast}`,
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}
        >
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: live ? '#FFFFFF' : colors.gray.mid,
            animation: live ? 'sh-pulse 2s ease-in-out infinite' : 'none',
          }} />
          Live
        </button>
      )}

      <div style={{
        display: 'flex',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 0,
      }}>
        {presets.map((preset) => {
          const isActive = value === preset;
          return (
            <button
              key={preset}
              onClick={() => onChange(preset)}
              style={{
                fontFamily, fontWeight: isActive ? fontWeight.medium : fontWeight.regular,
                fontSize: isSmall ? '11px' : '12px',
                padding: isSmall ? '4px 8px' : '6px 12px',
                background: isActive ? colors.blue : 'transparent',
                color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
                border: 'none',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 0, cursor: 'pointer',
                transition: `all ${transitions.fast}`,
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              {presetLabels[preset]}
            </button>
          );
        })}
      </div>

      {showRefresh && (
        <button
          onClick={onRefresh}
          style={{
            fontFamily, fontSize: isSmall ? '14px' : '16px',
            padding: isSmall ? '4px 6px' : '6px 8px',
            background: 'transparent', color: colors.gray.mid,
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 0, cursor: 'pointer',
            transition: `color ${transitions.fast}`,
            display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#F0F4F8')}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.color = colors.gray.mid)}
          title="Refresh"
        >
          ↻
        </button>
      )}

      {autoRefreshInterval && (
        <span style={{ fontFamily, fontSize: '11px', color: colors.gray.mid }}>
          Auto: {autoRefreshInterval}
        </span>
      )}
    </div>
  );
};

TimeRangeSelector.displayName = 'TimeRangeSelector';
