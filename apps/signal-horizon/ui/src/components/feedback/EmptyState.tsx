import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** Icon component from lucide-react */
  icon?: LucideIcon;
  /** Main title text */
  title: string;
  /** Description text */
  description?: string;
  /** Optional action button or content */
  action?: ReactNode;
  className?: string;
}

/**
 * Empty state component for when no data is available
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center px-4 py-12 text-center ${className}`} role="status">
      <div className="mb-4 rounded-full bg-gray-800 p-4">
        <Icon className="h-8 w-8 text-gray-500" aria-hidden="true" strokeWidth={1.5} />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-gray-200">{title}</h3>
      {description && <p className="mb-6 max-w-sm text-sm text-gray-400">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface EmptyStateButtonProps {
  children: ReactNode;
  onClick?: () => void;
  icon?: LucideIcon;
}

/** Pre-styled button for EmptyState action slot */
export function EmptyStateButton({ children, onClick, icon: Icon }: EmptyStateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {children}
    </button>
  );
}
