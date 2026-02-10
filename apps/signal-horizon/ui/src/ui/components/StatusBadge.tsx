import React from 'react';
import { colors, fontFamily, fontWeight } from '../tokens/tokens';

/**
 * StatusBadge — Square badge with semantic coloring.
 *
 * Usage:
 *   <StatusBadge status="success">ONLINE</StatusBadge>
 *   <StatusBadge status="error">BLOCKED</StatusBadge>
 *   <StatusBadge status="warning" variant="outlined">DEGRADED</StatusBadge>
 *   <StatusBadge status="info" size="sm">NEW</StatusBadge>
 */

type BadgeStatus = 'success' | 'warning' | 'error' | 'info' | 'accent' | 'neutral';
type BadgeVariant = 'filled' | 'outlined' | 'subtle';
type BadgeSize = 'sm' | 'md' | 'lg';

interface StatusBadgeProps {
  status?: BadgeStatus;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Custom color override */
  color?: string;
  /** Pulsing dot indicator */
  pulse?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

const statusColors: Record<BadgeStatus, string> = {
  success: colors.green,
  warning: colors.orange,
  error: colors.red,
  info: colors.blue,
  accent: colors.magenta,
  neutral: colors.gray.mid,
};

const sizeStyles: Record<BadgeSize, React.CSSProperties> = {
  sm: { fontSize: '10px', padding: '2px 6px' },
  md: { fontSize: '12px', padding: '4px 10px' },
  lg: { fontSize: '14px', padding: '6px 14px' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'info',
  variant = 'filled',
  size = 'md',
  color,
  pulse,
  style,
  children,
}) => {
  const baseColor = color || statusColors[status];

  const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
    filled: {
      background: baseColor,
      color: '#FFFFFF',
    },
    outlined: {
      background: 'transparent',
      color: baseColor,
      border: `1px solid ${baseColor}`,
    },
    subtle: {
      background: `${baseColor}1A`, // ~10% opacity
      color: baseColor,
    },
  };

  return (
    <span
      style={{
        fontFamily,
        fontWeight: fontWeight.medium,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderRadius: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
    >
      {pulse && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: variant === 'filled' ? '#FFFFFF' : baseColor,
            animation: 'sh-pulse 2s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
};

StatusBadge.displayName = 'StatusBadge';
