/**
 * Saved Queries Component
 * Saved query list and executor
 */

import { useState } from 'react';
import { Clock, Play, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { SavedQuery } from '../../hooks/useHunt';

interface SavedQueriesProps {
  queries: SavedQuery[];
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatQuerySummary(query: SavedQuery['query']): string {
  const parts: string[] = [];

  if (query.signalTypes && query.signalTypes.length > 0) {
    parts.push(`Types: ${query.signalTypes.length}`);
  }
  if (query.severities && query.severities.length > 0) {
    parts.push(`Severities: ${query.severities.join(', ')}`);
  }
  if (query.sourceIps && query.sourceIps.length > 0) {
    parts.push(`IPs: ${query.sourceIps.length}`);
  }
  if (query.minConfidence !== undefined) {
    parts.push(`Min conf: ${(query.minConfidence * 100).toFixed(0)}%`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'No filters';
}

export function SavedQueries({ queries, onRun, onDelete, isLoading }: SavedQueriesProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      await onRun(id);
    } finally {
      setRunningId(null);
    }
  };

  if (queries.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-white">Saved Queries</h2>
        </div>
        <div className="card-body p-6 text-center text-gray-500">
          <p className="text-sm">No saved queries yet</p>
          <p className="text-xs mt-1">Save a query to run it later</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="font-semibold text-white">Saved Queries</h2>
        <span className="text-xs text-gray-500">{queries.length} saved</span>
      </div>
      <div className="card-body space-y-2">
        {queries.map((query) => (
          <div
            key={query.id}
            className="bg-gray-800/50 rounded-lg overflow-hidden"
          >
            {/* Query Header */}
            <div
              className={clsx(
                'p-3 flex items-center justify-between cursor-pointer hover:bg-gray-800 transition-colors',
                expandedId === query.id && 'bg-gray-800'
              )}
              onClick={() => setExpandedId(expandedId === query.id ? null : query.id)}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {expandedId === query.id ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-medium text-white text-sm truncate">
                    {query.name}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {query.lastRunAt
                      ? `Last run ${formatRelativeTime(query.lastRunAt)}`
                      : 'Never run'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRun(query.id);
                  }}
                  disabled={isLoading || runningId === query.id}
                  className="p-1.5 text-horizon-400 hover:text-horizon-300 hover:bg-horizon-600/20 rounded transition-colors"
                  title="Run query"
                >
                  {runningId === query.id ? (
                    <div className="w-4 h-4 border-2 border-horizon-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this saved query?')) {
                      onDelete(query.id);
                    }
                  }}
                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-600/20 rounded transition-colors"
                  title="Delete query"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedId === query.id && (
              <div className="px-3 pb-3 pt-1 border-t border-gray-700/50">
                {query.description && (
                  <p className="text-sm text-gray-400 mb-2">{query.description}</p>
                )}
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="font-mono bg-gray-900 rounded px-2 py-1">
                    {formatQuerySummary(query.query)}
                  </div>
                  <div className="flex items-center gap-4">
                    <span>Limit: {query.query.limit || 1000}</span>
                    <span>Created: {new Date(query.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
