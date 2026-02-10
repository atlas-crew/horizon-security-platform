import React from 'react';
import { colors, fontFamily, fontWeight, spacing, shadows } from '../tokens/tokens';

/**
 * DataTable — Brand-compliant data table with navy headers and value highlighting.
 *
 * Usage:
 *   <DataTable
 *     columns={[
 *       { key: 'sensor', label: 'Sensor', width: '200px' },
 *       { key: 'rps', label: 'RPS', align: 'right' },
 *       { key: 'latency', label: 'P95', align: 'right',
 *         render: (v) => <ValuePill value={v} color={Number(v) < 20 ? 'green' : 'red'} /> },
 *     ]}
 *     data={[
 *       { sensor: 'us-east-1', rps: '12,400', latency: '17' },
 *     ]}
 *   />
 */

interface Column<T = any> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  /** Custom cell renderer */
  render?: (value: any, row: T, index: number) => React.ReactNode;
}

interface DataTableProps<T = Record<string, any>> {
  columns: Column<T>[];
  data: T[];
  /** Row click handler */
  onRowClick?: (row: T, index: number) => void;
  /** Highlight active row */
  activeIndex?: number;
  /** Compact row padding */
  compact?: boolean;
  /** Show container card */
  card?: boolean;
  /** Max height with scroll */
  maxHeight?: string;
  /** Empty state message */
  emptyMessage?: string;
  style?: React.CSSProperties;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  activeIndex,
  compact,
  card = true,
  maxHeight,
  emptyMessage = 'No data',
  style,
}: DataTableProps<T>) {
  const cellPadding = compact ? `${spacing.sm} ${spacing.md}` : `12px ${spacing.md}`;

  return (
    <div
      style={{
        background: card ? colors.card.dark : 'transparent',
        boxShadow: card ? shadows.card.dark : undefined,
        borderRadius: 0,
        overflow: maxHeight ? 'auto' : undefined,
        maxHeight,
        ...style,
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily,
        }}
      >
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  background: '#00174A',
                  color: '#FFFFFF',
                  fontWeight: fontWeight.medium,
                  fontSize: '14px',
                  padding: cellPadding,
                  textAlign: (col.align || 'left') as any,
                  width: col.width,
                  whiteSpace: 'nowrap',
                  position: maxHeight ? 'sticky' : undefined,
                  top: maxHeight ? 0 : undefined,
                  zIndex: maxHeight ? 1 : undefined,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: spacing.xl,
                  textAlign: 'center',
                  color: colors.gray.mid,
                  fontSize: '14px',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={i}
                onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                style={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  background:
                    activeIndex === i ? 'rgba(255,255,255,0.06)' : 'transparent',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (activeIndex !== i) {
                    (e.currentTarget as HTMLElement).style.background =
                      'rgba(255,255,255,0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeIndex !== i) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: cellPadding,
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      fontSize: '14px',
                      color: '#F0F4F8',
                      textAlign: (col.align || 'left') as any,
                    }}
                  >
                    {col.render
                      ? col.render(row[col.key], row, i)
                      : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

DataTable.displayName = 'DataTable';

/**
 * ValuePill — Colored highlight for important table values.
 *
 * Usage:
 *   <ValuePill value="17μs" color="green" />
 *   <ValuePill value="BLOCKED" color="red" />
 */

interface ValuePillProps {
  value: string | number;
  color?: 'green' | 'red' | 'orange' | 'blue' | 'magenta' | string;
  style?: React.CSSProperties;
}

const pillColorMap: Record<string, string> = {
  green: colors.green,
  red: colors.red,
  orange: colors.orange,
  blue: colors.blue,
  magenta: colors.magenta,
};

export const ValuePill: React.FC<ValuePillProps> = ({
  value,
  color = 'blue',
  style,
}) => {
  const bg = pillColorMap[color] || color;
  return (
    <span
      style={{
        background: bg,
        color: '#FFFFFF',
        fontFamily,
        fontWeight: fontWeight.medium,
        fontSize: '12px',
        padding: '2px 8px',
        borderRadius: 0,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {value}
    </span>
  );
};

ValuePill.displayName = 'ValuePill';
