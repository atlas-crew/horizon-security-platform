import React, { useEffect, useCallback } from 'react';
import { colors, fontFamily, fontWeight, spacing, shadows, transitions } from '../tokens/tokens';

/**
 * Modal — Centered overlay dialog.
 * Drawer — Slide-in panel from left or right edge.
 */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | string;
  persistent?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const sizeWidths: Record<string, string> = {
  sm: '400px',
  md: '560px',
  lg: '720px',
  xl: '960px',
};

export const Modal: React.FC<ModalProps> & { Footer: React.FC<{ children: React.ReactNode }> } = ({
  open,
  onClose,
  title,
  size = 'md',
  persistent,
  children,
  style,
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !persistent) onClose();
    },
    [onClose, persistent],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const width = sizeWidths[size] || size;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        animation: 'sh-fade-in 0.2s ease',
      }}
      onClick={persistent ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.card.dark,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 0,
          boxShadow: shadows.elevated.dark,
          width,
          maxWidth: '90vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          animation: 'sh-fade-in 0.2s ease',
          ...style,
        }}
      >
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${spacing.md} ${spacing.lg}`,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}
          >
            <span style={{ fontFamily, fontWeight: fontWeight.light, fontSize: '1.25rem', color: '#F0F4F8' }}>
              {title}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: colors.gray.mid,
                cursor: 'pointer',
                fontSize: '20px',
                padding: spacing.xs,
                lineHeight: 1,
                transition: `color ${transitions.fast}`,
              }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = '#F0F4F8')}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = colors.gray.mid)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}
        <div
          style={{
            padding: spacing.lg,
            overflow: 'auto',
            flex: 1,
            fontFamily,
            fontSize: '14px',
            color: '#F0F4F8',
            lineHeight: '20px',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

Modal.Footer = ({ children }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      padding: `${spacing.md} 0 0 0`,
      marginTop: spacing.md,
      borderTop: '1px solid rgba(255,255,255,0.08)',
    }}
  >
    {children}
  </div>
);

Modal.displayName = 'Modal';
Modal.Footer.displayName = 'Modal.Footer';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  position?: 'left' | 'right';
  width?: string;
  overlay?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  title,
  position = 'right',
  width = '400px',
  overlay = true,
  children,
  style,
}) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  return (
    <>
      {overlay && open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'rgba(0, 0, 0, 0.4)',
            animation: 'sh-fade-in 0.2s ease',
          }}
        />
      )}
      <div
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          [position]: 0,
          width,
          maxWidth: '90vw',
          zIndex: 1000,
          background: colors.card.dark,
          borderLeft: position === 'right' ? '1px solid rgba(255,255,255,0.08)' : undefined,
          borderRight: position === 'left' ? '1px solid rgba(255,255,255,0.08)' : undefined,
          boxShadow: shadows.elevated.dark,
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : `translateX(${position === 'right' ? '100%' : '-100%'})`,
          transition: `transform 0.25s ease`,
          ...style,
        }}
      >
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${spacing.md} ${spacing.lg}`,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}
          >
            <span style={{ fontFamily, fontWeight: fontWeight.light, fontSize: '1.25rem', color: '#F0F4F8' }}>
              {title}
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: colors.gray.mid,
                cursor: 'pointer',
                fontSize: '20px',
                padding: spacing.xs,
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}
        <div
          style={{
            padding: spacing.lg,
            overflow: 'auto',
            flex: 1,
            fontFamily,
            fontSize: '14px',
            color: '#F0F4F8',
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
};

Drawer.displayName = 'Drawer';
