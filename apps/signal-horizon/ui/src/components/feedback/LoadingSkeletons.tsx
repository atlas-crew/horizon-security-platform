/**
 * Skeleton loading components for Signal Horizon UI
 * Uses Tailwind animate-pulse for shimmer effect
 */
import { Stack } from '@/ui';

interface SkeletonProps {
  className?: string;
}

/** Skeleton for stat cards displaying metrics */
export function StatCardSkeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={` border border-gray-700 bg-gray-800/50 p-4 ${className}`}
      aria-busy="true"
      aria-label="Loading stat card"
    >
      <div className="mb-3 h-4 w-24 animate-pulse bg-gray-700" />
      <div className="mb-2 h-8 w-20 animate-pulse bg-gray-700" />
      <Stack direction="row" align="center" gap="sm">
        <div className="h-4 w-4 animate-pulse bg-gray-700" />
        <div className="h-3 w-16 animate-pulse bg-gray-700" />
      </Stack>
    </div>
  );
}

/** Skeleton for table rows */
export function TableRowSkeleton({ className = '' }: SkeletonProps) {
  return (
    <tr className={className} aria-busy="true" aria-label="Loading table row">
      <td className="px-4 py-3">
        <div className="h-4 w-8 animate-pulse bg-gray-700" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-32 animate-pulse bg-gray-700" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-24 animate-pulse bg-gray-700" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-20 animate-pulse bg-gray-700" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-16 animate-pulse bg-gray-700" />
      </td>
    </tr>
  );
}

interface TableSkeletonProps extends SkeletonProps {
  rows?: number;
  columns?: number;
}

/** Full table skeleton with configurable rows and columns */
export function TableSkeleton({ className = '', rows = 5, columns = 5 }: TableSkeletonProps) {
  return (
    <div
      className={`overflow-hidden  border border-gray-700 ${className}`}
      aria-busy="true"
      aria-label="Loading table"
    >
      <div className="flex gap-4 border-b border-gray-700 bg-gray-800/70 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 animate-pulse bg-gray-600" style={{ width: `${60 + Math.random() * 40}px` }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 border-b border-gray-700/50 px-4 py-3 last:border-b-0">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="h-4 animate-pulse bg-gray-700" style={{ width: `${50 + Math.random() * 50}px` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton for chart areas */
export function ChartSkeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={` border border-gray-700 bg-gray-800/50 p-4 ${className}`}
      aria-busy="true"
      aria-label="Loading chart"
    >
      <div className="mb-4 h-5 w-32 animate-pulse bg-gray-700" />
      <div className="relative h-48 w-full animate-pulse bg-gray-700/50">
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-around gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="w-8 animate-pulse bg-gray-600" style={{ height: `${20 + Math.random() * 80}px` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Grid of stat card skeletons */
export function StatCardGridSkeleton({ className = '', count = 4 }: SkeletonProps & { count?: number }) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`} aria-busy="true" aria-label="Loading statistics">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}
